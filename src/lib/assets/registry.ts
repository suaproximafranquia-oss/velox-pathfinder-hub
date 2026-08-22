/**
 * REGISTRO CENTRAL DE ASSETS — arquitetura preparada para migração.
 *
 * Toda mídia estática (fotografia, logo, capa, futuro vídeo ou documento)
 * usada pelas páginas institucionais é declarada AQUI, com:
 *
 *   chave semântica → arquivo atual (ponteiro CDN) → caminho de produção
 *
 * Por que este arquivo existe
 * ---------------------------
 * Hoje os binários vivem fora do repositório: cada `*.asset.json` é um
 * ponteiro para o CDN da plataforma. Isso é ótimo para performance, mas
 * amarra o projeto a uma URL que não existirá na infraestrutura própria.
 *
 * Com este registro, a migração para a KingHost NÃO exige tocar em
 * componentes: basta (1) copiar os binários para `/assets/<categoria>/…`
 * no servidor, usando o `path` declarado abaixo, e (2) definir a variável
 * de ambiente `VITE_ASSET_BASE_URL` (ex.: `https://portal.velox.com.br`).
 * A partir daí `assetUrl()` passa a resolver `${base}/assets/...` e a
 * dependência do CDN atual desaparece — sem reconstruir nenhuma página.
 *
 * Regras
 * ------
 * 1. Nenhum componente importa `*.asset.json` diretamente: importa daqui.
 * 2. Toda nova mídia entra neste registro com nome semântico estável.
 * 3. Substituir uma foto = trocar apenas o ponteiro da chave, nada mais.
 * 4. Este arquivo NÃO é um CMS: é um manifesto estático e auditável.
 */

/* --------------------------- ponteiros atuais --------------------------- */

import veloxLogo from "@/assets/editorial/velox-logo.png.asset.json";
import sedeVelox from "@/assets/editorial/velox-sede.jpg.asset.json";
import fundadorMarioSergio from "@/assets/editorial/mario-sergio.png.asset.json";
import lojaFachada from "@/assets/editorial/velox-loja-fachada.jpg.asset.json";
import lojaFachadaAlt from "@/assets/editorial/velox-loja-fachada2.jpg.asset.json";
import lojaInauguracao from "@/assets/editorial/velox-loja-inauguracao.jpg.asset.json";
import treinamentoRede from "@/assets/editorial/velox-treinamento.png.asset.json";
import embaixadorCiroBottini from "@/assets/editorial/velox-ciro-bottini.png.asset.json";
import decisaoInvestidor from "@/assets/editorial/velox-decisao-ref.png.asset.json";
import atendimentoConsultivo from "@/assets/editorial/relationship.jpg.asset.json";
import distritoFinanceiro from "@/assets/editorial/market.jpg.asset.json";
import consumidorFinanceiro from "@/assets/editorial/consumer.jpg.asset.json";
import reuniaoColaborativa from "@/assets/editorial/collab.jpg.asset.json";
import plataformaTecnologica from "@/assets/editorial/tech.jpg.asset.json";
import edificioEncerramento from "@/assets/editorial/closing.jpg.asset.json";
import equipeExpansao from "@/assets/editorial/velox-executivos.png.asset.json";
import diretoraExpansaoLarissa from "@/assets/editorial/velox-larissa.png.asset.json";
import marketplaceParceiros from "@/assets/editorial/velox-marketplace-parceiros.png.asset.json";
import fundadorConsultores from "@/assets/editorial/velox-mario-consultores.png.asset.json";
import modeloHomeOffice from "@/assets/editorial/velox-home-office.jpg.asset.json";
import recepcaoSede from "@/assets/editorial/velox-recepcao.jpg.asset.json";
import parceirosInstituicoes from "@/assets/editorial/velox-parceiros.png.asset.json";
import reflexaoInvestidor from "@/assets/editorial/reflection.jpg.asset.json";

