/**
 * PROVA DE COMPLETUDE DA VARREDURA (regra de segurança do plano
 * aprovado — item 3).
 *
 * A ausência de um lead na origem só significa alguma coisa quando a
 * varredura é COMPROVADAMENTE completa. Qualquer dúvida — página
 * ausente, página vazia inesperada, total incoerente, resposta parcial
 * — marca a varredura como incompleta e a reconciliação de NÃO
 * LOCALIZADOS é abortada, preservando todos os estágios do Portal.
 *
 * O viés é sempre abortar: uma reconciliação adiada se recupera no
 * próximo ciclo; uma movimentação em massa indevida, não.
 *
 * Regra pura, sem banco e sem canal.
 */

export type ScanState = {
  /** `last_page` informado pela origem (páginas esperadas). */
  pagesExpected: number;
  /** Páginas efetivamente percorridas. */
  pagesScanned: number;
  /** `total` declarado pela origem (null = nunca informado). */
  totalReported: number | null;
  /** Soma bruta das linhas recebidas em todas as páginas. */
  rowsReceived: number;
  /** Registros únicos após descontar duplicidades de ID. */
  uniqueProcessed: number;
  /** Número da primeira página vazia fora de hora (null = nenhuma). */
  unexpectedEmptyPage: number | null;
};

export type ScanCompleteness = ScanState & {
  complete: boolean;
  /** Motivo da incompletude — obrigatório quando complete = false. */
  reason: string | null;
};

export function evaluateScanCompleteness(state: ScanState): ScanCompleteness {
  const fail = (reason: string): ScanCompleteness => ({ ...state, complete: false, reason });

  if (state.pagesExpected < 1) {
    return fail("A origem não informou a paginação esperada.");
  }
  if (state.pagesScanned !== state.pagesExpected) {
    return fail(
      `Varredura parcial: ${state.pagesScanned} de ${state.pagesExpected} página(s) percorridas.`,
    );
  }
  if (state.unexpectedEmptyPage !== null) {
    return fail(`A página ${state.unexpectedEmptyPage} veio vazia antes do fim da paginação.`);
  }
  if (state.totalReported === null) {
    return fail("A origem não declarou o total de registros.");
  }
  if (state.uniqueProcessed !== state.totalReported) {
    return fail(
      `Total incoerente: a origem declarou ${state.totalReported} registro(s), mas a varredura processou ${state.uniqueProcessed} único(s).`,
    );
  }
  return { ...state, complete: true, reason: null };
}
