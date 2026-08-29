/**
 * BIBLIOTECA DE CONTEÚDOS DE VALOR (COMANDO 2A §41–§45).
 *
 * O motor não inventa conteúdo: ele escolhe, de forma determinística,
 * um item ativo do grupo autorizado que o investidor ainda não recebeu.
 */
/**
 * Tipos suportados de ponta a ponta (COMANDO 3B §21): interface,
 * validação, persistência e renderização usam esta MESMA lista.
 */
export const CONTENT_KINDS = [
  "texto",
  "imagem",
  "video",
  "audio",
  "pdf",
  "documento",
  "apresentacao",
  "arquivo",
  "link",
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  texto: "Texto",
  imagem: "Imagem (JPG/PNG)",
  video: "Vídeo",
  audio: "Áudio",
  pdf: "PDF",
  documento: "Documento",
  apresentacao: "Apresentação",
  arquivo: "Arquivo",
  link: "Link",
};

export type ValueContent = {
  id: string;
  /**
   * Grupo principal (compatibilidade histórica). A verdade sobre a
   * associação está em `groups` — COMANDO 3C §7: um único conteúdo
   * físico pode servir a vários grupos sem duplicar o arquivo.
   */
  group: string;
  groups?: string[];
  name: string;
  description?: string | null;
  kind: ContentKind;
  url: string;
  /** Conteúdo textual (kind = "texto"). */
  body?: string | null;
  /** Caminho no armazenamento quando o material foi enviado por upload. */
  storagePath?: string | null;
  mimeType?: string | null;
  position?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt?: string | null;
};

/** Grupos aos quais o conteúdo pertence (sempre inclui o principal). */
export function contentGroupsOf(content: ValueContent): string[] {
  const list = content.groups && content.groups.length > 0 ? content.groups : [content.group];
  return Array.from(new Set(list.filter(Boolean)));
}

/** Conteúdos ativos associados a um grupo — nunca de outro grupo (§6, §11). */
export function contentsForGroup(library: ValueContent[], group: string): ValueContent[] {
  return library.filter((c) => c.active && contentGroupsOf(c).includes(group));
}

export type ContentSelection =
  | { content: ValueContent; reason: string }
  | { content: null; reason: string };

/**
 * Seleção controladamente aleatória (COMANDO 3A §6, §7).
 *
 * Preferimos o que o investidor ainda não recebeu; entre os candidatos
 * dessa faixa a escolha é sorteada. Havendo um único conteúdo ativo, ele
 * é utilizado normalmente — a regra de não repetir nunca impede o envio.
 */
