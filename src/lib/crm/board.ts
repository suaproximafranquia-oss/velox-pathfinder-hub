/**
 * BOARD / COLUNA — FONTE ÚNICA DA VERDADE DA POSIÇÃO DO LEAD.
 *
 * A origem (GreenSales/GDigital) representa as colunas do funil pelas
 * etiquetas declaradas no próprio funil (`pipeline.tags`, na ordem das
 * colunas). Quem determina o estado do lead é ESSA posição — nunca uma
 * etiqueta avulsa.
 *
 * Regras (COMANDO §1, §3 e §5):
 *   • só as etiquetas que SÃO colunas do funil configurado entram na
 *     decisão; etiquetas de formulário, campanha, importação e afins são
 *     informação complementar e são sempre preservadas;
 *   • havendo mais de uma coluna, vale a MAIS AVANÇADA — foi para
 *     AGENDAMENTO carregando a etiqueta NOVOS? o lead está em
 *     AGENDAMENTO e não volta para NOVOS;
 *   • REMARKETING é recadastro: quando o lead também está na coluna de
 *     entrada, a posição é a ENTRADA e o remarketing vira apenas um
 *     indicador para escolher a comunicação de reativação;
 *   • nenhuma coluna reconhecida NÃO é movimentação: devolve `null` e o
 *     chamador preserva a última posição conhecida.
 */
export type BoardColumn = {
  key: string;
  externalTag: string;
  position: number;
  isEntry: boolean;
};

/** Coluna de recadastro/reativação — complementa, nunca decide sozinha. */
export const REMARKETING_COLUMN_KEY = "remarketing";

export type BoardResolution = {
  /** Coluna atual do lead no quadro da origem. */
  column: BoardColumn | null;
  /** Lead marcado como recadastro/reativação. */
  remarketing: boolean;
  /** Todas as colunas reconhecidas — auditoria. */
  matched: BoardColumn[];
};

export function resolveBoardColumn(
  columns: BoardColumn[],
  tagIds: (string | number)[],
): BoardResolution {
  const held = new Set(tagIds.map((t) => String(t)));
  const matched = columns
    .filter((c) => held.has(String(c.externalTag)))
    .sort((a, b) => a.position - b.position);
  const remarketing = matched.some((c) => c.key === REMARKETING_COLUMN_KEY);
  if (!matched.length) return { column: null, remarketing: false, matched };

  const positional = matched.filter((c) => c.key !== REMARKETING_COLUMN_KEY);
  // Só remarketing: o lead está mesmo na coluna de remarketing.
  if (!positional.length) return { column: matched[0]!, remarketing, matched };

  const column = positional.reduce((a, b) => (b.position > a.position ? b : a));
  return { column, remarketing, matched };
}

/** O lead está na coluna de entrada (NOVOS) do quadro? */
export function isEntryColumn(column: BoardColumn | null): boolean {
  return Boolean(column?.isEntry);
}