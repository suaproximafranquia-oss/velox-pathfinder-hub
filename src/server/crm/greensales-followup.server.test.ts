import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as string[],
  failCardRead: false,
  raceCardInsert: false,
  blockedExecutive: false,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      if (!db.rows[table]) throw new Error(`Tabela fora do escopo: ${table}`);
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      let operation = "select";
      let payload: Record<string, unknown> = {};
      let ignoreDuplicates = false;
      let single = false;
      const query = {
        select: (_columns?: string) => query,
        eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
        is: (key: string, value: unknown) => { filters.push((row) => (row[key] ?? null) === value); return query; },
        in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
        limit: (_count: number) => query,
        maybeSingle: () => { single = true; return query; },
        insert: (row: Record<string, unknown>) => { operation = "insert"; payload = row; return query; },
        upsert: (row: Record<string, unknown>, options?: { ignoreDuplicates?: boolean }) => {
          operation = "upsert"; payload = row; ignoreDuplicates = Boolean(options?.ignoreDuplicates); return query;
        },
        update: (row: Record<string, unknown>) => { operation = "update"; payload = row; return query; },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          const execute = () => {
            const rows = db.rows[table];
            if (operation === "select") {
              if (table === "portal_leads" && db.failCardRead) {
                return { data: null, error: { message: "read failed" } };
              }
              const matches = rows.filter((row) => filters.every((filter) => filter(row)));
              return { data: single ? matches[0] ?? null : matches, error: null };
            }
            db.writes.push(table);
            if (operation === "update") {
              rows.filter((row) => filters.every((filter) => filter(row))).forEach((row) => Object.assign(row, payload));
            } else {
              if (table === "portal_leads" && db.raceCardInsert) {
                db.raceCardInsert = false;
                rows.push({ ...payload });
                return { data: null, error: { message: "duplicate key" } };
              }
              const existing = rows.find((row) => row.id === payload.id);
              if (existing && operation === "insert") return { data: null, error: { message: "duplicate key" } };
              if (existing && !ignoreDuplicates) Object.assign(existing, payload);
              if (!existing) rows.push({ ...payload });
            }
            return { data: null, error: null };
          };
          return Promise.resolve().then(execute).then(resolve, reject);
        },
      };
      return query;
    },
  },
}));

vi.mock("@/server/crm/lead-service.server", () => ({ sanitizeRawPayload: (value: unknown) => value }));
vi.mock("@/server/crm/manager-guard.server", () => ({ isManagementExecutive: async () => db.blockedExecutive }));
vi.mock("@/server/crm/investor-notes.server", () => ({ addInvestorNote: vi.fn() }));

import { syncGreenSalesFollowUps, syncOneFollowUp } from "./greensales-followup.server";

const ID = "TEST-0001";
const NOW = "2026-09-09T15:00:00.000Z";
const FU = "2026-09-10 09:10:00";
const connection = { ownerUserId: "test-connection-owner", leadExternalIds: new Set([ID]) };
const item = { externalId: ID, stageKey: "agendamentos", followUp: FU };

beforeEach(() => {
  db.writes = [];
  db.failCardRead = false;
  db.raceCardInsert = false;
  db.blockedExecutive = false;
  db.rows = {
    crm_leads: [{
      id: "test-crm-id", external_id: ID, external_source: "greensales", stage_key: "agendamentos",
      name: "TEST Investidor", phone: "", email: "", canonical_investor_id: "test-canonical-id",
      external_created_at: "2025-01-01T12:00:00.000Z", raw_payload: { user_id: 37193, follow_up: FU },
    }],
    portal_leads: [], portal_meetings: [], crm_timeline: [],
    investor_identifiers: [{ source: "greensales", external_id: ID, investor_id: "test-existing-identity" }],
    executive_profiles: [
      { user_id: "test-connection-owner", executive_id: "test-executive", slug: "test-owner", name: "TEST Executivo" },
      { user_id: "37193", greensales_vendor_id: "37193", executive_id: "wrong-executive", slug: "wrong" },
      { user_id: "test-vendor-user", greensales_vendor_id: "test-vendor", executive_id: "vendor-executive", slug: "test-vendor" },
    ],
  };
});

