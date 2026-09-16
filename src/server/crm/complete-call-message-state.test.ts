import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const completion = readFileSync(new URL("./daily-actions-log.server.ts", import.meta.url), "utf8");
const outcome = readFileSync(
  new URL("../relationship/call-outcome.server.ts", import.meta.url),
  "utf8",
);
const repository = readFileSync(
  new URL("../relationship/repository.server.ts", import.meta.url),
  "utf8",
);

describe("ligação + mensagem — persistência da mesma execução", () => {
  it("retoma somente a mesma ligação EXECUTED com o mesmo resultado", () => {
    expect(outcome).toContain("row.result === input.outcome");
    expect(outcome).toContain('row.action_kind === "call"');
    expect(outcome).toContain('.select("id,lead_id,step,scope,status,action_kind,action_order,result")');
  });

  it("retry continua até a mensagem sem registrar uma segunda ligação", () => {
    expect(completion).toContain("!call.concluded && !call.alreadyExecuted");
    expect(completion).toContain('actionKey: `queue:${input.leadId}:${input.step}:${message.id}`');
    expect(completion).toContain('.eq("action_order", messageOrder)');
  });

  it("mensagem já EXECUTED encerra o retry como sucesso idempotente", () => {
    expect(completion).toContain('["PENDING", "PROCESSING", "EXECUTED"]');
    expect(completion).toContain('message.status === "EXECUTED"');
    expect(completion).toContain("Ligação e mensagem já estavam concluídas.");
  });

  it("tick concorrente não usa upsert capaz de ressuscitar EXECUTED", () => {
    const queueBlock = repository.slice(
      repository.indexOf("async upsertQueueItem"),
      repository.indexOf("async claimQueueItem"),
    );
    expect(queueBlock).not.toContain(".upsert(");
    expect(queueBlock).toContain("canRematerializeQueueStatus(existing.status)");
    expect(queueBlock).toContain('.eq("status", previousStatus)');
    expect(queueBlock).toContain('insertError?.code !== "23505"');
  });
});