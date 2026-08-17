/** COMANDO 2B — entrada x reentrada. */
import { describe, expect, it } from "vitest";
import { resolveEntryFlow } from "./entry";
import { FLOW_SEQUENCE, STEPS } from "./config";
import { applyEvent, initialRecord } from "./machine";
import { decideNextAction } from "./decide";
import { HOMOLOGATION_MESSAGES } from "./messages";

describe("resolveEntryFlow", () => {
  it("lead novo segue o fluxo de primeiro contato", () => {
    const r = resolveEntryFlow({
      entryCount: 1,
      hasPreviousRelationship: false,
      newCommercialEntry: false,
    });
    expect(r.flow).toBe("sem_resposta");
  });

  it("voltar para NOVOS sem nova entrada comercial não é reentrada", () => {
    const r = resolveEntryFlow({
      entryCount: 1,
      hasPreviousRelationship: true,
      newCommercialEntry: false,
    });
    expect(r.reentry).toBe(false);
  });

  it("lead conhecido com nova entrada comercial vira reentrada", () => {
    const r = resolveEntryFlow({
      entryCount: 2,
      hasPreviousRelationship: true,
      newCommercialEntry: true,
    });
    expect(r.flow).toBe("reentrada");
  });
});

describe("fluxo de reentrada", () => {
  it("sequência oficial é RE0 → RE3", () => {
    expect(FLOW_SEQUENCE.reentrada).toEqual(["RE0", "RE1", "RE2", "RE3"]);
    expect(STEPS.RE3.terminal).toBe(true);
  });

  it("RE1 e RE2 usam a Biblioteca de Conteúdos", () => {
    expect(STEPS.RE1.contentGroup).toBe("RE1");
    expect(STEPS.RE2.contentGroup).toBe("RE2");
    expect(HOMOLOGATION_MESSAGES.RE1.button).toBe("content");
  });

  it("abre em RE0 e nunca em E0", () => {
    const base = initialRecord({
      scope: "homologation",
      leadId: "TEST-1",
      at: "2026-08-17T12:00:00.000Z",
      flow: "reentrada",
    });
    const { record } = applyEvent(base, {
      id: "1",
      scope: "homologation",
      leadId: "TEST-1",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-17T12:00:00.000Z",
    });
    expect(record.executedSteps).toEqual(["RE0"]);
  });

  it("resposta durante a reentrada interrompe a automação", () => {
    let record = initialRecord({
      scope: "homologation",
      leadId: "TEST-2",
      at: "2026-08-17T12:00:00.000Z",
      flow: "reentrada",
    });
    record = applyEvent(record, {
      id: "2",
      scope: "homologation",
      leadId: "TEST-2",
      type: "MESSAGE_RECEIVED",
      at: "2026-08-17T13:00:00.000Z",
    }).record;
    expect(record.flow).toBe("reentrada");
    const action = decideNextAction(record, {
      nowIso: "2026-08-25T13:00:00.000Z",
      enabled: true,
      hasTemplateForPurpose: () => true,
    });
    expect(action.kind).toBe("none");
  });
});
