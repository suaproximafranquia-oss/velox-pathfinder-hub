/**
 * DEF 2.4.14 — Templates de mensagem integrados ao campo de envio.
 *
 * Modelos oficiais, institucionais e sem linguagem de venda agressiva.
 * O texto é inserido diretamente no campo de mensagem, permitindo edição
 * antes do envio — nenhum envio automático acontece.
 */
export type CrmTemplate = {
  id: string;
  label: string;
  body: (name: string) => string;
};

const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "";

export const CRM_TEMPLATES: CrmTemplate[] = [
  {
    id: "primeiro_contato",
    label: "Primeiro Contato",
    body: (n) =>
      `Olá, ${first(n)}! Sou Executivo de Expansão da Velox. Recebi seu interesse em conhecer nosso modelo de franquia e fico à disposição para esclarecer qualquer dúvida, sem compromisso.`,
  },
  {
    id: "envio_manual",
    label: "Envio de Material",
    body: (n) =>
      `${first(n)}, preparei o Manual do Investidor com todas as informações sobre investimento, produtos e suporte. Pode ler com calma e, depois, conversamos sobre o que fizer mais sentido para você.`,
  },
  {
    id: "convite_reuniao",
    label: "Convite para Reunião",
    body: (n) =>
      `${first(n)}, podemos marcar uma conversa on-line de cerca de 30 minutos para eu apresentar o modelo em detalhes e responder suas dúvidas? Me diga um dia e horário confortáveis para você.`,
  },
  {
    id: "acompanhamento",
    label: "Acompanhamento",
    body: (n) =>
      `Oi, ${first(n)}, tudo bem? Passando para saber se ficou alguma dúvida sobre o material. Sigo à disposição, no seu tempo.`,
  },
  {
    id: "retomada",
    label: "Retomada de Contato",
    body: (n) =>
      `${first(n)}, faz um tempo desde nossa última conversa. Caso ainda tenha interesse em avaliar a oportunidade, posso retomar de onde paramos.`,
  },
];

/** Janela oficial de 24 horas a partir da última resposta do investidor. */
export const CRM_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CrmWindowStatus = {
  open: boolean;
  /** Rótulo curto exibido no cabeçalho da conversa. */
  label: string;
  /** Explicação exibida na barra de envio. */
  hint: string;
};

export function resolveCrmWindow(
  anchorIso: string | null | undefined,
  now = Date.now(),
): CrmWindowStatus {
  const at = anchorIso ? Date.parse(anchorIso) : NaN;
  if (!Number.isFinite(at)) {
    return {
      open: false,
      label: "Janela de Conversação Encerrada",
      hint: "Envio livre bloqueado. Selecione um Template aprovado para reabrir a conversa.",
    };
  }
  const remaining = at + CRM_WINDOW_MS - now;
  if (remaining <= 0) {
    return {
      open: false,
      label: "Janela de Conversação Encerrada",
      hint: "A janela de 24 horas expirou. Selecione um Template aprovado para reabrir a conversa.",
    };
  }
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return {
    open: true,
    label: hours > 0 ? `Janela aberta · ${hours}h ${minutes}min` : `Janela aberta · ${minutes}min`,
    hint: "Janela aberta: mensagens livres, anexos e emojis liberados.",
  };
}
