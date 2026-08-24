/**
 * BLINDAGEM DEFINITIVA DOS LEADS DO PORTAL — constantes oficiais.
 *
 * Regra absoluta: um Lead que já foi registrado no Portal dos Leads
 * NUNCA pode ser excluído — por sincronização, reset, restauração de
 * backup ou qualquer rotina automática. A única consequência possível
 * de um lead não ser encontrado na origem é o estado NÃO LOCALIZADO.
 *
 * Única exceção: registros marcadamente de teste (`is_test` ou
 * identificador TEST-), usados pelas rotinas de homologação controlada.
 */

/** Mensagem administrativa oficial exibida em qualquer tentativa bloqueada. */
export const LEAD_GUARD_MESSAGE =
  "Os Leads do Portal estão protegidos contra reset e exclusão. Esta operação não pode remover Leads já registrados.";

/** Marcadores inequívocos de registro de teste (homologação controlada). */
export function isTestLeadRecord(record: { id: string; is_test?: boolean | null }): boolean {
  return record.is_test === true || /^TEST-/i.test(record.id);
}
