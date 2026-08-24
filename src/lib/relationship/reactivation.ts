/**
 * E30 — REATIVAÇÃO TARDIA (integrada ao fluxo pelo COMANDO 4A §8,
 * ainda não ativada).
 *
 * A E30 pertence ao fluxo SEM RESPOSTA do motor (`STEPS`/`FLOW_SEQUENCE`
 * em `config.ts`) — nunca é uma cadência independente. É contada a
 * partir do INÍCIO DA JORNADA do lead novo — nunca a partir de uma
 * importação, sincronização ou carga histórica. Enquanto `E30_ENABLED`
 * for falso, nada é agendado nem enviado: a E12 permanece como
 * encerramento do fluxo e a guarda de ordem mantém a E30 fora da fila.
 * A ativação futura exige texto oficial aprovado — sem texto inventado.
 */
import { addBusinessDays, commercialDate } from "@/lib/crm/cadence";
import { isHistoricalLead, type ActivationDate, type LeadEntryDates } from "@/lib/crm/cutover";

/** Enquanto falso, nenhuma etapa E30 é criada, agendada ou disparada. */
export const E30_ENABLED = false;

/** Dias úteis após o início da jornada (≈30 dias corridos). */
export const E30_BUSINESS_DAYS_AFTER_START = 22;

export type E30Plan = { scheduled: false; reason: string } | { scheduled: true; dueDate: string };

export function planE30(input: {
  lead: LeadEntryDates;
  /** Início REAL da jornada do lead novo (E0 executado). */
  journeyStartedAt: string | null;
  /** Data de ativação configurada; vazia = nada é agendado. */
  activationDate?: ActivationDate;
}): E30Plan {
  if (!E30_ENABLED) return { scheduled: false, reason: "E30 ainda não ativado." };
  if (isHistoricalLead(input.lead, input.activationDate ?? null)) {
    return { scheduled: false, reason: "Lead histórico — E30 nunca é criado." };
  }
  const start = input.journeyStartedAt ? commercialDate(input.journeyStartedAt) : "";
  if (!start) return { scheduled: false, reason: "Jornada ainda não iniciada." };
  return { scheduled: true, dueDate: addBusinessDays(start, E30_BUSINESS_DAYS_AFTER_START) };
}
