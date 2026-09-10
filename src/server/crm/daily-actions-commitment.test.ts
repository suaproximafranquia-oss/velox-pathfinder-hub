import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ rows: [] as any[], writes: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: fake.writes } }));
vi.mock("@/server/crm/daily-actions.server", () => ({ buildDailyActions: async () => fake.rows }));
import { assertCommitmentAction, currentDailyAction } from "./daily-actions-gate.server";
const past = { actionKey: "meeting:TEST:past", source: "meeting", meetingId: "TEST-meeting", leadId: "TEST-lead", bucket: "pendente", dueDate: "2026-09-08", startsAt: "2026-09-08T12:00:00Z", overdue: false };
beforeEach(() => { fake.rows = [past]; fake.writes.mockReset(); });
it("compromisso passado permanece aberto e aceita desfecho sem bloquear outra ação", async () => {
  fake.rows.push({ actionKey: "TEST-other", source: "cadence", leadId: "TEST-other", bucket: "hoje", dueDate: "2026-09-09" });
  expect((await currentDailyAction("TEST-exec")).current?.actionKey).toBe("TEST-other");
  expect(await assertCommitmentAction({ executiveId: "TEST-exec", actionKey: past.actionKey, meetingId: past.meetingId })).toEqual(past);
  expect(fake.writes).not.toHaveBeenCalled();
});
it("somente pendência aberta nunca vira posição 1 automática", async () => {
  expect((await currentDailyAction("TEST-exec")).current).toBeNull();
  expect(fake.rows).toEqual([past]);
});
it("exceção não autoriza outra reunião ou ação de cadência", async () => {
  await expect(assertCommitmentAction({ executiveId: "TEST-exec", actionKey: past.actionKey, meetingId: "TEST-other" })).rejects.toThrow();
  fake.rows = [{ ...past, source: "queue" }];
  await expect(assertCommitmentAction({ executiveId: "TEST-exec", actionKey: past.actionKey, meetingId: past.meetingId })).rejects.toThrow();
  expect(fake.writes).not.toHaveBeenCalled();
});