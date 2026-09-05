/**
 * CONTATO HUMANO REAL — DEFINIÇÃO ÚNICA (BLOCO 1).
 *
 * Autoridade única para responder: "este investidor já teve contato
 * humano real?". A regra é somente leitura e não cria, altera nem
 * dispara nada.
 *
 * CONTA como contato real:
 *   1. mensagem efetivamente enviada pelo motor (automática);
 *   2. mensagem cujo envio foi confirmado manualmente pelo executivo na
 *      Ação do Dia (o mesmo evento já registrado hoje — não existe
 *      evento paralelo);
 *   3. mensagem recebida do investidor;
 *   4. ligação concluída com desfecho ATENDEU.
 *
 * NÃO conta: abrir/criar card, entrega técnica, leitura técnica, copiar
 * mensagem, abrir conversa, observação, confirmação de nome, mudança de
 * coluna, agendamento sem conversa, envio bloqueado pelo Safety Lock e
 * ligação que chamou mas não atendeu (é tentativa, não contato).
 */

/** Eventos do motor que representam mensagem realmente trocada. */
export const REAL_CONTACT_EVENT_TYPES = [
  "FIRST_CONTACT_SENT",
  "MESSAGE_SENT",
  "EXECUTIVE_MESSAGE_SENT",
  "MESSAGE_RECEIVED",
] as const;

/** Eventos que existem, mas nunca provam contato humano. */
export const NON_CONTACT_EVENT_TYPES = [
  "LEAD_CREATED",
  "MESSAGE_DELIVERED",
  "MESSAGE_READ",
  "WINDOW_OPENED",
  "WINDOW_CLOSED",
  "SCHEDULE_CREATED",
  "SCHEDULE_CANCELLED",
  "MANUAL_INTERRUPTION",
  "MANUAL_RESUME",
  "NAME_CONFIRMED",
  "CONTENT_SENT",
  "CADENCE_INTERRUPTED",
  "CADENCE_RESUMED",
  "CADENCE_COMPLETED",
  "CADENCE_CLOSED",
] as const;

/** Resultados de fila que NÃO representam envio real. */
const BLOCKED_RESULTS = ["bloqueado", "erro", "safety_lock", "simulado"];

export type ContactEvidence = {
  /** Tipo do evento do motor, quando a evidência vier de `relationship_events`. */
  eventType?: string | null;
  /** Resultado gravado na fila/execução (`enviado`, `enviado_manual`, ...). */
  result?: string | null;
  /** Desfecho da ligação: "SIM" = atendeu. */
  callOutcome?: string | null;
  /** Ligação concluída? Só uma tentativa concluída pode ser avaliada. */
  callCompleted?: boolean;
  /** Envio simulado/homologação nunca é contato real. */
  simulated?: boolean;
  /** Momento da evidência (ISO), apenas informativo. */
  at?: string | null;
};

/** Uma única evidência prova contato humano real? */
export function isRealHumanContactEvidence(evidence: ContactEvidence): boolean {
  if (evidence.simulated) return false;

  const result = (evidence.result ?? "").toLowerCase();
  if (result && BLOCKED_RESULTS.some((blocked) => result.includes(blocked))) return false;

  const type = evidence.eventType ?? null;
  if (type && (REAL_CONTACT_EVENT_TYPES as readonly string[]).includes(type)) return true;

  if (evidence.callCompleted && (evidence.callOutcome ?? "").toUpperCase() === "SIM") return true;

  return false;
}

export type HumanContactVerdict = {
  hasContact: boolean;
  /** Primeira evidência que fechou a questão, quando houver. */
  evidence: ContactEvidence | null;
  reason: string;
};

/** Avalia um conjunto de evidências já lidas do banco. */
export function evaluateHumanContact(evidences: readonly ContactEvidence[]): HumanContactVerdict {
  for (const evidence of evidences) {
    if (isRealHumanContactEvidence(evidence)) {
      return {
        hasContact: true,
        evidence,
        reason: evidence.eventType
          ? `Contato real comprovado pelo evento ${evidence.eventType}.`
          : "Contato real comprovado por ligação atendida.",
      };
    }
  }
  return {
    hasContact: false,
    evidence: null,
    reason:
      "Nenhuma mensagem enviada/recebida e nenhuma ligação atendida — não houve contato humano real.",
  };
}
