import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ files: new Map<string, unknown>(), allowed: true, token: true, failUpload: false, executiveId: "TEST-executive" }));
vi.mock("@/server/workspace-authorization.server", () => ({ assertWorkspaceAccess: async () => ({ role: "executivo", executiveId: mock.executiveId }) }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: (_v: unknown) => chain, middleware: (_m: unknown) => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/server/portal-token.server", () => ({ verifyToken: async () => mock.token }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: "TEST-investor", scope: "portal", origin: "Portal Velox" }, error: null }) }; return q; },
  storage: { from: () => ({
    upload: async (path: string, content: unknown) => { if (mock.failUpload) return { error: {} }; mock.files.set(path, content); return { error: null }; },
    list: async (dir: string, options: { offset: number; limit: number }) => ({ data: [...mock.files.keys()].filter((p) => p.startsWith(dir + "/")).slice(options.offset, options.offset + options.limit).map((p) => ({ name: p.slice(dir.length + 1) })), error: null }),
    download: async (path: string) => ({ data: { text: async () => mock.files.get(path) }, error: null }),
    createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://example.test/${path}` }, error: null }),
  }) },
} }));
import { saveSimulationReport, listSimulationReports } from "./simulation-reports.functions";

const record = { id: "11111111-1111-4111-8111-111111111111", investorId: "TEST-investor", createdAt: "2026-09-09T12:00:00.000Z", filename: "teste.pdf", pdfDataUri: "data:application/pdf;base64,JVBERi0xLjcK", total: 100, annual: 1200, products: [], executiveName: null, audienceLabel: null, interests: [] };
const context = { supabase: { from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: mock.allowed ? { id: "TEST-investor", scope: "portal", origin: "Portal Velox", responsible_executive_id: "TEST-executive" } : null }) }; return q; } } };
beforeEach(() => { mock.files.clear(); mock.allowed = true; mock.token = true; mock.failUpload = false; mock.executiveId = "TEST-executive"; });
it("persiste PDF e metadados e recupera em outra sessão sem localStorage", async () => {
  await (saveSimulationReport as any)({ data: { token: "fake", record } });
  await (saveSimulationReport as any)({ data: { token: "fake", record } });
  expect(mock.files.size).toBe(2);
  const rows = await (listSimulationReports as any)({ data: { investorId: record.investorId }, context });
  expect(rows).toHaveLength(1);
  expect(rows[0].total).toBe(100);
  expect(rows[0].pdfUrl).toContain(record.id + ".pdf");
  expect(rows[0].pdfDataUri).toBe("");
});
it("rejeita upload sem token e leitura sem acesso ao investidor", async () => {
  mock.token = false;
  await expect((saveSimulationReport as any)({ data: { token: "fake", record } })).rejects.toThrow();
  mock.allowed = false;
  await expect((listSimulationReports as any)({ data: { investorId: record.investorId }, context })).rejects.toThrow();
  expect(mock.files.size).toBe(0);
});
it("não confirma persistência quando o storage falha", async () => {
  mock.failUpload = true;
  await expect((saveSimulationReport as any)({ data: { token: "fake", record } })).rejects.toThrow();
});
it("não fornece relatório de outro executivo", async () => {
  await (saveSimulationReport as any)({ data: { token: "fake", record } });
  mock.executiveId = "TEST-other";
  await expect((listSimulationReports as any)({ data: { investorId: record.investorId }, context })).rejects.toThrow("Acesso não autorizado");
});