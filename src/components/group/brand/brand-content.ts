/**
 * CONTEÚDO DAS PÁGINAS INSTITUCIONAIS DAS TRÊS MARCAS DO GRUPO VELOX
 * (`/financeira`, `/solar`, `/seguradora`).
 *
 * Fonte única de texto dessas páginas. Vale a mesma regra da landing do
 * Grupo: nada é inventado. Só entram fatos já confirmados no projeto
 * (rota `/`, `/universo`, `src/lib/journey-data.ts` e o briefing
 * institucional): sede em São José do Rio Preto, portfólio das três
 * frentes, +1.400 unidades comercializadas, +200 produtos e parceiros,
 * +180 tipos de seguros em +30 categorias.
 *
 * Números não confirmados (ano de fundação, quantidade de projetos,
 * volume financeiro) NÃO aparecem — entram depois, quando validados.
 *
 * Esta página é institucional: não abre Portal do Investidor, não cria
 * lead da Financeira, não inicia cadência. O formulário é o mesmo
 * `unit-interest-form.tsx`, gravando em `group_unit_leads`.
 */
import { assetUrl } from "@/lib/assets/registry";

export type BrandKey = "financeira" | "solar" | "seguros";

export type BrandSection = {
  id: string;
  label: string;
};

export type BrandContent = {
  key: BrandKey;
  /** Caminho público da página institucional. */
  path: string;
  name: string;
  shortName: string;
  logo: string;
  /** Cor de destaque da marca (identidade própria, família visual comum). */
  accent: string;
  accentSoft: string;
  seo: { title: string; description: string };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    image: string;
    imageAlt: string;
  };
  intro: { title: string; paragraphs: string[] };
  solutions: { title: string; subtitle: string; items: Array<{ name: string; text: string }> };
  pillars: { title: string; items: Array<{ title: string; text: string }> };
  showcase: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    image: string;
    imageAlt: string;
  };
  numbers: Array<{ value: string; label: string }>;
  cta: { title: string; text: string };
};

export const BRAND_SECTIONS: BrandSection[] = [
  { id: "inicio", label: "Início" },
  { id: "solucoes", label: "Soluções" },
  { id: "como-atuamos", label: "Como atuamos" },
  { id: "quero-conhecer", label: "Quero conhecer" },
];

