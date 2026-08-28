/**
 * JANELA DE ATENDIMENTO DE 24 HORAS DA META (camada pura).
 *
 * A Meta só permite TEXTO LIVRE enquanto a conversa estiver aberta:
 * até 24 horas após a ÚLTIMA MENSAGEM RECEBIDA do investidor. Fora
 * disso, o único caminho legítimo é um template aprovado.
 *
 * Esta decisão é explícita e testável: nenhum caminho de envio pode
 * assumir que "responder é sempre permitido".
 */
export const META_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type MetaWindowDecision = {
  /** Conversa aberta: texto livre autorizado pela política da Meta. */
  open: boolean;
  /** Caminho obrigatório para este envio. */
  channel: "texto_livre" | "template";
  /** Milissegundos restantes da janela (0 quando fechada). */
  remainingMs: number;
  reason: string;
};

export function resolveMetaWindow(input: {
  /** Última mensagem RECEBIDA do investidor (inbound). */
  lastInboundAt: string | null;
  nowIso?: string;
}): MetaWindowDecision {
  const now = new Date(input.nowIso ?? new Date().toISOString()).getTime();
  if (!input.lastInboundAt) {
    return {
      open: false,
      channel: "template",
      remainingMs: 0,
      reason:
        "Sem mensagem recebida do investidor: janela de 24h fechada — texto livre não é permitido.",
    };
  }
  const last = new Date(input.lastInboundAt).getTime();
  if (!Number.isFinite(last)) {
    return {
      open: false,
      channel: "template",
      remainingMs: 0,
      reason: "Data da última mensagem recebida inválida — tratada como janela fechada.",
    };
  }
  const elapsed = now - last;
  if (elapsed < 0) {
    return {
      open: true,
      channel: "texto_livre",
      remainingMs: META_SESSION_WINDOW_MS,
      reason: "Mensagem recebida agora: janela de 24h aberta.",
    };
  }
  if (elapsed >= META_SESSION_WINDOW_MS) {
    return {
      open: false,
      channel: "template",
      remainingMs: 0,
      reason: "Mais de 24h desde a última mensagem do investidor: apenas template aprovado.",
    };
  }
  return {
    open: true,
    channel: "texto_livre",
    remainingMs: META_SESSION_WINDOW_MS - elapsed,
    reason: "Dentro das 24h da última mensagem do investidor: texto livre permitido.",
  };
}
