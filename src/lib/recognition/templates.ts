/**
 * Templates de reconhecimento — camada White Label.
 *
 * Cada tipo de evento possui um pool de redações. A cada exibição sorteamos
 * uma variação para evitar sensação robótica, mantendo tom humano, elegante,
 * respeitoso e inspirador. Para eventos de nível (campanha) as mensagens
 * variam conforme o patamar atingido (Mestre, Doutor, PhD, Supreme).
 */
import type { RecognitionEvent, RecognitionType } from "./engine";

export type RecognitionTemplate = {
  emoji: string;
  title: string;
  message: string;
  ctaLabel: string;
  /** Cor de destaque do modal (fallback: dourado do workspace ativo). */
  accent?: string;
  /** Variante visual — "quiet" evita clima de celebração (uso operacional). */
  variant?: "celebration" | "quiet";
};

type Pool = {
  emoji: string;
  titles: string[];
  messages: string[];
  ctaLabel: string;
  variant?: "celebration" | "quiet";
};

const POOLS: Record<Exclude<RecognitionType, "campaign_level">, Pool> = {
  birthday: {
    emoji: "🎉",
    titles: [
      "Feliz aniversário!",
      "Um novo ciclo se abre",
      "Que este dia seja seu",
      "Um brinde à sua caminhada",
    ],
    messages: [
      "Toda a equipe deseja um ciclo novo com saúde, tranquilidade e boas realizações.\n\nObrigado por caminhar com a gente.",
      "Que o próximo ano seja generoso com você, tão generoso quanto você é com quem caminha ao seu lado.\n\nParabéns.",
      "Hoje o time para para agradecer a sua presença — pelo cuidado, pela dedicação e por tudo que constrói silenciosamente todos os dias.",
      "Um dia especial pede uma pausa. Aproveite com quem importa; a gente cuida do resto por aqui hoje.",
    ],
    ctaLabel: "Continuar",
  },
  tenure: {
    emoji: "🏅",
    titles: [
      "Uma nova marca de tempo com a gente",
      "Mais um ciclo caminhando junto",
      "Um marco discreto — e importante",
    ],
    messages: [
      "Obrigado pelo tempo dedicado e pelo cuidado no dia a dia. Que este próximo ciclo seja leve.",
      "Tempo constrói confiança. Obrigado por seguir construindo o time com a gente.",
      "O que se faz com constância, dura. Obrigado por essa constância.",
    ],
    ctaLabel: "Continuar",
  },
  first_sale: {
    emoji: "🚀",
    titles: [
      "Primeira venda registrada",
      "O primeiro passo aconteceu",
      "Um marco da sua jornada",
    ],
    messages: [
      "Um passo importante da sua jornada. Seguimos com você nos próximos.",
      "A primeira venda tem um lugar especial. Que venha com o mesmo cuidado nas próximas.",
      "O começo é sempre o mais difícil. Obrigado por confiar no processo.",
    ],
    ctaLabel: "Continuar",
  },
  best_month: {
    emoji: "🌟",
    titles: [
      "Um mês que merece reconhecimento",
      "Um ciclo bonito de olhar",
      "Consistência que se destaca",
    ],
    messages: [
      "Sua consistência ajudou a equipe neste ciclo. Obrigado pelo cuidado.",
      "Resultados assim nascem de escolhas simples repetidas todos os dias. Obrigado.",
      "Um mês que se destaca é sempre a soma de muitas conversas boas. Parabéns.",
    ],
    ctaLabel: "Continuar",
  },
  promotion: {
    emoji: "🎓",
    titles: [
      "Um novo momento da sua trajetória",
      "Uma etapa nova se abre",
    ],
    messages: [
      "Uma etapa nova se abre. Estamos com você nesse próximo passo.",
      "Confiamos em quem constrói com cuidado. Que este novo capítulo seja de descobertas boas.",
    ],
    ctaLabel: "Continuar",
  },
  kpi_pending: {
    emoji: "📋",
    titles: [
      "Lembrete rápido do KPI",
      "Um aviso tranquilo sobre o KPI",
      "KPI aguardando atualização",
    ],
    messages: [
      "Alguns indicadores ainda não foram lançados. Os dados do KPI alimentam o Brain Analytics, os relatórios e as análises da IA Corporativa — atualizar quando possível ajuda o time a enxergar o cenário real.",
      "Assim que puder, registre os indicadores pendentes. Quanto mais completos os lançamentos, mais confiáveis ficam os relatórios e as análises que sustentam decisões.",
      "O KPI é a fonte oficial de dados da operação. Manter os lançamentos em dia fortalece o Brain Analytics e permite leituras mais precisas para todos.",
    ],
    ctaLabel: "Abrir KPI Manager",
    variant: "quiet",
  },
  first_month: {
    emoji: "🌱",
    titles: [
      "Seu primeiro mês com a gente",
      "Um mês de descobertas",
    ],
    messages: [
      "Foi um mês de descobertas, ajustes e primeiros passos. Obrigado pela dedicação em aprender o nosso jeito de trabalhar.\n\nQue os próximos ciclos sejam de crescimento tranquilo.",
      "Começar exige coragem. Obrigado por chegar até aqui com atenção e cuidado — os próximos meses serão construídos junto.",
    ],
    ctaLabel: "Continuar",
  },
  company_anniversary: {
    emoji: "🎂",
    titles: [
      "Um novo aniversário de casa",
      "Mais um ciclo caminhando ao nosso lado",
    ],
    messages: [
      "Mais um ciclo caminhando ao nosso lado. Preparamos uma tela para revisitar o que essa trajetória construiu.",
      "Tempo de casa é confiança acumulada. Vamos revisitar juntos esse trajeto.",
    ],
    ctaLabel: "Abrir celebração",
  },
  tenure_milestone: {
    emoji: "🌳",
    titles: [
      "Um marco importante da sua trajetória",
      "Anos que constroem história",
    ],
    messages: [
      "Anos de dedicação constroem histórias que valem ser lembradas. Obrigado por seguir caminhando com a gente com o mesmo cuidado.",
      "Marcas de tempo assim não são comuns. Obrigado pela presença que atravessa ciclos.",
    ],
    ctaLabel: "Continuar",
  },
  custom: {
    emoji: "✨",
    titles: ["Reconhecimento"],
    messages: ["Um reconhecimento da equipe para você."],
    ctaLabel: "Continuar",
  },
};

