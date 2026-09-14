export type InvestorProfileKey = "EXPLORADOR" | "ANALITICO" | "HIBRIDO" | "PREPARADOR" | "CONSTRUTOR";

export type SelfAssessmentAnswer = {
  tag: string;
  question: string;
  answer: string;
  optionIndex: number;
  points: 0 | 1 | 2;
};

export type PersistedInvestorProfile = {
  version: 1;
  commercial?: {
    audience: "pf" | "pj" | "ambos" | null;
    interests: string[];
    capturedAt: string;
  };
  selfAssessment?: {
    answers: SelfAssessmentAnswer[];
    score: number;
    profileKey: InvestorProfileKey;
    capturedAt: string;
  };
};

export const SELF_ASSESSMENT_QUESTIONS = [
  { tag: "objetivos", question: "O que mais te aproxima da ideia de empreender com a Velox neste momento?", options: ["Construir um negócio próprio com propósito de longo prazo", "Diversificar minha atuação profissional", "Ainda estou explorando possibilidades"] },
  { tag: "implantacao", question: "Como você enxerga a fase inicial de implantação e treinamento?", options: ["Encaro como parte essencial da construção do negócio", "Consigo me organizar para dedicar esse período", "Precisaria conversar com um consultor para planejar melhor"] },
  { tag: "consultivo", question: "Qual é a sua afinidade com um modelo de trabalho consultivo?", options: ["Tenho boa afinidade com atendimento e relacionamento", "Não tenho experiência, mas gostaria de desenvolver", "Prefiro entender melhor antes de me posicionar"] },
  { tag: "metodologia", question: "Como você se sente em seguir uma metodologia já estruturada?", options: ["Faz total sentido para reduzir erros e ganhar tempo", "Gosto de seguir método, adaptando ao meu estilo", "Prefiro construir minha própria forma de trabalhar"] },
  { tag: "patrimonio", question: "Qual é a sua visão sobre construir patrimônio por meio de um negócio próprio?", options: ["Vejo como um dos caminhos mais consistentes", "É uma possibilidade que estou avaliando com calma", "Ainda estou formando minha visão sobre isso"] },
  { tag: "momento", question: "Como você descreveria o seu momento atual para iniciar um investimento?", options: ["Já é um momento adequado para dar um próximo passo", "Preciso planejar alguns detalhes antes", "Estou em fase de estudo e ainda sem definição"] },
  { tag: "conversa", question: "Após esta leitura, qual é o seu interesse em continuar a conversa?", options: ["Gostaria de conversar com um especialista Velox", "Gostaria de aprofundar mais alguns pontos antes", "Ainda estou apenas conhecendo o modelo"] },
] as const;

export const PROFILE_TEXT: Record<InvestorProfileKey, string> = {
  EXPLORADOR: "Está em uma fase inicial de exploração e prefere compreender melhor o modelo antes de assumir uma posição. O momento pede informação clara e espaço para reflexão.",
  ANALITICO: "Demonstra interesse, mas tende a avaliar os detalhes antes de avançar. A abordagem deve priorizar clareza, segurança e aprofundamento dos pontos que ainda geram dúvida.",
  HIBRIDO: "Apresenta equilíbrio entre interesse e cautela. Demonstra abertura para avançar, mas ainda valoriza compreender alguns pontos antes de tomar uma decisão.",
  PREPARADOR: "Demonstra boa disposição para empreender e avançar, embora ainda considere importante organizar alguns pontos antes do próximo passo. A abordagem pode ser objetiva, sem pressão.",
  CONSTRUTOR: "Demonstra forte orientação para construção do negócio e boa disposição para avançar. A conversa pode partir dos aspectos práticos e dos próximos passos, preservando o caráter consultivo.",
};

export function profileKeyForScore(score: number): InvestorProfileKey {
  if (score <= 2) return "EXPLORADOR";
  if (score <= 5) return "ANALITICO";
  if (score <= 8) return "HIBRIDO";
  if (score <= 11) return "PREPARADOR";
  return "CONSTRUTOR";
}

export function scoreSelfAssessment(selected: readonly number[]) {
  if (selected.length !== SELF_ASSESSMENT_QUESTIONS.length) throw new Error("Todas as respostas da autoavaliação são obrigatórias.");
  const answers: SelfAssessmentAnswer[] = SELF_ASSESSMENT_QUESTIONS.map((item, index) => {
    const optionIndex = selected[index];
    if (optionIndex !== 0 && optionIndex !== 1 && optionIndex !== 2) throw new Error("Resposta inválida na autoavaliação.");
    return { tag: item.tag, question: item.question, answer: item.options[optionIndex], optionIndex, points: (2 - optionIndex) as 0 | 1 | 2 };
  });
  const score = answers.reduce((sum, item) => sum + item.points, 0);
  return { answers, score, profileKey: profileKeyForScore(score) };
}

export function selfAssessmentIntention(profile?: PersistedInvestorProfile | null): string | null {
  return profile?.selfAssessment?.answers.find((item) => item.tag === "conversa")?.answer ?? null;
}

export function audienceLabel(audience?: "pf" | "pj" | "ambos" | null): string {
  return audience === "pf" ? "Pessoa Física" : audience === "pj" ? "Pessoa Jurídica" : audience === "ambos" ? "Ambos" : "Não informado";
}

export function mergeInvestorProfileJourney(
  journey: Record<string, unknown>,
  patch: Pick<PersistedInvestorProfile, "commercial" | "selfAssessment">,
): Record<string, unknown> {
  const current = journey["investorProfile"];
  const existing = current && typeof current === "object" && !Array.isArray(current)
    ? (current as Record<string, unknown>) : {};
  return {
    ...journey,
    investorProfile: {
      ...existing,
      version: 1,
      ...(patch.commercial ? { commercial: patch.commercial } : {}),
      ...(patch.selfAssessment ? { selfAssessment: patch.selfAssessment } : {}),
    },
  };
}