describe("follow_up sem card — Financeira, banco isolado", () => {
  it.each(["agendamentos", "video"])("garante card mínimo e compromisso em %s pelo dono da conexão, sem sessão", async (stageKey) => {
    expect((await syncOneFollowUp({ ...item, stageKey }, NOW, connection)).kind).toBe("create");
    expect(db.rows.portal_leads).toHaveLength(1);
    expect(db.rows.portal_leads[0]).toMatchObject({
      id: `gs_${ID}`, responsible_executive_id: "test-executive", canonical_investor_id: "test-canonical-id",
      created_at: "2025-01-01T12:00:00.000Z", scope: "green_sales",
    });
    expect(db.rows.portal_meetings[0]).toMatchObject({ id: `gsfu_${ID}`, investor_id: `gs_${ID}`, executive_id: "test-executive" });
    // A simulação falha automaticamente se qualquer outra tabela for acessada.
    expect(new Set(db.writes)).toEqual(new Set(["portal_leads", "crm_leads", "portal_meetings", "crm_timeline"]));
  });

  it.each([
    ["novos", FU], ["frio", FU], ["agendamentos", null], ["video", "inválido"],
    ["agendamentos", "2025-01-01 10:00:00"],
  ])("não cria card nem obrigação fora da elegibilidade (%s, %s)", async (stageKey, followUp) => {
    await syncOneFollowUp({ ...item, stageKey, followUp }, NOW, connection);
    expect(db.writes).toEqual([]);
  });

  it("sem proprietário resolvível não usa user_id 37193", async () => {
    await syncOneFollowUp(item, NOW, { ...connection, ownerUserId: null });
    expect(db.writes).toEqual([]);
    await syncOneFollowUp(item, NOW, { ...connection, ownerUserId: "missing-owner" });
    expect(db.writes).toEqual([]);
  });

  it("não atribui leads de outra carteira ao proprietário desta execução", async () => {
    await syncOneFollowUp(item, NOW, { ...connection, leadExternalIds: new Set(["TEST-OTHER"]) });
    expect(db.writes).toEqual([]);
  });

  it("respeita o bloqueio existente para perfil de gestão", async () => {
    db.blockedExecutive = true;
    await syncOneFollowUp(item, NOW, connection);
    expect(db.writes).toEqual([]);
  });

  it.each([{ vendedor_id: "test-vendor" }, { vendedor: { id: "test-vendor" } }])("preserva vendedor oficial explícito: %j", async (vendor) => {
    Object.assign(db.rows.crm_leads[0].raw_payload as object, vendor);
    await syncOneFollowUp(item, NOW, connection);
    expect(db.rows.portal_leads[0].responsible_executive_id).toBe("vendor-executive");
  });

  it("não substitui vendedor explícito desconhecido pelo dono da conexão", async () => {
    Object.assign(db.rows.crm_leads[0].raw_payload as object, { vendedor_id: "unknown" });
    await syncOneFollowUp(item, NOW, connection);
    expect(db.writes).toEqual([]);
  });

  it("reutiliza a identidade existente no identificador quando o espelho ainda não tem vínculo", async () => {
    db.rows.crm_leads[0].canonical_investor_id = null;
    await syncOneFollowUp(item, NOW, connection);
    expect(db.rows.portal_leads[0].canonical_investor_id).toBe("test-existing-identity");
    expect(db.rows.crm_leads[0].canonical_investor_id).toBe("test-existing-identity");
  });

  it("sincronizações repetidas mantêm um card e um compromisso, sem recriar vínculos", async () => {
    await syncOneFollowUp(item, NOW, connection);
    const writes = [...db.writes];
    expect((await syncOneFollowUp(item, NOW, connection)).kind).toBe("noop");
    expect(db.rows.portal_leads).toHaveLength(1);
    expect(db.rows.portal_meetings).toHaveLength(1);
    expect(db.writes).toEqual(writes);
  });

  it("preserva responsável e identidade de card existente", async () => {
    db.rows.portal_leads.push({ id: `gs_${ID}`, name: "TEST Existente", email: "", responsible_executive_id: "existing-exec", canonical_investor_id: "existing-id" });
    await syncOneFollowUp(item, NOW, connection);
    expect(db.rows.portal_meetings[0].executive_id).toBe("existing-exec");
    expect(db.rows.portal_leads[0].canonical_investor_id).toBe("existing-id");
    expect(db.writes).not.toContain("portal_leads");
  });

  it("continua idempotente se outra execução inserir o card entre consulta e criação", async () => {
    db.raceCardInsert = true;
    expect((await syncOneFollowUp(item, NOW, connection)).kind).toBe("create");
    expect(db.rows.portal_leads).toHaveLength(1);
    expect(db.rows.portal_meetings).toHaveLength(1);
  });

  it("erro de leitura não é interpretado como card ausente", async () => {
    db.failCardRead = true;
    await expect(syncOneFollowUp(item, NOW, connection)).rejects.toThrow("read failed");
    expect(db.writes).toEqual([]);
  });

  it("propaga a conexão no lote sem criar cards para leads de outras carteiras", async () => {
    db.rows.crm_leads.push({ ...db.rows.crm_leads[0], id: "test-other-crm", external_id: "TEST-OTHER" });
    const result = await syncGreenSalesFollowUps(new Map([[ID, FU]]), NOW, connection);
    expect(result).toMatchObject({ created: 1, ignored: 1, errors: [] });
    expect(db.rows.portal_leads).toHaveLength(1);
  });
});