/**
 * PRÉ-GATILHO DA AÇÃO DO DIA (Financeira /f) — SOMENTE ANTECIPAÇÃO.
 *
 * Quando o Executivo escolhe "Não atendeu", a consequência determinística
 * daquela etapa já é conhecida: a MENSAGEM OFICIAL da mesma etapa. Este
 * módulo guarda, por poucos segundos, o resultado dessa leitura
 * antecipada para que o próximo card não precise buscá-la do zero.
 *
 * O que ele NÃO é:
 *  • não efetiva ação, não cria linha de fila, não avança o motor,
 *    não grava histórico e não marca execução;
 *  • não decide nada: a autoridade continua sendo a fila oficial
 *    devolvida pelo "Concluído".
 *
 * Trocar a decisão, abandonar o card ou passar do tempo simplesmente
 * descarta o preparo.
 */
import type { StepMessageView } from "@/lib/crm/daily-actions.adapter";

/** Vida curta: preparo velho nunca substitui leitura oficial nova. */
const TTL_MS = 45_000;

type Slot = {
  key: string;
  at: number;
  promise: Promise<StepMessageView | null>;
};

let slot: Slot | null = null;

export function stepMessageKey(leadId: string | null, step: string | null): string | null {
  if (!leadId || !step) return null;
  return `${leadId}::${String(step).trim().toUpperCase()}`;
}

/** Inicia (uma única vez) a leitura antecipada da mensagem oficial. */
export function primeStepMessage(
  key: string | null,
  load: () => Promise<StepMessageView | null>,
): void {
  if (!key) return;
  if (slot && slot.key === key && Date.now() - slot.at < TTL_MS) return;
  slot = {
    key,
    at: Date.now(),
    // Falha no preparo é irrelevante: o caminho oficial busca de novo.
    promise: load().catch(() => null),
  };
}

/** Consome o preparo, quando ainda válido. Sempre de uso único. */
export function takeStepMessage(key: string | null): Promise<StepMessageView | null> | null {
  if (!key || !slot || slot.key !== key) return null;
  if (Date.now() - slot.at >= TTL_MS) {
    slot = null;
    return null;
  }
  const { promise } = slot;
  slot = null;
  return promise;
}

/** Decisão trocada, card abandonado ou ação concluída: descarta o preparo. */
export function clearStepMessagePrefetch(): void {
  slot = null;
}
