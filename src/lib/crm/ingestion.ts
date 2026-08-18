/**
 * ENTRADA DE LEADS — estado operacional da ingestão externa.
 *
 * A proteção do histórico deixou de depender de pausar a ingestão: ela é
 * estrutural (`@/lib/crm/cutover`). Sincronizar/reimportar um lead
 * anterior a 01/09 NUNCA inicia cadência, mensagem ou ligação — o
 * registro apenas se mantém espelhado e atualizado.
 *
 * Por isso a ingestão volta a operar: manter o espelho desatualizado era
 * uma das causas legítimas de divergência de números entre o GreenSales
 * e o Portal dos Leads.
 */
export const GREENSALES_INTAKE_PAUSED = false;

export const GREENSALES_INTAKE_PAUSED_MESSAGE =
  "Importação da base histórica do GreenSales temporariamente pausada. A integração permanece configurada; nenhum lead antigo é reimportado.";