type CampaignLevel = "mestre" | "doutor" | "phd" | "supreme";

const CAMPAIGN_POOLS: Record<CampaignLevel, Pool> = {
  mestre: {
    emoji: "🥉",
    titles: [
      "Nível Mestre atingido",
      "Você chegou ao patamar Mestre",
    ],
    messages: [
      "O primeiro grande degrau da campanha foi conquistado. Um marco bonito — construído com constância e escuta.",
      "Ser Mestre é mostrar que o processo funciona. Obrigado pelo cuidado até aqui; o próximo nível já está no horizonte.",
    ],
    ctaLabel: "Continuar",
  },
  doutor: {
    emoji: "🥈",
    titles: [
      "Nível Doutor conquistado",
      "Você alcançou Doutor",
    ],
    messages: [
      "Chegar ao nível Doutor é resultado de escolhas consistentes, semana após semana. Um marco que orgulha a equipe.",
      "Doutor é para quem transformou disciplina em estilo de trabalho. Parabéns pela caminhada.",
    ],
    ctaLabel: "Continuar",
  },
  phd: {
    emoji: "🥇",
    titles: [
      "Nível PhD atingido",
      "Um patamar de referência: PhD",
    ],
    messages: [
      "PhD é palavra que vem de dedicação. Sua trajetória vira referência para quem chega — obrigado por elevar o padrão do time.",
      "Poucas jornadas alcançam este nível. Parabéns pelo cuidado, pela constância e pela inspiração que isso gera nos demais.",
    ],
    ctaLabel: "Continuar",
  },
  supreme: {
    emoji: "👑",
    titles: [
      "Nível Supreme alcançado",
      "Você chegou ao topo: Supreme",
    ],
    messages: [
      "Supreme é o mais alto reconhecimento da campanha. Uma trajetória construída com constância, escuta e respeito — que serve de inspiração para todo o time.",
      "Chegar ao Supreme é raro. Obrigado por transformar disciplina em resultado, e resultado em referência para os próximos.",
    ],
    ctaLabel: "Continuar",
  },
};

function pick<T>(list: T[]): T {
  if (list.length === 0) throw new Error("Pool vazio");
  return list[Math.floor(Math.random() * list.length)];
}

export function templateFor(event: RecognitionEvent): RecognitionTemplate {
  if (event.type === "campaign_level") {
    const level = (event.payload?.level as CampaignLevel | undefined) ?? "mestre";
    const pool = CAMPAIGN_POOLS[level] ?? CAMPAIGN_POOLS.mestre;
    return {
      emoji: pool.emoji,
      title: pick(pool.titles),
      message: pick(pool.messages),
      ctaLabel: pool.ctaLabel,
      variant: pool.variant,
    };
  }
  const pool = POOLS[event.type as Exclude<RecognitionType, "campaign_level">] ?? POOLS.custom;
  return {
    emoji: pool.emoji,
    title: pick(pool.titles),
    message: pick(pool.messages),
    ctaLabel: pool.ctaLabel,
    variant: pool.variant,
  };
}