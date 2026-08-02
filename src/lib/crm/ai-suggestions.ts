/**
 * DEF 3.0.3 §3 — a Inteligência Artificial deixa de ser um módulo do CRM
 * e passa a ser uma ferramenta de escrita dentro da própria conversa.
 *
 * As sugestões são geradas a partir do contexto real do atendimento
 * (nome do investidor, estado da janela de 24h e última mensagem) e são
 * apenas inseridas na caixa de mensagem: nada é enviado automaticamente.
 */
export type CrmAiSuggestion = {
  id: string;
  label: string;
  text: string;
};

const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "";

export function buildCrmAiSuggestions(input: {
  investorName: string;
  windowOpen: boolean;
  lastInboundBody?: string | null;
}): CrmAiSuggestion[] {
  const n = first(input.investorName);
  const greeting = n ? `${n}, ` : "";

  const base: CrmAiSuggestion[] = [
    {
      id: "abertura",
      label: "Abertura cordial",
      text: `Olá${n ? `, ${n}` : ""}! Sou Executivo de Expansão da Velox e sigo acompanhando o seu processo. Posso esclarecer alguma dúvida sobre o modelo de franquia?`,
    },
    {
      id: "duvidas",
      label: "Esclarecer dúvidas",
      text: `${greeting}fico à disposição para explicar com calma qualquer ponto do Manual do Investidor — investimento, produtos, treinamento ou suporte. O que faz mais sentido começarmos?`,
    },
    {
      id: "proximo_passo",
      label: "Propor próximo passo",
      text: `${greeting}o próximo passo natural é uma conversa on-line de cerca de 30 minutos para apresentar o modelo em detalhes. Me diga um dia e horário confortáveis para você.`,
    },
    {
      id: "acompanhamento",
      label: "Acompanhamento leve",
      text: `${greeting}passando para saber se conseguiu avaliar o material. Sigo à disposição, sem qualquer compromisso e no seu tempo.`,
    },
    {
      id: "transparencia",
      label: "Reforçar transparência",
      text: `${greeting}nosso objetivo aqui é que você tenha todas as informações antes de qualquer decisão: valores, obrigações e suporte são apresentados de forma transparente.`,
    },
  ];

  if (input.lastInboundBody?.trim()) {
    base.unshift({
      id: "resposta_contextual",
      label: "Responder última mensagem",
      text: `${greeting}obrigado pela sua mensagem. Sobre o que você comentou, posso detalhar cada ponto e enviar as informações complementares ainda hoje.`,
    });
  }

  if (!input.windowOpen) {
    return base.filter((s) => s.id !== "resposta_contextual");
  }
  return base;
}
