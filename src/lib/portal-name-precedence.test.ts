import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: [] as Record<string, any>[], writes: [] as Record<string, any>[], race: false }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain: any = { inputValidator: () => chain, middleware: () => chain, handler: (fn: any) => fn };
  return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/server/crm/manager-guard.server", () => ({ isManagementExecutive: async () => false }));
vi.mock("@/server/crm/portal-first-contact.server", () => ({ kickoffPortalFirstContact: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from(table: string) {
  let mode = "select"; let payload: Record<string, any> = {}; let single = false;
  const filters: Array<(row: Record<string, any>) => boolean> = [];
  const query: any = {
    select: () => query, eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return query; },
    limit: () => query, maybeSingle: () => { single = true; return query; },
    insert: (p: Record<string, any>) => { mode = "insert"; payload = p; return query; },
    update: (p: Record<string, any>) => { mode = "update"; payload = p; return query; },
    then(resolve: (v: unknown) => unknown) {
      if (table !== "portal_leads") return Promise.resolve({ data: null, error: null }).then(resolve);
      const found = db.rows.filter((r) => filters.every((f) => f(r)));
      if (mode === "select") return Promise.resolve({ data: single ? found[0] ?? null : found, error: null }).then(resolve);
      db.writes.push({ mode, ...payload });
      if (mode === "update") found.forEach((r) => Object.assign(r, payload));
      else {
        if (db.race) { db.race = false; db.rows.push({ ...payload, name: "Nome principal concorrente" }); return Promise.resolve({ data: null, error: { code: "23505" } }).then(resolve); }
        db.rows.push({ ...payload });
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  }; return query;
} } }));

import { syncPortalLead, type PortalLeadPayload } from "./portal-leads.functions";
const incoming = { unit: "f" as const, id: "TEST-0001", name: "Nome digitado no Portal", email: "test@example.invalid", whatsapp: "", scope: "portal" as const };
const run = (data: PortalLeadPayload = incoming) => (syncPortalLead as unknown as (args: { data: PortalLeadPayload }) => Promise<unknown>)({ data });
beforeEach(() => { db.rows = []; db.writes = []; db.race = false; });

describe("Portal /f — precedência exclusiva do nome", () => {
  it.each(["portal", "green_sales", "redistribuicao"])("preserva nome sem lock no escopo %s em submissão e reload", async (scope) => {
    db.rows = [{ ...incoming, scope, name: "Nome principal", manual_overrides: {} }];
    await run(); await run();
    expect(db.rows[0]?.name).toBe("Nome principal");
    expect(db.writes.every((w) => !("name" in w))).toBe(true);
  });
  it("deduplica usando matching existente sem substituir o nome ou id", async () => {
    db.rows = [{ ...incoming, id: "TEST-EXISTENTE", name: "Nome CRM" }];
    await run();
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ id: "TEST-EXISTENTE", name: "Nome CRM" });
  });
  it("novo cadastro aceita o nome informado normalmente", async () => {
    await run();
    expect(db.rows[0]?.name).toBe(incoming.name);
  });
  it("criação concorrente não permite sobrescrever nome principal", async () => {
    db.race = true; await run();
    expect(db.rows[0]?.name).toBe("Nome principal concorrente");
    expect(db.writes.filter((w) => w.mode === "update").every((w) => !("name" in w))).toBe(true);
  });
  it("outros campos continuam obedecendo às travas existentes", async () => {
    db.rows = [{ ...incoming, name: "Nome CRM", city: "Cidade CRM", manual_overrides: { city: { locked: true } } }];
    await run({ ...incoming, city: "Cidade Portal" } as typeof incoming);
    expect(db.rows[0]?.city).toBe("Cidade CRM");
    expect(db.rows[0]?.name).toBe("Nome CRM");
  });
  it("preserva contatos e contexto oficial em link cru e mantém alternativas sem repetição", async () => {
    const official = { ...incoming, name: "Nome CRM", email: "official@example.invalid", whatsapp: "11999990000",
      scope: "green_sales", origin: "GreenSales", responsible_executive_id: "TEST-owner", personalized: true,
      journey: { progress: 70 }, created_at: "2026-08-01", manual_overrides: {} };
    db.rows = [{ ...official }];
    await run({ ...incoming, whatsapp: "11888880000" });
    await run({ ...incoming, whatsapp: "11888880000" });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject(official);
    for (const field of ["name", "email", "whatsapp"]) {
      expect(db.rows[0].identity_alternates[field]).toHaveLength(1);
      expect(db.writes.every((w) => !(field in w))).toBe(true);
    }
  });
  it("link personalizado não troca responsável, origem ou workspace de cadastro reconhecido", async () => {
    db.rows = [{ ...incoming, name: "Oficial", scope: "portal", responsible_executive_id: "TEST-owner", origin: "Original" }];
    await run({ ...incoming, personalized: true, responsibleExecutiveId: "TEST-other", scope: "green_sales" });
    expect(db.rows[0]).toMatchObject({ name: "Oficial", scope: "portal", responsible_executive_id: "TEST-owner", origin: "Original" });
  });
  it("não aplica nova precedência de contatos fora de /f", async () => {
    db.rows = [{ ...incoming, email: "anterior@example.invalid", name: "Oficial", manual_overrides: {} }];
    await run({ ...incoming, unit: undefined });
    expect(db.rows[0].email).toBe(incoming.email);
    expect(db.rows[0].name).toBe("Oficial");
  });
});