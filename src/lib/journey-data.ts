export type Chapter = {
  slug: string;
  index: number;
  path: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  minutesLeft: number;
  seoTitle: string;
  seoDescription: string;
  transitionFromPrev?: string;
  completionLine?: string;
  nextTeaser?: string;
  hasVideo?: boolean;
  prevPath?: string;
  nextPath?: string;
  continueLabel?: string;
  isFinal?: boolean;
};

export const CHAPTERS: Chapter[] = [
  {
    slug: "recepcao",
    index: 1,
    path: "/",
    eyebrow: "Capítulo 1 · Recepção",
    title: "Bem-vindo. Você está prestes a conhecer, em detalhes, o que muita gente decide sem saber.",
    subtitle:
      "Nos próximos 8 minutos, apresentamos a franquia Velox como uma conversa. Sem pressa. Sem venda. No final, você mesmo decide se faz sentido.",
    minutesLeft: 8,
    seoTitle: "Manual do Investidor Velox — Uma apresentação guiada",
    seoDescription:
      "Conheça a franquia Velox em uma jornada guiada de 8 minutos. Educação primeiro, decisão consciente depois.",
    hasVideo: true,
    nextPath: "/manual/velox",
    nextTeaser: "A seguir: quem está por trás da Velox.",
    continueLabel: "Começar a jornada",
  },
  {
    slug: "velox",
    index: 2,
    path: "/manual/velox",
    eyebrow: "Capítulo 2 · Quem é a Velox",
    title: "Antes de falar sobre franquia, deixa a gente contar quem somos.",
    subtitle:
      "História, propósito e o que nos move — apresentados com respeito ao seu tempo.",
    minutesLeft: 7,
    seoTitle: "Quem é a Velox — Manual do Investidor",
    seoDescription:
      "Conheça a história, o propósito e a estrutura da Velox Soluções Financeiras.",
    transitionFromPrev: "Toda escolha começa por entender quem está do outro lado.",
    completionLine: "Você já conhece quem está por trás da Velox.",
    nextTeaser: "A seguir: por que este mercado, e por que agora.",
    prevPath: "/",
    nextPath: "/manual/mercado",
  },
  {
    slug: "mercado",
    index: 3,
    path: "/manual/mercado",
    eyebrow: "Capítulo 3 · O mercado",
    title: "Toda oportunidade começa com um contexto. Vamos entender o seu.",
    subtitle:
      "O tamanho, a demanda e as forças que sustentam o mercado de soluções financeiras no Brasil.",
    minutesLeft: 6,
    seoTitle: "O mercado — Manual do Investidor Velox",
    seoDescription:
      "O contexto real do mercado financeiro brasileiro e a oportunidade para franqueados.",
    transitionFromPrev: "Agora que você conhece a empresa, vamos ao cenário em que ela opera.",
    completionLine: "Você viu o cenário. Existe demanda real.",
    nextTeaser: "A seguir: como a franquia Velox funciona, na prática.",
    prevPath: "/manual/velox",
    nextPath: "/manual/modelo",
  },
  {
    slug: "modelo",
    index: 4,
    path: "/manual/modelo",
    eyebrow: "Capítulo 4 · O modelo de negócio",
    title: "Agora que o cenário está claro, vamos ao mais importante: como isso funciona na prática.",
    subtitle:
      "O fluxo entre cliente, franqueado, Velox e parceiros homologados — em passos simples.",
    minutesLeft: 5,
    seoTitle: "Como funciona a franquia Velox — Manual do Investidor",
    seoDescription:
      "Entenda o fluxo de operação da franquia Velox: cliente, franqueado, Velox e parceiros.",
    transitionFromPrev: "Contexto entendido. Vamos ver a engrenagem por dentro.",
    completionLine: "Você entende o modelo.",
    nextTeaser: "A seguir: o que torna a Velox diferente das demais opções.",
    prevPath: "/manual/mercado",
    nextPath: "/manual/diferenciais",
    hasVideo: true,
  },
  {
    slug: "diferenciais",
    index: 5,
    path: "/manual/diferenciais",
    eyebrow: "Capítulo 5 · Diferenciais",
    title: "O que a Velox oferece — e o que nem toda franquia entrega.",
    subtitle: "Quatro pilares que sustentam a operação de cada franqueado.",
    minutesLeft: 4,
    seoTitle: "Diferenciais da Velox — Manual do Investidor",
    seoDescription:
      "Treinamento, tecnologia, portfólio e suporte: os quatro pilares da operação Velox.",
    transitionFromPrev: "Modelo entendido. Agora, o que sustenta esse modelo por dentro.",
    completionLine: "Você conhece a estrutura por trás da operação.",
    nextTeaser: "A seguir: a pergunta mais importante — isso é para você?",
    prevPath: "/manual/modelo",
    nextPath: "/manual/perfil",
  },
  {
    slug: "perfil",
    index: 6,
    path: "/manual/perfil",
    eyebrow: "Capítulo 6 · Perfil do franqueado",
    title: "Franquia não é para todo mundo. E tudo bem.",
    subtitle: "Um momento honesto de reflexão sobre seu perfil e o momento da sua vida.",
    minutesLeft: 3,
    seoTitle: "Perfil do franqueado — Manual do Investidor Velox",
    seoDescription:
      "Reflita, com honestidade, se este é o momento certo para você iniciar uma franquia.",
    transitionFromPrev: "Você já viu a estrutura. Agora é hora de olhar para dentro.",
    completionLine: "Você refletiu sobre seu perfil.",
    nextTeaser: "A seguir: algo que muita gente evita falar cedo — o investimento.",
    prevPath: "/manual/diferenciais",
    nextPath: "/manual/investimento",
  },
  {
    slug: "investimento",
    index: 7,
    path: "/manual/investimento",
    eyebrow: "Capítulo 7 · Investimento",
    title: "Aqui está a parte que a maioria esconde. Nós preferimos começar por ela.",
    subtitle: "Cada item do investimento, com o que ele cobre e por que existe.",
    minutesLeft: 3,
    seoTitle: "Investimento na franquia Velox — Manual do Investidor",
    seoDescription:
      "Transparência total sobre os custos envolvidos em uma franquia Velox.",
    transitionFromPrev: "Reflexão feita. Hora dos números — sem letra pequena.",
    completionLine: "Você conhece os valores envolvidos.",
    nextTeaser: "A seguir: como sair do zero e colocar tudo isso de pé.",
    prevPath: "/manual/perfil",
    nextPath: "/manual/implantacao",
  },
  {
    slug: "implantacao",
    index: 8,
    path: "/manual/implantacao",
    eyebrow: "Capítulo 8 · Implantação",
    title: "Do sim ao primeiro cliente: um caminho previsível.",
    subtitle: "As etapas semana a semana até você estar operando.",
    minutesLeft: 2,
    seoTitle: "Implantação da franquia Velox — Manual do Investidor",
    seoDescription:
      "O passo a passo, semana a semana, da implantação de uma franquia Velox.",
    transitionFromPrev: "Números entendidos. Agora, o caminho até você começar.",
    completionLine: "Você viu como sai do zero.",
    nextTeaser: "A seguir: como é o dia a dia depois de tudo pronto.",
    prevPath: "/manual/investimento",
    nextPath: "/manual/rotina",
  },
  {
    slug: "rotina",
    index: 9,
    path: "/manual/rotina",
    eyebrow: "Capítulo 9 · Rotina",
    title: "Como é, de verdade, o dia a dia de um franqueado Velox.",
    subtitle: "Sem idealizações. Uma agenda real, com o que muda e o que se repete.",
    minutesLeft: 2,
    seoTitle: "Rotina do franqueado Velox — Manual do Investidor",
    seoDescription:
      "A rotina real de um franqueado Velox — manhã, tarde, semana e mês.",
    transitionFromPrev: "Implantação clara. Vamos ao dia depois da implantação.",
    completionLine: "Você consegue se imaginar nessa rotina.",
    nextTeaser: "A seguir: as dúvidas que geralmente ficam para o fim.",
    prevPath: "/manual/implantacao",
    nextPath: "/manual/faq",
  },
  {
    slug: "faq",
    index: 10,
    path: "/manual/faq",
    eyebrow: "Capítulo 10 · Perguntas frequentes",
    title: "As perguntas que ainda podem estar na sua cabeça.",
    subtitle: "Respostas curtas, diretas e honestas — sem rodeios comerciais.",
    minutesLeft: 1,
    seoTitle: "Perguntas frequentes — Manual do Investidor Velox",
    seoDescription:
      "As dúvidas mais comuns sobre a franquia Velox, respondidas com clareza.",
    transitionFromPrev: "Rotina clara. Últimas nuvens antes do próximo passo.",
    completionLine: "Suas dúvidas foram respondidas.",
    nextTeaser: "A seguir: o último capítulo. E a decisão é sua.",
    prevPath: "/manual/rotina",
    nextPath: "/manual/proximos-passos",
  },
  {
    slug: "proximos-passos",
    index: 11,
    path: "/manual/proximos-passos",
    eyebrow: "Capítulo 11 · Próximos passos",
    title: "Você chegou até aqui. Isso já diz muito sobre você.",
    subtitle:
      "A próxima conversa não é uma venda. É uma avaliação mútua — para você decidir com base em fatos, não em impressões.",
    minutesLeft: 1,
    seoTitle: "Próximos passos — Manual do Investidor Velox",
    seoDescription:
      "Agora que você entende o modelo, converse com um especialista Velox.",
    transitionFromPrev: "Você viu tudo. Agora, o convite.",
    hasVideo: true,
    prevPath: "/manual/faq",
    isFinal: true,
  },
];

export const TOTAL_CHAPTERS = CHAPTERS.filter((c) => !c.isFinal || c.index === 11).length;

export function getChapter(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

export function getChapterByPath(path: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.path === path);
}

export const WHATSAPP_NUMBER = "5517997727337";
