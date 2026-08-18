/**
 * DATA DE CORTE OPERACIONAL — HISTÓRICO x LEAD NOVO.
 *
 * Fonte única da verdade sobre quem pode entrar em cadência. A regra é
 * simples e não admite exceção:
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

/** 01/09 — início oficial da nova operação (America/Sao_Paulo). */
export const OPERATIONAL_CUTOVER_DATE = "2026-09-01";

export type LeadEntryDates = {
  /** Nova entrada comercial registrada pela origem. */
  lastEntryAt?: string | null;
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
  const source = lead.lastEntryAt ?? lead.externalCreatedAt ?? lead.createdAt ?? null;
  if (!source) return null;
  return commercialDate(source) || null;
}

/**
 * Sem data de entrada confiável o lead é tratado como HISTÓRICO: na
 * dúvida, jamais disparar.
 */
export function isHistoricalLead(lead: LeadEntryDates): boolean {
  const entry = leadEntryDate(lead);
  if (!entry) return true;
  return entry < OPERATIONAL_CUTOVER_DATE;
}

export type CadenceEligibility = { eligible: boolean; entryDate: string | null; reason: string };

/** Decisão explícita e auditável usada por todo ponto de disparo. */
export function cadenceEligibility(lead: LeadEntryDates): CadenceEligibility {
  const entryDate = leadEntryDate(lead);
  if (!entryDate) {
    return {
      eligible: false,
      entryDate: null,
      reason: "Sem data de entrada real — tratado como histórico, nenhuma cadência é iniciada.",
    };
  }
  if (entryDate < OPERATIONAL_CUTOVER_DATE) {
    return {
      eligible: false,
      entryDate,
      reason: `Lead histórico (entrada em ${entryDate}, anterior a ${OPERATIONAL_CUTOVER_DATE}) — nenhuma cadência automática.`,
    };
  }
  return {
    eligible: true,
    entryDate,
    reason: `Lead novo (entrada em ${entryDate}) — apto à cadência da nova operação.`,
  };
}
