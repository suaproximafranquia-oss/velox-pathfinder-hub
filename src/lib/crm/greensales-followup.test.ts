import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_STATES,
  followUpExternalRef,
  isAgendamentosToFrios,
  parseFollowUp,
  planFollowUpSync,
  reviewDueAt,
} from "./greensales-followup";

const NOW = "2026-09-10T12:00:00.000Z";
const FU = "2026-09-12 15:00:00"; // horário de Brasília (UTC-3)
const FU_ISO = "2026-09-12T18:00:00.000Z";

describe("follow_up GreenSales → compromisso espelhado (Financeira /f)", () => {
  it("interpreta follow_up no horário da operação e devolve UTC", () => {
    expect(parseFollowUp(FU)).toBe(FU_ISO);
    expect(parseFollowUp("")).toBeNull();
    expect(parseFollowUp(null)).toBeNull();
    expect(parseFollowUp("abc")).toBeNull();
  });

  it("identidade externa é determinística por lead", () => {
    expect(followUpExternalRef("57771")).toBe(followUpExternalRef("57771"));
    expect(followUpExternalRef("57771")).not.toBe(followUpExternalRef("57772"));
  });

  it("1. lead em AGENDAMENTOS com follow_up → cria compromisso", () => {
    const d = planFollowUpSync({ stageKey: "agendamentos", followUp: FU, existing: null, nowIso: NOW });
    expect(d).toEqual({ kind: "create", scheduledAt: FU_ISO });
  });

  it("2. sincronização repetida com o mesmo follow_up → nada a fazer (sem duplicidade)", () => {
    const d = planFollowUpSync({
      stageKey: "agendamentos",
      followUp: FU,
      existing: { scheduledAt: FU_ISO, state: FOLLOW_UP_STATES.pending, externalFollowUp: FU },
      nowIso: NOW,
    });
    expect(d.kind).toBe("noop");
  });

  it("3. follow_up alterado → atualiza o MESMO compromisso", () => {
    const d = planFollowUpSync({
      stageKey: "agendamentos",
      followUp: "2026-09-13 10:00:00",
      existing: { scheduledAt: FU_ISO, state: FOLLOW_UP_STATES.pending, externalFollowUp: FU },
      nowIso: NOW,
    });
    expect(d).toEqual({ kind: "update", from: FU_ISO, to: "2026-09-13T13:00:00.000Z" });
  });

  it("4. follow_up removido → cancela o compromisso pendente", () => {
    const d = planFollowUpSync({
      stageKey: "agendamentos",
      followUp: null,
      existing: { scheduledAt: FU_ISO, state: FOLLOW_UP_STATES.pending, externalFollowUp: FU },
      nowIso: NOW,
    });
    expect(d.kind).toBe("cancel");
    if (d.kind === "cancel") expect(d.reason).toBe(FOLLOW_UP_STATES.cancelledBySource);
  });

  it("5. lead fora de AGENDAMENTOS → follow_up ignorado", () => {
    for (const stage of ["novos", "frio", "oportunidades", null]) {
      const d = planFollowUpSync({ stageKey: stage, followUp: FU, existing: null, nowIso: NOW });
      expect(d.kind).toBe("ignore");
    }
  });

  it("6. saída de AGENDAMENTOS com compromisso pendente → cancelado por saída de estágio", () => {
    const d = planFollowUpSync({
      stageKey: "frio",
      followUp: FU,
      existing: { scheduledAt: FU_ISO, state: FOLLOW_UP_STATES.pending, externalFollowUp: FU },
      nowIso: NOW,
    });
    expect(d.kind).toBe("cancel");
    if (d.kind === "cancel") expect(d.reason).toBe(FOLLOW_UP_STATES.cancelledByStage);
  });

  it("7. follow_up já vencido há mais de 24h na primeira leitura → histórico, não cria", () => {
    const d = planFollowUpSync({
      stageKey: "agendamentos",
      followUp: "2026-07-28 18:00:00",
      existing: null,
      nowIso: NOW,
    });
    expect(d.kind).toBe("ignore");
  });

  it("8. mesmo horário reaparece após cancelamento pela origem → reativa o mesmo registro", () => {
    const d = planFollowUpSync({
      stageKey: "agendamentos",
      followUp: FU,
      existing: { scheduledAt: FU_ISO, state: FOLLOW_UP_STATES.cancelledBySource, externalFollowUp: FU },
      nowIso: NOW,
    });
    expect(d.kind).toBe("update");
  });

  it("9. compromisso já tratado (contato realizado) não é cancelado por remoção do follow_up", () => {
    const d = planFollowUpSync({
      stageKey: "agendamentos",
      followUp: null,
      existing: { scheduledAt: FU_ISO, state: FOLLOW_UP_STATES.contacted, externalFollowUp: FU },
      nowIso: NOW,
    });
    expect(d.kind).toBe("noop");
  });

  it("10. obrigação de 24h vence exatamente 24h após o registro sem contato", () => {
    expect(reviewDueAt("2026-09-12T18:10:00.000Z")).toBe("2026-09-13T18:10:00.000Z");
  });

  it("11. só AGENDAMENTOS → FRIOS libera o reengajamento", () => {
    expect(isAgendamentosToFrios("agendamentos", "frio")).toBe(true);
    expect(isAgendamentosToFrios("agendamentos", "oportunidades")).toBe(false);
    expect(isAgendamentosToFrios("novos", "frio")).toBe(false);
    expect(isAgendamentosToFrios(null, "frio")).toBe(false);
  });
});
