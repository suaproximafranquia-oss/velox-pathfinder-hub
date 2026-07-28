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
    path: "/manual",
    eyebrow: "Capítulo 1 · Boas-vindas",
    title: "Bem-vindo ao Manual do Investidor Velox.",
    subtitle:
      "Este é um material de leitura — não uma página de venda. Nossa intenção é apresentar, com clareza, como funciona uma franquia Velox, para que você tenha os elementos necessários antes de qualquer conversa.",
    minutesLeft: 10,
    seoTitle: "Manual do Investidor Velox — Uma apresentação guiada",
    seoDescription:
      "Um manual digital para conhecer a franquia Velox com transparência — antes de qualquer conversa comercial.",
    hasVideo: true,
    nextPath: "/manual/proposito",
    nextTeaser: "A seguir: por que criamos este Manual.",
    continueLabel: "Iniciar a leitura",
  },
  {
    slug: "proposito",
    index: 2,
    path: "/manual/proposito",
    eyebrow: "Capítulo 2 · Por que este Manual existe",
    title: "Acreditamos que uma boa decisão começa por uma boa leitura.",
    subtitle:
      "Este Manual foi escrito para preparar você — não para convencer. Ao final, deve existir clareza suficiente para que você mesmo avalie se faz sentido dar o próximo passo.",
    minutesLeft: 9,
    seoTitle: "Por que este Manual existe — Manual do Investidor Velox",
    seoDescription:
      "A proposta do Manual do Investidor Velox: informar com clareza antes de qualquer conversa comercial.",
    transitionFromPrev: "Antes de falar sobre a Velox, uma palavra sobre o próprio Manual.",
    completionLine: "Você compreende a intenção deste material.",
    nextTeaser: "A seguir: quem é a Velox.",
    prevPath: "/manual",
    nextPath: "/manual/velox",
  },
  {
    slug: "velox",
    index: 3,
    path: "/manual/velox",
    eyebrow: "Capítulo 3 · Quem é a Velox",
    title: "Uma rede consolidada de soluções financeiras.",
    subtitle:
      "Antes de falar sobre franquia, é justo apresentar quem está por trás dela — nosso propósito, nossa forma de trabalhar e a escala que já sustenta a operação.",
    minutesLeft: 8,
    seoTitle: "Quem é a Velox — Manual do Investidor",
    seoDescription:
      "Conheça o propósito e a estrutura da Velox — hoje com mais de 1.400 unidades comercializadas em todo o Brasil.",
    transitionFromPrev: "Toda escolha começa por entender quem está do outro lado.",
    completionLine: "Você já conhece quem está por trás da Velox.",
    nextTeaser: "A seguir: como funciona o modelo de negócio.",
    prevPath: "/manual/proposito",
    nextPath: "/manual/modelo",
  },
  {
    slug: "modelo",
    index: 4,
    path: "/manual/modelo",
    eyebrow: "Capítulo 4 · O modelo de negócio",
    title: "Uma franquia de serviços — não de estoque.",
    subtitle:
      "A Velox conecta clientes às soluções oferecidas por parceiros homologados, atuando de forma consultiva durante todo o processo. O franqueado trabalha sem estoque, com receita vinculada às operações concretizadas.",
    minutesLeft: 7,
    seoTitle: "Como funciona a franquia Velox — Manual do Investidor",
    seoDescription:
      "O modelo de negócio da franquia Velox: consultoria de soluções financeiras, sem estoque, com portfólio homologado.",
    transitionFromPrev: "Conhecida a empresa, vamos ao modelo.",
    completionLine: "Você entende o modelo econômico da franquia.",
    nextTeaser: "A seguir: os produtos e soluções ofertados.",
    prevPath: "/manual/velox",
    nextPath: "/manual/produtos",
  },
  {
    slug: "produtos",
    index: 5,
    path: "/manual/produtos",
    eyebrow: "Capítulo 5 · Produtos e soluções",
    title: "Um portfólio amplo, homologado e continuamente atualizado.",
    subtitle:
      "Cada franqueado atende diferentes necessidades a partir de uma mesma base de clientes — o que dá estabilidade e diversificação à operação.",
    minutesLeft: 6,
    seoTitle: "Produtos e soluções — Manual do Investidor Velox",
    seoDescription:
      "As categorias de soluções financeiras oferecidas por uma franquia Velox — sempre por meio de parceiros homologados.",
    transitionFromPrev: "Modelo entendido. Agora, o que existe dentro do portfólio.",
    completionLine: "Você conhece as principais categorias de solução.",
    nextTeaser: "A seguir: personalize sua jornada.",
    prevPath: "/manual/modelo",
    nextPath: "/manual/personalizando-sua-jornada",
  },
  {
    slug: "personalizando-sua-jornada",
    index: 6,
    path: "/manual/personalizando-sua-jornada",
    eyebrow: "Capítulo 6 · Personalizando sua jornada",
    title: "Personalize a leitura de acordo com o seu interesse.",
    subtitle:
      "Agora que você conheceu o portfólio da Velox, queremos entender um pouco melhor quais soluções despertaram sua curiosidade. Não existe resposta certa ou errada — essas informações servirão apenas para que seu especialista prepare uma conversa mais objetiva e alinhada ao seu perfil.",
    minutesLeft: 6,
    seoTitle: "Personalizando sua jornada — Manual do Investidor Velox",
    seoDescription:
      "Sinalize os interesses que mais fazem sentido para você e receba uma conversa personalizada com o especialista Velox.",
    transitionFromPrev: "Portfólio apresentado. Agora, uma personalização discreta.",
    completionLine: "Suas preferências foram registradas com carinho.",
    nextTeaser: "A seguir: como acontece a operação.",
    prevPath: "/manual/produtos",
    nextPath: "/manual/operacao",
  },
  {
    slug: "operacao",
    index: 7,
    path: "/manual/operacao",
    eyebrow: "Capítulo 7 · Como acontece a operação",
    title: "Do primeiro contato à solução entregue.",
    subtitle:
      "O fluxo entre cliente, franqueado, Velox e parceiros homologados — apresentado em passos simples, sem prescrever uma rotina única para todos.",
    minutesLeft: 5,
    seoTitle: "Como acontece a operação — Manual do Investidor Velox",
    seoDescription:
      "O fluxo consultivo de uma operação Velox — do contato inicial à concretização junto ao parceiro.",
    transitionFromPrev: "Preferências registradas. Agora, a prática.",
    completionLine: "Você compreende como uma operação se realiza.",
    nextTeaser: "A seguir: o investimento para começar.",
    prevPath: "/manual/personalizando-sua-jornada",
    nextPath: "/manual/investimento",
    hasVideo: true,
  },
  {
    slug: "investimento",
    index: 8,
    path: "/manual/investimento",
    eyebrow: "Capítulo 8 · Investimento",
    title: "Os valores, apresentados com clareza.",
    subtitle:
      "Preferimos mostrar os números antes da conversa comercial. Assim, você avalia com tranquilidade se faz sentido para o seu momento.",
    minutesLeft: 4,
    seoTitle: "Investimento na franquia Velox — Manual do Investidor",
    seoDescription:
      "Transparência sobre os valores oficiais envolvidos em uma franquia Velox.",
    transitionFromPrev: "Compreendida a operação, os números.",
    completionLine: "Você conhece os valores oficiais envolvidos.",
    nextTeaser: "A seguir: como funciona o treinamento.",
    prevPath: "/manual/operacao",
    nextPath: "/manual/treinamento",
  },
  {
    slug: "treinamento",
    index: 9,
    path: "/manual/treinamento",
    eyebrow: "Capítulo 9 · Treinamento",
    title: "Do contrato ao início da operação.",
    subtitle:
      "Após a assinatura, acontece a implantação. Em seguida, o treinamento obrigatório com duração de duas semanas. Concluído o treinamento, o franqueado inicia sua operação.",
    minutesLeft: 3,
    seoTitle: "Treinamento — Manual do Investidor Velox",
    seoDescription:
      "Como funciona o treinamento obrigatório da franquia Velox — a preparação antes do início da operação.",
    transitionFromPrev: "Números entendidos. Agora, a preparação.",
    completionLine: "Você sabe como acontece a preparação do franqueado.",
    nextTeaser: "A seguir: o suporte contínuo após o início.",
    prevPath: "/manual/investimento",
    nextPath: "/manual/suporte",
  },
  {
    slug: "suporte",
    index: 10,
    path: "/manual/suporte",
    eyebrow: "Capítulo 10 · Suporte contínuo",
    title: "O franqueado nunca opera sozinho.",
    subtitle:
      "Após o início da operação, cada franqueado é acompanhado por um consultor de negócios e conta com a Universidade Corporativa e o suporte estruturado da rede.",
    minutesLeft: 3,
    seoTitle: "Suporte — Manual do Investidor Velox",
    seoDescription:
      "O suporte contínuo oferecido pela Velox aos franqueados — consultoria de negócios, Universidade Corporativa e rede.",
    transitionFromPrev: "Treinamento é a partida. O suporte é o percurso.",
    completionLine: "Você conhece o suporte que acompanha cada operação.",
    nextTeaser: "A seguir: o perfil ideal do franqueado.",
    prevPath: "/manual/treinamento",
    nextPath: "/manual/perfil",
  },
  {
    slug: "perfil",
    index: 11,
    path: "/manual/perfil",
    eyebrow: "Capítulo 11 · Perfil ideal do franqueado",
    title: "Como identificar se este modelo combina com você.",
    subtitle:
      "Não existe um perfil único. Existem características que costumam favorecer a jornada de um franqueado — e reconhecê-las ajuda você a fazer uma avaliação honesta sobre o seu próprio momento.",
    minutesLeft: 2,
    seoTitle: "Perfil do franqueado — Manual do Investidor Velox",
    seoDescription:
      "Reflita sobre o perfil que se adapta bem ao modelo de franquia Velox.",
    transitionFromPrev: "Suporte compreendido. Agora, um olhar para dentro.",
    completionLine: "Você conhece o perfil que costuma se adaptar bem.",
    nextTeaser: "A seguir: perguntas frequentes.",
    prevPath: "/manual/suporte",
    nextPath: "/manual/faq",
  },
  {
    slug: "faq",
    index: 12,
    path: "/manual/faq",
    eyebrow: "Capítulo 12 · Perguntas frequentes",
    title: "As perguntas que ainda podem estar na sua cabeça.",
    subtitle: "Respostas curtas, diretas e honestas — sem rodeios comerciais.",
    minutesLeft: 2,
    seoTitle: "Perguntas frequentes — Manual do Investidor Velox",
    seoDescription:
      "As dúvidas mais comuns sobre a franquia Velox, respondidas com clareza.",
    transitionFromPrev: "Perfil compreendido. Últimas dúvidas antes de uma reflexão pessoal.",
    completionLine: "Suas dúvidas foram respondidas.",
    nextTeaser: "A seguir: um breve exercício de autoavaliação.",
    prevPath: "/manual/perfil",
    nextPath: "/manual/autoavaliacao",
  },
  {
    slug: "autoavaliacao",
    index: 13,
    path: "/manual/autoavaliacao",
    eyebrow: "Capítulo 13 · Autoavaliação",
    title: "Um momento honesto — só com você.",
    subtitle:
      "Cinco perguntas curtas para você refletir sobre o próprio momento. Nada é enviado nem registrado; a reflexão é o resultado.",
    minutesLeft: 1,
    seoTitle: "Autoavaliação — Manual do Investidor Velox",
    seoDescription:
      "Um breve exercício de reflexão antes da conversa com um especialista Velox.",
    transitionFromPrev: "Antes do convite final, uma pausa para reflexão.",
    completionLine: "Você concluiu a autoavaliação.",
    nextTeaser: "A seguir: o convite para conversar.",
    prevPath: "/manual/faq",
    nextPath: "/manual/proximos-passos",
  },
  {
    slug: "proximos-passos",
    index: 14,
    path: "/manual/proximos-passos",
    eyebrow: "Capítulo 14 · Convite para conversar",
    title: "Você concluiu o Manual do Investidor Velox.",
    subtitle:
      "Chegar até aqui já é, em si, um posicionamento. Significa que você preferiu entender antes de decidir — e agora tem, em suas próprias palavras, uma leitura estruturada sobre como funciona uma franquia Velox.",
    minutesLeft: 1,
    seoTitle: "Convite para conversar — Manual do Investidor Velox",
    seoDescription:
      "Agora que você entende o modelo, converse com um especialista Velox.",
    transitionFromPrev: "Você concluiu o Manual. Agora, o convite.",
    hasVideo: true,
    prevPath: "/manual/autoavaliacao",
    isFinal: true,
  },
];

export const TOTAL_CHAPTERS = CHAPTERS.length;

export function getChapter(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

export function getChapterByPath(path: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.path === path);
}

export const WHATSAPP_NUMBER = "5517997727337";