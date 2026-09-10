import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  created: false,
  entries: new Map<string, any>(),
  first: vi.fn(), reentry: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const c = { inputValidator: () => c, middleware: () => c, handler: (fn: unknown) => fn }; return c;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/server/crm/portal-first-contact.server", () => ({ kickoffPortalFirstContact: fake.first }));
vi.mock("@/server/relationship/reentry-open.server", () => ({ openCommercialReentry: fake.reentry }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: async () => ({ data: { ok: true, investorId: "TEST-identity", recognized: !fake.created }, error: null }),
  from: () => {
    let id = "";
    const q = {
      upsert: async (row: any) => {
        if (!fake.entries.has(row.id)) fake.entries.set(row.id, { ...row, created_at: "2026-09-09T12:00:00Z" });
        return { error: null };
      },
      select: () => q, eq: (_key: string, value: string) => { id = value; return q; },
      maybeSingle: async () => ({ data: fake.entries.get(id), error: null }),
      insert: async () => ({ error: null }),
    }; return q;
  },
} }));
import { resolvePortalIdentity } from "./portal-identity.functions";
const data = { name: "TEST pessoa", email: "test@example.test", phone: "11999990000" };
const commercialSubmission = { id: "11111111-1111-4111-8111-111111111111", unit: "f" };
beforeEach(() => { fake.entries.clear(); fake.created = false; fake.first.mockReset(); fake.reentry.mockReset(); });
it("novo cadastro chama apenas E0; retry reconhecido não transforma primeira submissão em RE", async () => {
  fake.created = true;
  await (resolvePortalIdentity as any)({ data: { ...data, commercialSubmission } });
  fake.created = false;
  await (resolvePortalIdentity as any)({ data: { ...data, commercialSubmission } });
  expect(fake.first).toHaveBeenCalled();
  expect(fake.reentry).not.toHaveBeenCalled();
  expect(fake.entries.size).toBe(1);
});
it("conhecido com nova submissão chama RE0 exclusivamente, com chave e horário persistentes", async () => {
  await (resolvePortalIdentity as any)({ data: { ...data, commercialSubmission } });
  await (resolvePortalIdentity as any)({ data: { ...data, commercialSubmission } });
  expect(fake.first).not.toHaveBeenCalled();
  expect(fake.reentry.mock.calls[0]).toEqual(fake.reentry.mock.calls[1]);
  expect(fake.reentry.mock.calls[0][0]).toMatchObject({ submissionKey: `portal:${commercialSubmission.id}`, at: "2026-09-09T12:00:00Z" });
  expect(fake.entries.size).toBe(1);
});
it("conhecido sem submissão: continuar sessão não abre RE nem E0", async () => {
  await (resolvePortalIdentity as any)({ data });
  expect(fake.first).not.toHaveBeenCalled();
  expect(fake.reentry).not.toHaveBeenCalled();
  expect(fake.entries.size).toBe(0);
});
it("marcador inválido ou outra unidade não abre RE", async () => {
  await (resolvePortalIdentity as any)({ data: { ...data, commercialSubmission: { id: "invalid", unit: "f" } } });
  await (resolvePortalIdentity as any)({ data: { ...data, commercialSubmission: { ...commercialSubmission, unit: "s" } } });
  expect(fake.reentry).not.toHaveBeenCalled();
});