import portalHeroSede from "@/assets/velox-sede-hero.png.asset.json";
import portalCapaManual from "@/assets/portal-manual-cover.png.asset.json";
import portalCapaMaterialInstitucional from "@/assets/portal-material-institucional.png.asset.json";
import portalSedeFachada from "@/assets/portal-sede-fachada.png.asset.json";
import portalCapaRevista from "@/assets/portal-revista-velox.png.asset.json";
import portalExperiencias from "@/assets/portal-experiencias.png.asset.json";
import portalSimulador from "@/assets/portal-simulador.jpg.asset.json";

/* ------------------------------- tipos --------------------------------- */

export type AssetCategory = "images" | "videos" | "logos" | "documents";

export type AssetPointer = {
  /** URL servida hoje (CDN da plataforma). */
  url: string;
  /** Nome original do arquivo enviado. */
  original_filename?: string;
  content_type?: string;
  size?: number;
};

export type AssetEntry = {
  /** Caminho de destino na infraestrutura própria (relativo à raiz pública). */
  path: string;
  /** Categoria física do arquivo. */
  category: AssetCategory;
  /** Descrição da posição que este arquivo ocupa no material. */
  usage: string;
  /** Ponteiro atual (CDN). */
  pointer: AssetPointer;
};

/* ------------------------------ manifesto ------------------------------- */

function entry(
  category: AssetCategory,
  name: string,
  usage: string,
  pointer: AssetPointer,
): AssetEntry {
  const ext = (pointer.original_filename?.split(".").pop() ?? "png").toLowerCase();
  return { category, path: `/assets/${category}/${name}.${ext}`, usage, pointer };
}

