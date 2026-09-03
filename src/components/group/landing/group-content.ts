/**
 * CONTEÚDO INSTITUCIONAL DA LANDING DO GRUPO VELOX (rota `/`).
 *
 * Este arquivo é a ÚNICA fonte de texto da landing institucional. Todo o
 * conteúdo aqui vem de material já existente no projeto (rota `/`,
 * `/universo`, `/s`, `/seg`, `src/lib/journey-data.ts`). Nada foi
 * inventado: números, missão, visão e histórico só entram quando há
 * conteúdo oficial confirmado no projeto.
 *
 * Missão e visão NÃO possuem texto oficial no projeto — por isso não
 * aparecem na página. Valores existem em `/universo` e são reaproveitados.
 */
import { assetUrl } from "@/lib/assets/registry";

export const GROUP_SECTIONS = [
  { id: "inicio", label: "Início" },
  { id: "sobre-o-grupo", label: "Sobre o Grupo" },
  { id: "seja-um-franqueado", label: "Seja um Franqueado" },
] as const;

export const HERO = {
  eyebrow: "Grupo Velox",
  titleLead: "Um grupo,",
  titleAccent: "três frentes de soluções.",
  lead:
    "O Grupo Velox reúne operações independentes de soluções financeiras, energia solar e seguros — um ecossistema completo para pessoas e empresas.",
  image: assetUrl("sede-velox"),
  imageAlt: "Sede do Grupo Velox em São José do Rio Preto",
} as const;

/**
 * Único número institucional confirmado: mais de 1.400 unidades
 * comercializadas em todo o Brasil (`src/lib/journey-data.ts`).
 */
export const NUMBERS = [
  { value: "+1.400", label: "Unidades comercializadas no Brasil" },
  { value: "3", label: "Frentes de negócio" },
  { value: "Nacional", label: "Presença em todo o país" },
] as const;

export type CompanyKey = "financeira" | "solar" | "seguros";

export const COMPANIES: Array<{
  key: CompanyKey;
  name: string;
  tagline: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  /** Página institucional futura — nunca aponta para o Portal do Investidor. */
  href: string;
}> = [
  {
    key: "financeira",
    name: "Velox Soluções Financeiras",
    tagline:
      "O núcleo da operação: crédito, consórcios, financiamentos e soluções financeiras completas.",
    bullets: ["Crédito e consórcio", "Carteira de clientes ativa", "Jornada completa do investidor"],
    image: assetUrl("mercado-distrito-financeiro"),
    imageAlt: "Distrito financeiro — Velox Soluções Financeiras",
    href: "/financeira",
  },
  {
    key: "solar",
    name: "Velox Solar",
    tagline:
      "Unidade de energia solar do Grupo Velox, com estrutura, projeto e atendimento próprios.",
    bullets: ["Energia solar", "Eficiência energética", "Projetos residenciais e empresariais"],
    image: assetUrl("plataforma-tecnologica"),
    imageAlt: "Operação tecnológica da Velox Solar",
    href: "/solar",
  },
  {
    key: "seguros",
    name: "Velox Seguros",
    tagline:
      "Corretora própria do grupo, com carteira, atendimento e estrutura independentes.",
    bullets: ["Proteção patrimonial", "Vida e previdência", "Seguros corporativos"],
    image: assetUrl("reuniao-colaborativa"),
    imageAlt: "Atendimento da Velox Seguros",
    href: "/seguradora",
  },
];

export const WHY = [
  {
    icon: "handshake",
    title: "Oportunidade",
    text: "Um modelo de negócio estruturado, com processo claro e acompanhamento próximo.",
  },
  {
    icon: "users",
    title: "Consultores",
    text: "Times formados dentro do padrão Velox de atendimento e conduta.",
  },
  {
    icon: "chart",
    title: "Investimento",
    text: "Faixas de entrada definidas com transparência, sem promessa de retorno rápido.",
  },
  {
    icon: "graduation",
    title: "Treinamento",
    text: "Formação inicial e continuada para operar com segurança desde o primeiro mês.",
  },
  {
    icon: "shield",
    title: "Suporte",
    text: "Estrutura central de apoio operacional, jurídico e de marketing.",
  },
  {
    icon: "award",
    title: "Reconhecimento",
    text: "Marca consolidada e presença regional relevante nas três frentes do Grupo.",
  },
] as const;

