/**
 * BIBLIOTECA DE CONTEÚDOS DE VALOR (COMANDO 2A §41–§45).
 *
 * O motor não inventa conteúdo: ele escolhe, de forma determinística,
 * um item ativo do grupo autorizado que o investidor ainda não recebeu.
 */
export type ContentKind = "imagem" | "video" | "pdf" | "arquivo" | "link";

export type ValueContent = {
  id: string;
  group: string;
  name: string;
  kind: ContentKind;
  url: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

export type ContentSelection =
  | { content: ValueContent; reason: string }
  | { content: null; reason: string };

/**
 * Seleção determinística: entre os candidatos elegíveis vence o menos
 * utilizado e, em empate, o mais antigo. Sem aleatoriedade na decisão.
 */
export function selectContent(
  library: ValueContent[],
  group: string | null,
  alreadySent: string[],
): ContentSelection {
  if (!group) return { content: null, reason: "Etapa não prevê conteúdo de valor." };
  const active = library.filter((c) => c.active && c.group === group);
  if (active.length === 0) {
    return { content: null, reason: `Nenhum conteúdo ativo cadastrado no grupo "${group}".` };
  }
  const unseen = active.filter((c) => !alreadySent.includes(c.id));
  // Sem alternativas novas, o conteúdo não é obrigatoriamente substituído:
  // repetimos o menos utilizado em vez de bloquear a etapa.
  const pool = unseen.length > 0 ? unseen : active;
  const chosen = [...pool].sort(
    (a, b) => a.usageCount - b.usageCount || a.createdAt.localeCompare(b.createdAt),
  )[0]!;
  return {
    content: chosen,
    reason:
      unseen.length > 0
        ? `Conteúdo "${chosen.name}" ainda não enviado a este investidor.`
        : `Todos os conteúdos do grupo "${group}" já foram enviados; reutilizando o menos utilizado.`,
  };
}

/** Grupos mínimos exigidos e quantidade mínima de itens por grupo (§42). */
export const MIN_CONTENTS_PER_GROUP = 5;
export const CONTENT_GROUPS = ["acompanhamento", "prova", "definicao", "reengajamento"] as const;

export function contentLibraryGaps(library: ValueContent[]): string[] {
  return CONTENT_GROUPS.filter(
    (group) => library.filter((c) => c.active && c.group === group).length < MIN_CONTENTS_PER_GROUP,
  ).map(
    (group) => `Grupo "${group}" possui menos de ${MIN_CONTENTS_PER_GROUP} conteúdos ativos.`,
  );
}