export const ASSETS = {
  /* Identidade */
  "logo-velox": entry("logos", "logo-velox", "Marca Velox no cabeçalho e nos criativos", veloxLogo),

  /* Pessoas */
  "fundador-mario-sergio": entry(
    "images",
    "fundador-mario-sergio",
    "Retrato do fundador — abertura do Capítulo I",
    fundadorMarioSergio,
  ),
  "fundador-com-consultores": entry(
    "images",
    "fundador-com-consultores",
    "Reunião estratégica — Consultoria de negócios",
    fundadorConsultores,
  ),
  "diretora-expansao-larissa": entry(
    "images",
    "diretora-expansao-larissa",
    "Diretoria de Expansão — Equipe de suporte",
    diretoraExpansaoLarissa,
  ),
  "equipe-expansao": entry(
    "images",
    "equipe-expansao",
    "Executivos de Expansão — Equipe de suporte e rede em expansão",
    equipeExpansao,
  ),
  "embaixador-ciro-bottini": entry(
    "images",
    "embaixador-ciro-bottini",
    "Embaixador da marca — abertura do Capítulo III",
    embaixadorCiroBottini,
  ),

  /* Estrutura física */
  "sede-velox": entry("images", "sede-velox", "Hero do material institucional", sedeVelox),
  "sede-recepcao": entry("images", "sede-recepcao", "Recepção da sede", recepcaoSede),
  "unidade-fachada": entry(
    "images",
    "unidade-fachada",
    "Fachada de unidade — Rede em expansão",
    lojaFachada,
  ),
  "unidade-fachada-alternativa": entry(
    "images",
    "unidade-fachada-alternativa",
    "Fachada alternativa — galeria e modelo Loja Física",
    lojaFachadaAlt,
  ),
  "unidade-inauguracao": entry(
    "images",
    "unidade-inauguracao",
    "Inauguração de unidade — Comunidade de franqueados",
    lojaInauguracao,
  ),
  "modelo-home-office": entry(
    "images",
    "modelo-home-office",
    "Estação de trabalho — modelo Home Office",
    modeloHomeOffice,
  ),

  /* Contexto editorial */
  "treinamento-rede": entry(
    "images",
    "treinamento-rede",
    "Treinamento da rede — parcerias e Universidade Corporativa",
    treinamentoRede,
  ),
  "decisao-investidor": entry(
    "images",
    "decisao-investidor",
    "Antes de falar da Velox — decisão do investidor",
    decisaoInvestidor,
  ),
  "atendimento-consultivo": entry(
    "images",
    "atendimento-consultivo",
    "Atendimento consultivo — conceito e próximos passos",
    atendimentoConsultivo,
  ),
  "mercado-distrito-financeiro": entry(
    "images",
    "mercado-distrito-financeiro",
    "Panorama do mercado financeiro",
    distritoFinanceiro,
  ),
  "consumidor-financeiro": entry(
    "images",
    "consumidor-financeiro",
    "Evolução do consumidor",
    consumidorFinanceiro,
  ),
  "reuniao-colaborativa": entry(
    "images",
    "reuniao-colaborativa",
    "Implantação e comunidade da rede",
    reuniaoColaborativa,
  ),
  "plataforma-tecnologica": entry(
    "images",
    "plataforma-tecnologica",
    "Plataforma tecnológica",
    plataformaTecnologica,
  ),
  "encerramento-edificio": entry(
    "images",
    "encerramento-edificio",
    "Encerramento — Capítulo V",
    edificioEncerramento,
  ),
  "reflexao-investidor": entry(
    "images",
    "reflexao-investidor",
    "Bloco de reflexão do investidor",
    reflexaoInvestidor,
  ),
  "marketplace-parceiros": entry(
    "images",
    "marketplace-parceiros",
    "Marketplace de parceiros — marcas parceiras",
    marketplaceParceiros,
  ),
  "parceiros-instituicoes": entry(
    "images",
    "parceiros-instituicoes",
    "Instituições parceiras — variação da grade de marcas",
    parceirosInstituicoes,
  ),

  /* Portal do investidor (capas dos módulos) */
  "portal-hero-sede": entry("images", "portal-hero-sede", "Hero do Portal do Investidor", portalHeroSede),
  "portal-capa-manual": entry("images", "portal-capa-manual", "Capa do módulo Manual", portalCapaManual),
  "portal-capa-material-institucional": entry(
    "images",
    "portal-capa-material-institucional",
    "Capa do módulo Material Institucional",
    portalCapaMaterialInstitucional,
  ),
  "portal-capa-sede": entry("images", "portal-capa-sede", "Capa do módulo Nossa Sede", portalSedeFachada),
  "portal-capa-revista": entry("images", "portal-capa-revista", "Capa do módulo Revista Velox", portalCapaRevista),
  "portal-capa-experiencias": entry(
    "images",
    "portal-capa-experiencias",
    "Capa do módulo Experiências",
    portalExperiencias,
  ),
  "portal-capa-simulador": entry(
    "images",
    "portal-capa-simulador",
    "Capa do módulo Simulador",
    portalSimulador,
  ),
} satisfies Record<string, AssetEntry>;

export type AssetKey = keyof typeof ASSETS;

/**
 * Base pública dos assets após a migração. Enquanto vazia, o projeto
 * continua servindo pelo CDN atual (comportamento idêntico ao de hoje).
 */
const ASSET_BASE_URL = (import.meta.env?.["VITE_ASSET_BASE_URL"] as string | undefined)?.replace(
  /\/+$/,
  "",
);

/** URL da mídia para uso em `src` / `background-image`. */
export function assetUrl(key: AssetKey): string {
  const item = ASSETS[key];
  return ASSET_BASE_URL ? `${ASSET_BASE_URL}${item.path}` : item.pointer.url;
}

/** Inventário completo — usado em auditorias de migração. */
export function assetInventory(): Array<AssetEntry & { key: AssetKey; currentUrl: string }> {
  return (Object.keys(ASSETS) as AssetKey[]).map((key) => ({
    key,
    ...ASSETS[key],
    currentUrl: assetUrl(key),
  }));
}
