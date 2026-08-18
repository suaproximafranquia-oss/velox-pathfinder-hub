/**
 * DATA DE ATIVAÇÃO DA CADÊNCIA — HISTÓRICO x LEAD NOVO.
 *
 * A data NÃO é fixa no código: ela é uma CONFIGURAÇÃO operacional
 * (`crm_automation_settings.cadence_activation_date`) que pode ser
 * definida quando a operação real começar. Enquanto não estiver
 * definida, NENHUM lead é elegível — na dúvida, jamais disparar.
 *
 * A regra não admite exceção:
 *
 *   • lead cuja ENTRADA REAL (cadastro/entrada comercial na origem) é
 *     anterior à data de corte é HISTÓRICO — permanece disponível para
 *     consulta, filtro, relatório e operação manual, mas NUNCA inicia
 *     automaticamente qualquer etapa (E0/E1/E3/E4/E12/E30), ligação,
 *     tarefa, reativação ou campanha automática;
 *   • lead cuja entrada real é igual ou posterior à data de corte é NOVO
 *     e segue a arquitetura normal: origem → Workspace → CRM → cadência.
 *
 * A data de SINCRONIZAÇÃO/INGESTÃO jamais substitui a data de entrada.
 * Reimportar, ressincronizar, reconstruir por carga histórica, atualizar
 * ou mover de coluna NÃO transforma um lead histórico em lead novo.
 */
import { commercialDate } from "@/lib/crm/cadence";

/** Data de ativação ainda não definida = nenhuma cadência automática. */
export type ActivationDate = string | null | undefined;

export type LeadEntryDates = {
  /** Nova entrada comercial registrada pela origem. */
  lastEntryAt?: string | null;
  /** Entrada REAL na coluna NOVOS do quadro (fonte preferencial). */
  enteredEntryStageAt?: string | null;
  /** Criação do lead na origem. */
  externalCreatedAt?: string | null;
  /** Criação do registro no Portal do Investidor. */
  createdAt?: string | null;
};

/**
 * Data de entrada REAL do lead. Nunca usa `ingested_at`,
 * `last_synced_at` ou o instante da execução: essas são datas técnicas.
 */
export function leadEntryDate(lead: LeadEntryDates): string | null {
  const source =
    lead.enteredEntryStageAt ?? lead.lastEntryAt ?? lead.externalCreatedAt ?? lead.createdAt ?? null;
  if (!source) return null;
  return commercialDate(source) || null;
}

/**
 * Sem data de entrada confiável o lead é tratado como HISTÓRICO: na
 * dúvida, jamais disparar.
 */
export function isHistoricalLead(lead: LeadEntryDates, activationDate: ActivationDate): boolean {
  if (!activationDate) return true;
  const entry = leadEntryDate(lead);
  if (!entry) return true;
  return entry < activationDate;
}

export type CadenceEligibility = { eligible: boolean; entryDate: string | null; reason: string };

/** Decisão explícita e auditável usada por todo ponto de disparo. */
export function cadenceEligibility(
  lead: LeadEntryDates,
  activationDate: ActivationDate,
): CadenceEligibility {
  if (!activationDate) {
    return {
      eligible: false,
      entryDate: leadEntryDate(lead),
      reason:
        "Data de ativação da cadência ainda não definida — nenhuma cadência automática é iniciada.",
    };
  }
  const entryDate = leadEntryDate(lead);
  if (!entryDate) {
    return {
      eligible: false,
      entryDate: null,
      reason: "Sem data de entrada real — tratado como histórico, nenhuma cadência é iniciada.",
    };
  }
  if (entryDate < activationDate) {
    return {
      eligible: false,
      entryDate,
      reason: `Lead histórico (entrada em ${entryDate}, anterior à ativação em ${activationDate}) — nenhuma cadência automática.`,
    };
  }
  return {
    eligible: true,
    entryDate,
    reason: `Lead novo (entrada em ${entryDate}) — apto à cadência da nova operação.`,
  };
}
