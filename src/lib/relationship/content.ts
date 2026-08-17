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
  const tier = pool.filter((c) => c.usageCount === minUsage);
  const index = Math.min(tier.length - 1, Math.max(0, Math.floor(random() * tier.length)));
  const chosen = tier[index]!;
  return {
    content: chosen,
    reason:
      unseen.length > 0
        ? `Conteúdo "${chosen.name}" selecionado do grupo ${group} (ainda não enviado a este investidor).`
        : `Todos os conteúdos do grupo ${group} já foram enviados; reutilizando "${chosen.name}".`,
  };
}

/** Grupos permanentes da Biblioteca de Conteúdos (COMANDO 3A §5). */
export const CONTENT_GROUPS = ["E1", "E3", "R1", "R2", "V3", "V4"] as const;
export type ContentGroup = (typeof CONTENT_GROUPS)[number];

export const CONTENT_GROUP_LABELS: Record<ContentGroup, string> = {
  E1: "Conteúdos de valor — primeiro acompanhamento",
  E3: "Conteúdos de valor — segundo acompanhamento",
  R1: "Conteúdos de valor — primeira tentativa após desaparecimento",
  R2: "Conteúdos de valor — segunda tentativa após desaparecimento",
  V3: "Conteúdos de valor — visualização repetida",
  V4: "Conteúdos de valor — encerramento de interação visualizada",
};

/** Grupos efetivamente exigidos pelas etapas que anexam conteúdo. */
export const REQUIRED_CONTENT_GROUPS: ContentGroup[] = ["E1", "E3", "R1", "R2"];

/**
 * Um grupo exigido sem nenhum conteúdo ativo é uma lacuna real: a etapa
 * correspondente não consegue ser enviada. Não exigimos quantidade
 * mínima — a biblioteca funciona com um único conteúdo (§7).
 */
export function contentLibraryGaps(library: ValueContent[]): string[] {
  return REQUIRED_CONTENT_GROUPS.filter(
    (group) => library.filter((c) => c.active && c.group === group).length === 0,
  ).map((group) => `Grupo "${group}" (${CONTENT_GROUP_LABELS[group]}) não possui conteúdo ativo.`);
}