/**
 * Cenários mínimos do motor (COMANDO 2A §114). Não substituem o
 * COMANDO 3 — apenas provam que as regras centrais estão corretas.
 */
import { describe, expect, it } from "vitest";
import { RELATIONSHIP_CONFIG } from "./config";
import { decideNextAction } from "./decide";
import { applyEvent, initialRecord } from "./machine";
import { dueMomentAfterBusinessDays, isBusinessDay } from "./calendar";
import type { CadenceRecord, EngineEvent } from "./types";

const config = { ...RELATIONSHIP_CONFIG, enabled: true };
const always = () => true;

function record(): CadenceRecord {
  return initialRecord({ scope: "homologation", leadId: "TEST-0001", at: "2026-08-14T12:00:00Z" });
}

function event(type: EngineEvent["type"], at: string, extra: Partial<EngineEvent> = {}): EngineEvent {
  return { id: `${type}-${at}`, scope: "homologation", leadId: "TEST-0001", type, at, ...extra };
}

describe("calendário", () => {
  it("sábado e domingo não são dias úteis", () => {
    expect(isBusinessDay("2026-08-15")).toBe(false); // sábado
    expect(isBusinessDay("2026-08-16")).toBe(false); // domingo
    expect(isBusinessDay("2026-08-17")).toBe(true);
  });

  it("etapa que cairia no sábado vai para segunda", () => {
    const due = dueMomentAfterBusinessDays("2026-08-14T18:00:00Z", 1, config);
    expect(due.slice(0, 10)).toBe("2026-08-17");
  });
});

describe("motor", () => {
  it("primeiro contato ativa a cadência em E0", () => {
    const after = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config);
    expect(after.record.state).toBe("CADENCE_ACTIVE");
    expect(after.record.executedSteps).toEqual(["E0"]);
  });

  it("resposta interrompe a cadência original", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("MESSAGE_RECEIVED", "2026-08-17T13:00:00Z"), config).record;
    expect(r.state).toBe("RESPONDED");
    expect(r.flow).toBe("reengajamento");
    const action = decideNextAction(r, {
      nowIso: "2026-08-17T14:00:00Z",
      config,
      hasTemplateForPurpose: always,
    });
    expect(action.kind).toBe("none");
  });

  it("visualizar não é responder, mas a segunda visualização troca o fluxo", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("MESSAGE_READ", "2026-08-17T12:05:00Z"), config).record;
    expect(r.flow).toBe("sem_resposta");
    r = applyEvent(r, event("MESSAGE_READ", "2026-08-18T12:05:00Z"), config).record;
    expect(r.flow).toBe("visualizacao");
    expect(r.state).toBe("VISUALIZED_NO_RESPONSE");
  });

  it("agendamento bloqueia qualquer etapa automática", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("SCHEDULE_CREATED", "2026-08-17T15:00:00Z"), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-19T12:00:00Z",
      config,
      hasTemplateForPurpose: always,
    });
    expect(action).toMatchObject({ kind: "none" });
    expect(action.reason).toContain("agendamento");
  });

  it("janela fechada sem template oficial bloqueia o envio", () => {
    const r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-18T13:00:00Z",
      config,
      hasTemplateForPurpose: () => false,
    });
    expect(action.kind).toBe("none");
    expect(action.reason).toContain("template oficial");
  });

  it("etapa já executada nunca se repete e a ordem é respeitada", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("MESSAGE_SENT", "2026-08-18T13:00:00Z", { step: "E1" }), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-20T13:00:00Z",
      config,
      hasTemplateForPurpose: always,
    });
    expect(action.kind === "send_step" && action.step).toBe("E3");
  });

  it("motor desabilitado não cria disparo", () => {
    const r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-19T13:00:00Z",
      config: { ...config, enabled: false },
      hasTemplateForPurpose: always,
    });
    expect(action.reason).toContain("desabilitado");
  });

  it("evento histórico não reativa cadência", () => {
    const r = applyEvent(record(), { ...event("MESSAGE_SENT", "2026-01-10T12:00:00Z", { step: "E1" }), historical: true }, config);
    expect(r.record.state).toBe("CADENCE_NOT_STARTED");
  });
});