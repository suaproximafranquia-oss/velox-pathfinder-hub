/**
 * HISTÓRICO DA AÇÃO DO DIA NAS "NOTAS DO EXECUTIVO" — SERVER ONLY.
 *
 * EXTENSÃO DE REGISTRO, NADA MAIS. Este módulo não executa ação, não
 * move cadência, não fala com a Biblioteca, com o motor, com a fila,
 * com o CRM ou com o WhatsApp. Ele apenas transforma um acontecimento
 * JÁ CONCLUÍDO da Ação do Dia em uma linha de histórico do MESMO
 * investidor (`DailyAction.leadId` → `portal_leads.id` → `investor_notes`).
 *
 * IDEMPOTÊNCIA: sempre via `source_key` derivado da própria ação, com o
 * índice único de `investor_notes` como última barreira.
 */
import { addInvestorNote } from "@/server/crm/investor-notes.server";

const TZ = "America/Sao_Paulo";

/** "05/09/2026 12:02" no fuso operacional. */
export function formatOperationalMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}

export type HistorySection = { label: string; value: string | null | undefined };

/** Título curto: "Ligação realizada — E0 — 05/09/2026 12:02". */
export function historyHeadline(
  action: string,
  step: string | null | undefined,
  iso: string,
): string {
  return [action, step?.trim() || null, formatOperationalMoment(iso)]
    .filter(Boolean)
    .join(" — ");
}

/**
 * Grava a linha de histórico. Falhar aqui NUNCA desfaz a ação: o
 * histórico é complementar ao fluxo oficial já executado.
 */
export async function recordDailyActionHistory(input: {
  leadId: string | null;
  sourceKey: string;
  headline: string;
  sections?: HistorySection[];
  userId: string;
  executiveId: string | null;
}): Promise<void> {
  if (!input.leadId) return;
  const extras = (input.sections ?? [])
    .filter((s) => (s.value ?? "").trim().length > 0)
    .map((s) => `${s.label}: ${(s.value ?? "").trim()}`);
  const body = [input.headline, ...extras].join("\n\n").trim();
  if (!body) return;
  try {
    await addInvestorNote({
      leadId: input.leadId,
      body,
      userId: input.userId,
      executiveId: input.executiveId,
      sourceKey: input.sourceKey,
    });
  } catch {
    // Histórico complementar: nunca invalida a execução da ação.
  }
}
