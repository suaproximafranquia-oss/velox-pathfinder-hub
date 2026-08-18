/**
 * ENTRADA DE LEADS — estado operacional da ingestão externa.
 *
 * A base histórica do GreenSales continua existindo e intocada NA
 * ORIGEM. O que está temporariamente pausado é apenas a IMPORTAÇÃO
 * automática dessa base para o ambiente local, para que a validação do
 * fluxo real não seja contaminada por registros antigos.
 *
 * Pausar a ingestão NÃO desliga o Portal dos Leads, o CRM, a cadência
 * nem a integração: a estrutura permanece íntegra e volta a operar
 * apenas invertendo esta constante.
 */
export const GREENSALES_INTAKE_PAUSED = true;

export const GREENSALES_INTAKE_PAUSED_MESSAGE =
  "Importação da base histórica do GreenSales temporariamente pausada. A integração permanece configurada; nenhum lead antigo é reimportado.";
