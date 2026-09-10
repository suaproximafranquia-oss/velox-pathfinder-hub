import { beforeEach, expect, it, vi } from "vitest";
/**
 * O portão pode LER a fila do motor (continuidade do mesmo investidor).
 * O que nunca pode acontecer aqui é ESCRITA: `updates` é o que a prova
 * observa.
 */
const fake = vi.hoisted(() => {
  const updates = vi.fn();
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: async () => ({ data: [] }),
    update: (...args: unknown[]) => {
      updates(...args);
      return chain;
    },
    then: (resolve: (v: unknown) => unknown) => resolve({ data: [] }),
  };
  return { rows: [] as any[], updates, from: vi.fn(() => chain) };
});
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: fake.from } }));
vi.mock("@/server/crm/daily-actions.server", () => ({ buildDailyActions: async () => fake.rows }));
import { assertCommitmentAction, currentDailyAction } from "./daily-actions-gate.server";
const past = { actionKey: "meeting:TEST:past", source: "meeting", meetingId: "TEST-meeting", leadId: "TEST-lead", bucket: "pendente", dueDate: "2026-09-08", startsAt: "2026-09-08T12:00:00Z", overdue: false };
beforeEach(() => { fake.rows = [past]; fake.updates.mockReset(); fake.from.mockClear(); });
it("compromisso passado permanece aberto e aceita desfecho sem bloquear outra ação", async () => {
  fake.rows.push({ actionKey: "TEST-other", source: "cadence", leadId: "TEST-other", bucket: "hoje", dueDate: "2026-09-09" });
  expect((await currentDailyAction("TEST-exec")).current?.actionKey).toBe("TEST-other");
  expect(await assertCommitmentAction({ executiveId: "TEST-exec", actionKey: past.actionKey, meetingId: past.meetingId })).toEqual(past);
  expect(fake.updates).not.toHaveBeenCalled();
});
it("somente pendência aberta nunca vira posição 1 automática", async () => {
  expect((await currentDailyAction("TEST-exec")).current).toBeNull();
  expect(fake.rows).toEqual([past]);
});
it("exceção não autoriza outra reunião ou ação de cadência", async () => {
  await expect(assertCommitmentAction({ executiveId: "TEST-exec", actionKey: past.actionKey, meetingId: "TEST-other" })).rejects.toThrow();
  fake.rows = [{ ...past, source: "queue" }];
  await expect(assertCommitmentAction({ executiveId: "TEST-exec", actionKey: past.actionKey, meetingId: past.meetingId })).rejects.toThrow();
  expect(fake.updates).not.toHaveBeenCalled();
});