export const BRANDS: Record<BrandKey, BrandContent> = {
  financeira: {
    key: "financeira",
    path: "/financeira",
    name: "Velox Soluções Financeiras",
    shortName: "Velox Financeira",
    logo: assetUrl("logo-velox-financeira"),
    accent: "#e8873a",
    accentSoft: "rgba(232,135,58,0.12)",
    seo: {
      title: "Velox Soluções Financeiras — crédito, consórcio e soluções para PF e PJ",
      description:
        "A frente de soluções financeiras do Grupo Velox: crédito, consórcio, financiamento e soluções empresariais com atendimento consultivo e informação clara.",
    },
    hero: {
      eyebrow: "Grupo Velox · Soluções Financeiras",
      titleLead: "Crédito com clareza,",
      titleAccent: "decisão com informação.",
      lead:
        "O núcleo da operação do Grupo Velox. Conectamos pessoas e empresas a bancos, fintechs, fundos e administradoras — com atendimento consultivo, sem promessa de retorno rápido.",
      image: assetUrl("foto-financeira-consultoria"),
      imageAlt: "Consultor da Velox Soluções Financeiras em atendimento a um cliente empresarial",
    },
    intro: {
      title: "A frente que originou o Grupo",
      paragraphs: [
        "A Velox Soluções Financeiras é o núcleo da operação do Grupo Velox. Nasceu para aproximar pessoas e empresas de um mercado que quase sempre chega difícil de entender: crédito, consórcio, financiamento e capital de giro apresentados em linguagem clara, com o custo e a condição na mesa desde a primeira conversa.",
        "O atendimento é consultivo e conduzido por pessoas. Cada cliente tem um responsável, cada etapa tem registro e cada proposta é comparada entre as instituições parceiras antes de qualquer recomendação.",
      ],
    },
    solutions: {
      title: "O que oferecemos",
      subtitle: "Soluções para pessoa física e pessoa jurídica, reunidas em um único atendimento.",
      items: [
        {
          name: "Crédito",
          text: "Crédito pessoal, consignado, home equity, antecipações e FGTS, com comparação entre instituições parceiras.",
        },
        {
          name: "Consórcio",
          text: "Cartas de crédito para imóveis, veículos, equipamentos e serviços, com administradoras parceiras.",
        },
        {
          name: "Financiamento",
          text: "Financiamento imobiliário, veicular e de equipamentos, com análise prévia de viabilidade.",
        },
        {
          name: "Soluções empresariais",
          text: "Capital de giro, maquininhas, recebíveis e estruturas de crédito para empresas de diferentes portes.",
        },
        {
          name: "Agronegócio",
          text: "Linhas voltadas ao produtor rural, com leitura de safra, garantias e prazos compatíveis.",
        },
        {
          name: "Seguros e proteção",
          text: "Acesso às soluções de proteção do Grupo, quando fazem sentido para o momento do cliente.",
        },
      ],
    },
    pillars: {
      title: "Como atuamos",
      items: [
        {
          title: "Confiança",
          text: "Informação completa antes da decisão: custo, prazo e condição explicados sem letra miúda.",
        },
        {
          title: "Proximidade",
          text: "Um responsável acompanha o cliente do primeiro contato ao pós-contratação.",
        },
        {
          title: "Resultado",
          text: "A recomendação parte da necessidade real, não do produto mais fácil de vender.",
        },
        {
          title: "Variedade",
          text: "Portfólio amplo, conectado a bancos, fintechs, fundos e administradoras de todo o país.",
        },
      ],
    },
    showcase: {
      eyebrow: "Estrutura",
      title: "Rede nacional com apoio central",
      paragraphs: [
        "A sede em São José do Rio Preto sustenta a rede com estrutura central de apoio operacional, jurídico e de marketing, além de formação inicial e continuada.",
        "São mais de 1.400 unidades comercializadas em todo o Brasil, com operações independentes e um mesmo padrão de atendimento e conduta.",
      ],
      image: assetUrl("sede-velox"),
      imageAlt: "Sede do Grupo Velox em São José do Rio Preto",
    },
    numbers: [
      { value: "+200", label: "Produtos e serviços" },
      { value: "+200", label: "Parceiros estratégicos" },
      { value: "+1.400", label: "Unidades comercializadas" },
    ],
    cta: {
      title: "Quero conhecer a Velox Soluções Financeiras",
      text: "Preencha os dados e um responsável entra em contato pelo WhatsApp. O contato é feito por uma pessoa — não existe disparo automático.",
    },
  },

  solar: {
    key: "solar",
    path: "/solar",
    name: "Velox Solar",
    shortName: "Velox Solar",
    logo: assetUrl("logo-velox-solar"),
    accent: "#3fae5a",
    accentSoft: "rgba(63,174,90,0.12)",
    seo: {
      title: "Velox Solar — energia solar, eficiência e projetos fotovoltaicos",
      description:
        "A frente de energia do Grupo Velox: projetos fotovoltaicos residenciais, comerciais, rurais e usinas, com engenharia própria e previsibilidade de custos.",
    },
    hero: {
      eyebrow: "Grupo Velox · Energia",
      titleLead: "Energia própria,",
      titleAccent: "custo previsível.",
      lead:
        "Empresa do Grupo Velox dedicada à transição energética. Projetos fotovoltaicos para famílias, empresas e produtores rurais, com engenharia, execução e acompanhamento próprios.",
      image: assetUrl("foto-solar-usina"),
      imageAlt: "Usina fotovoltaica ao entardecer com engenheiro inspecionando os módulos",
    },
    intro: {
      title: "Tecnologia e engenharia a serviço da conta de energia",
      paragraphs: [
        "A Velox Solar existe para transformar um custo variável e imprevisível em um ativo próprio. O trabalho começa pelo consumo real: análise da conta, do espaço disponível e do perfil de uso antes de qualquer dimensionamento.",
        "Cada projeto passa por engenharia, homologação junto à distribuidora e acompanhamento de desempenho depois da instalação. Sustentabilidade aqui não é discurso: é redução mensurável de custo e de emissão.",
      ],
    },
    solutions: {
      title: "O que fazemos",
      subtitle: "Projetos dimensionados por consumo, não por tabela.",
      items: [
        {
          name: "Residencial",
          text: "Geração própria para casas e condomínios, com projeto adequado ao telhado e ao consumo da família.",
        },
        {
          name: "Comercial",
          text: "Sistemas para lojas, clínicas, escritórios e indústrias leves, com foco em previsibilidade de custo.",
        },
        {
          name: "Industrial",
          text: "Projetos de maior porte, com estudo de demanda contratada e retorno calculado caso a caso.",
        },
        {
          name: "Agronegócio",
          text: "Geração para propriedades rurais, irrigação e estruturas produtivas, inclusive em área remota.",
        },
        {
          name: "Usinas",
          text: "Usinas de geração para investimento e compensação de energia entre unidades consumidoras.",
        },
        {
          name: "Eficiência energética",
          text: "Análise de consumo, correção de desperdícios e acompanhamento de desempenho pós-instalação.",
        },
      ],
    },
    pillars: {
      title: "Como atuamos",
      items: [
        {
          title: "Engenharia",
          text: "Dimensionamento técnico, projeto e homologação conduzidos por equipe própria.",
        },
        {
          title: "Tecnologia",
          text: "Equipamentos de fabricantes reconhecidos e monitoramento de geração.",
        },
        {
          title: "Sustentabilidade",
          text: "Energia limpa com impacto direto na conta e na emissão de carbono.",
        },
        {
          title: "Acompanhamento",
          text: "O relacionamento continua depois da instalação, com suporte e leitura de desempenho.",
        },
      ],
    },
    showcase: {
      eyebrow: "Do projeto à geração",
      title: "Instalação acompanhada de ponta a ponta",
      paragraphs: [
        "Visita técnica, projeto, homologação, instalação e ativação: cada etapa tem responsável e prazo informados ao cliente.",
        "A Velox Solar é empresa própria do Grupo Velox, com estrutura, carteira e atendimento independentes das demais frentes.",
      ],
      image: assetUrl("foto-solar-instalacao"),
      imageAlt: "Técnicos instalando módulos fotovoltaicos no telhado de uma residência",
    },
    numbers: [
      { value: "Nacional", label: "Cobertura de atendimento" },
      { value: "Própria", label: "Empresa do Grupo Velox" },
      { value: "4 frentes", label: "Residencial, comercial, agro e usinas" },
    ],
    cta: {
      title: "Quero conhecer a Velox Solar",
      text: "Deixe seus dados e um responsável da unidade entra em contato pelo WhatsApp. O primeiro contato é humano.",
    },
  },

  seguros: {
    key: "seguros",
    path: "/seguradora",
    name: "Velox Seguros",
    shortName: "Velox Seguros",
    logo: assetUrl("logo-velox-seguros"),
    accent: "#3f8fd6",
    accentSoft: "rgba(63,143,214,0.12)",
    seo: {
      title: "Velox Seguros — proteção para pessoas, famílias e empresas",
      description:
        "A corretora do Grupo Velox: mais de 180 tipos de seguros em mais de 30 categorias, das principais seguradoras, com atendimento consultivo e acompanhamento de sinistro.",
    },
    hero: {
      eyebrow: "Grupo Velox · Proteção",
      titleLead: "Proteger é planejar",
      titleAccent: "o que não se controla.",
      lead:
        "Corretora própria do Grupo Velox. Mais de 180 tipos de seguros em mais de 30 categorias, das principais seguradoras — escolhidos a partir do risco real de cada pessoa, família ou empresa.",
      image: assetUrl("foto-seguros-familia"),
      imageAlt: "Família brasileira em frente à sua casa, representando patrimônio protegido",
    },
    intro: {
      title: "Uma corretora que começa pela conversa",
      paragraphs: [
        "A Velox Seguros não vende apólice por catálogo. O trabalho começa entendendo o que precisa ser protegido — a família, a renda, o patrimônio, a operação da empresa — e só então compara coberturas entre as seguradoras parceiras.",
        "A relação continua no momento mais importante: o sinistro. O cliente tem um responsável para acionar, com acompanhamento do processo até a conclusão.",
      ],
    },
    solutions: {
      title: "O que protegemos",
      subtitle: "Soluções para pessoas e famílias, e para empresas de diferentes portes.",
      items: [
        {
          name: "Vida",
          text: "Proteção da renda e da família, com coberturas ajustadas ao momento de vida.",
        },
        {
          name: "Patrimonial",
          text: "Residência, imóvel alugado e bens, contra incêndio, roubo e danos elétricos.",
        },
        {
          name: "Automóvel e frota",
          text: "Veículo particular e frotas empresariais, com assistência e comparação de coberturas.",
        },
        {
          name: "Empresarial",
          text: "Responsabilidade civil, patrimônio da empresa, equipamentos e continuidade da operação.",
        },
        {
          name: "Agro",
          text: "Proteção de safra, maquinário e estruturas do produtor rural.",
        },
        {
          name: "Saúde e benefícios",
          text: "Planos e benefícios para famílias e equipes, com apoio na escolha e na gestão.",
        },
      ],
    },
    pillars: {
      title: "Como atuamos",
      items: [
        {
          title: "Proteção",
          text: "A cobertura é definida pelo risco real, não pelo preço mais chamativo.",
        },
        {
          title: "Confiança",
          text: "Condições, carências e exclusões explicadas antes da contratação.",
        },
        {
          title: "Experiência",
          text: "Corretora própria do Grupo, com acesso às principais seguradoras do mercado.",
        },
        {
          title: "Presença no sinistro",
          text: "Um responsável acompanha o processo do aviso até a conclusão.",
        },
      ],
    },
    showcase: {
      eyebrow: "Atendimento",
      title: "Consultoria antes da apólice",
      paragraphs: [
        "Comparar seguradoras é parte do trabalho, não um favor. O cliente recebe as opções lado a lado, com o que cada uma cobre e o que cada uma não cobre.",
        "A Velox Seguros é empresa própria do Grupo Velox, com carteira, atendimento e estrutura independentes.",
      ],
      image: assetUrl("foto-seguros-atendimento"),
      imageAlt: "Consultora da Velox Seguros analisando coberturas com clientes em reunião",
    },
    numbers: [
      { value: "+180", label: "Tipos de seguros" },
      { value: "+30", label: "Categorias de proteção" },
      { value: "Própria", label: "Corretora do Grupo Velox" },
    ],
    cta: {
      title: "Quero conhecer a Velox Seguros",
      text: "Deixe seus dados e um responsável da unidade entra em contato pelo WhatsApp. Nenhum disparo automático é feito.",
    },
  },
};