export function selectContent(
  library: ValueContent[],
  group: string | null,
  alreadySent: string[],
  random: () => number = Math.random,
): ContentSelection {
  if (!group) return { content: null, reason: "Etapa não prevê conteúdo de valor." };
  const active = contentsForGroup(library, group);
  if (active.length === 0) {
    return { content: null, reason: `Nenhum conteúdo ativo cadastrado no grupo "${group}".` };
  }
  const unseen = active.filter((c) => !alreadySent.includes(c.id));
  const pool = unseen.length > 0 ? unseen : active;
  // Entre os menos utilizados do grupo, sorteia — distribui a biblioteca
  // sem transformar a escolha em algo imprevisível.
  const minUsage = Math.min(...pool.map((c) => c.usageCount));
  /**
   * ROTAÇÃO DETERMINÍSTICA (Etapa 3): entre os menos utilizados vence o
   * que está parado há mais tempo e, no empate, o id. Duas execuções
   * com o mesmo estado escolhem sempre o mesmo material — auditável.
   */
  const tier = [...pool]
    .filter((c) => c.usageCount === minUsage)
    .sort((a, b) => {
      const aUsed = a.lastUsedAt ?? "";
      const bUsed = b.lastUsedAt ?? "";
      if (aUsed !== bUsed) return aUsed < bUsed ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const chosen = tier[0]!;
  return {
    content: chosen,
    reason:
      unseen.length > 0
        ? `Conteúdo "${chosen.name}" selecionado do grupo ${group} (ainda não enviado a este investidor).`
        : `Todos os conteúdos do grupo ${group} já foram enviados; reutilizando "${chosen.name}".`,
  };
}

/**
 * Grupos permanentes da Biblioteca de Conteúdos (COMANDO 3A §5,
 * ampliados pelo COMANDO 3D §12). A Biblioteca NÃO cria etapas: ela
 * apenas vincula conteúdo às etapas que o MOTOR já conhece. Etapas sem
 * uso atual ficam preparadas, sem alterar o comportamento do motor.
 */
export const CONTENT_GROUPS = [
  "E1",
  "E2",
  "E3",
  "E4",
  "E12",
  "R1",
  "R2",
  "R3",
  "RE1",
  "RE2",
  "V3",
  "V4",
  "FINALIZACAO",
] as const;
export type ContentGroup = (typeof CONTENT_GROUPS)[number];

export const CONTENT_GROUP_LABELS: Record<ContentGroup, string> = {
  E1: "Conteúdos de valor — primeiro acompanhamento",
  E2: "Etapa preparada — sem uso atual pelo motor",
  E3: "Conteúdos de valor — segundo acompanhamento",
  E4: "Etapa preparada — acompanhamento mais firme",
  E12: "Etapa preparada — encerramento do fluxo sem resposta",
  R1: "Conteúdos de valor — primeira tentativa após desaparecimento",
  R2: "Conteúdos de valor — segunda tentativa após desaparecimento",
  R3: "Etapa preparada — interrupção das tentativas",
  RE1: "Reentrada — como avaliar uma franquia",
  RE2: "Reentrada — estrutura e suporte ao franqueado",
  V3: "Conteúdos de valor — visualização repetida",
  V4: "Conteúdos de valor — encerramento de interação visualizada",
  FINALIZACAO:
    "Conteúdo padrão de finalização — encerramentos por silêncio/não evolução (E12, RE3, RF1)",
};

/** Grupos efetivamente exigidos pelas etapas que anexam conteúdo. */
export const REQUIRED_CONTENT_GROUPS: ContentGroup[] = [
  "E1",
  "E3",
  "R1",
  "R2",
  "RE1",
  "RE2",
  "FINALIZACAO",
];

/**
 * Vídeo padrão de finalização (COMANDO 3D §21). É UM ÚNICO registro da
 * Biblioteca associado a várias etapas de encerramento — nunca cópias.
 */
export const CLOSING_CONTENT_URL = "https://www.instagram.com/p/DcJbxCqhOHu/";
export const CLOSING_CONTENT_NAME = "Conte a sua própria história";

/**
 * Um grupo exigido sem nenhum conteúdo ativo é uma lacuna real: a etapa
 * correspondente não consegue ser enviada. Não exigimos quantidade
 * mínima — a biblioteca funciona com um único conteúdo (§7).
 */
export function contentLibraryGaps(library: ValueContent[]): string[] {
  return REQUIRED_CONTENT_GROUPS.filter(
    (group) => contentsForGroup(library, group).length === 0,
  ).map((group) => `Grupo "${group}" (${CONTENT_GROUP_LABELS[group]}) não possui conteúdo ativo.`);
}

/** Resumo por grupo para a tela da Biblioteca (COMANDO 3C §19). */
export function contentLibraryStats(library: ValueContent[]) {
  const byGroup = CONTENT_GROUPS.map((group) => ({
    group,
    label: CONTENT_GROUP_LABELS[group],
    active: contentsForGroup(library, group).length,
    total: library.filter((c) => contentGroupsOf(c).includes(group)).length,
    required: REQUIRED_CONTENT_GROUPS.includes(group),
  }));
  return {
    total: library.length,
    active: library.filter((c) => c.active).length,
    inactive: library.filter((c) => !c.active).length,
    byGroup,
    missingRequired: byGroup.filter((g) => g.required && g.active === 0).map((g) => g.group),
  };
}