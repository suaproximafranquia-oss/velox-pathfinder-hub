import { describe, expect, it } from "vitest";
import { originStartsFirstContact, resolveInitialStep } from "./origin";
import { initialRecord, applyEvent } from "./machine";
import { nextStep } from "./decide";
import { HOMOLOGATION_MESSAGES } from "./messages";
import { RELATIONSHIP_CONFIG, STEPS } from "./config";

const AT = "2026-03-10T12:00:00.000Z";

function firstContact(entryOrigin: string | null) {
  const record = initialRecord({ scope: "homologation", leadId: "TEST-4F", at: AT });
  return applyEvent(record, {
    id: "e1",
    scope: "homologation",
    leadId: "TEST-4F",
    type: "FIRST_CONTACT_SENT",
    at: AT,
    data: entryOrigin ? { entryOrigin } : {},
  }).record;
}

describe("COMANDO 4F — origem de entrada", () => {
  it("Portal abre em E0 V1 e demais origens em E0", () => {
    expect(resolveInitialStep("PORTAL")).toBe("E0_V1");
    expect(resolveInitialStep("TRAFEGO_PAGO")).toBe("E0");
    expect(resolveInitialStep("LINK_PERSONALIZADO")).toBe("E0");
    expect(resolveInitialStep("RAW_PUBLIC")).toBe("E0");
  });

  it("redistribuição nunca dispara primeiro contato", () => {
    expect(resolveInitialStep("REDISTRIBUICAO")).toBeNull();
    expect(originStartsFirstContact("REDISTRIBUICAO")).toBe(false);
    expect(originStartsFirstContact("PORTAL")).toBe(true);
  });

  it("E0 V1 ocupa a posição de E0 e a próxima etapa continua sendo E1", () => {
    const record = firstContact("PORTAL");
    expect(record.currentStep).toBe("E0_V1");
    expect(record.executedSteps).toContain("E0");
    expect(nextStep(record)).toBe("E1");
  });

  it("tráfego pago mantém a apresentação padrão em E0", () => {
    expect(firstContact("TRAFEGO_PAGO").currentStep).toBe("E0");
  });

  it("E0 V1 não apresenta o Portal como novidade", () => {
    const msg = HOMOLOGATION_MESSAGES.E0_V1;
    expect(msg.step).toBe("E0_V1");
    expect(msg.text).toContain("acessou o Portal do Investidor");
    expect(STEPS.E0_V1.templatePurpose).toBe("primeiro_contato_portal");
  });

  it("assinatura oficial é Gerente de Expansão", () => {
    expect(HOMOLOGATION_MESSAGES.E0.text).toContain("Gerente de Expansão");
    expect(HOMOLOGATION_MESSAGES.E0.text).not.toContain("Executivo de Expansão");
  });

  it("sábado envia somente até 12:00 e domingo nunca", () => {
    expect(RELATIONSHIP_CONFIG.saturdayHours).toEqual({ start: 9, end: 12 });
  });
});