export const ABOUT = {
  title: "Sobre o Grupo Velox",
  subtitle: "Um grupo. Três frentes de soluções.",
  paragraphs: [
    "O Grupo Velox reúne operações independentes de soluções financeiras, energia solar e seguros. Cada frente tem estrutura, carteira e atendimento próprios, formando um ecossistema voltado a pessoas, empresas e empreendedores.",
    "A sede fica em São José do Rio Preto, São Paulo, e sustenta a rede com estrutura central de apoio operacional, jurídico e de marketing.",
  ],
  image: assetUrl("sede-recepcao"),
  imageAlt: "Recepção da sede do Grupo Velox",
};

/** Frentes descritas no material institucional (`/universo`). */
export const FRONTS = [
  {
    eyebrow: "Frente 01",
    name: "Soluções Financeiras",
    description:
      "O núcleo da operação. Crédito, consórcios, capital de giro, financiamentos, home equity, antecipações, agronegócio, maquininhas, FGTS e consignado — conectados a bancos, fintechs, fundos e administradoras de todo o país.",
    highlight: "+200 produtos e serviços · +200 parceiros estratégicos",
  },
  {
    eyebrow: "Frente 02",
    name: "Energia Solar",
    description:
      "Empresa própria do grupo, dedicada à transição energética. Projetos fotovoltaicos residenciais, comerciais e rurais, usinas de investimento e crédito de carbono, para famílias, empresas e produtores que buscam previsibilidade de custos.",
    highlight: "Empresa própria do grupo · Cobertura nacional",
  },
  {
    eyebrow: "Frente 03",
    name: "Corretora de Seguros",
    description:
      "Corretora própria do grupo, com mais de 180 tipos de seguros em mais de 30 categorias, das principais seguradoras do mundo. Vida, patrimonial, empresarial, frota, agro, saúde e benefícios.",
    highlight: "Corretora própria · +180 tipos de seguros · +30 categorias",
  },
] as const;

/** Valores institucionais oficiais (`/universo`). */
export const VALUES = [
  {
    title: "Transparência",
    body: "Acreditamos que relações duradouras são construídas por meio de informações claras, comunicação aberta e respeito às decisões de cada pessoa.",
  },
  {
    title: "Compromisso",
    body: "Assumimos responsabilidade pelas orientações que oferecemos e buscamos atuar com seriedade em todas as etapas da parceria.",
  },
  {
    title: "Relacionamento",
    body: "Valorizamos o contato próximo, o diálogo constante e a construção de confiança ao longo do tempo.",
  },
  {
    title: "Desenvolvimento Contínuo",
    body: "Entendemos que o aprendizado permanente fortalece pessoas, empresas e resultados.",
  },
  {
    title: "Ética",
    body: "Conduzimos nossas atividades com responsabilidade, respeito às normas e compromisso com uma atuação íntegra.",
  },
  {
    title: "Visão de Longo Prazo",
    body: "Buscamos construir uma rede sólida, sustentável e preparada para crescer de forma consistente ao lado de seus franqueados.",
  },
] as const;

/**
 * Linha do tempo montada SOMENTE com fatos já presentes no projeto.
 * Não há ano de fundação oficial registrado no código — por isso a
 * primeira etapa não afirma data.
 */
export const TIMELINE = [
  {
    marker: "Origem",
    title: "Sede em São José do Rio Preto",
    text: "A Velox Soluções Financeiras nasce como núcleo da operação, conectando pessoas e empresas a bancos, fintechs, fundos e administradoras.",
  },
  {
    marker: "Crescimento",
    title: "Expansão da rede de franqueados",
    text: "Ampliação do portfólio e da rede, com formação inicial e continuada e estrutura central de suporte.",
  },
  {
    marker: "Novas frentes",
    title: "Energia Solar e Seguros",
    text: "Entrada das frentes de Energia Solar e Corretora de Seguros, ambas empresas próprias do grupo.",
  },
  {
    marker: "Hoje",
    title: "Mais de 1.400 unidades comercializadas",
    text: "Presença nacional nas três frentes, com operações independentes e estrutura de apoio compartilhada.",
  },
] as const;

export const FOOTER = {
  line: "Grupo Velox · Soluções Financeiras, Solar e Seguros.",
  address: "Sede · São José do Rio Preto · SP",
};
