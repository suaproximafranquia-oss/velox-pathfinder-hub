/**
 * TESTE END-TO-END — E0 SIMULADA.
 *
 * Durante o teste do fluxo real de entrada de leads a mensagem NUNCA é
 * entregue: a Meta não é chamada e nenhum telefone recebe nada. Todo o
 * restante do processo é real — detecção do lead novo, criação do card
 * operacional no Workspace GreenSales, acionamento da E0, registro da
 * mensagem e da timeline.
 *
 * Desligar esta chave devolve o comportamento normal de envio.
 */
export const E0_SIMULATION_ENABLED = true;

/** Marca obrigatória em toda mensagem/timeline gerada pelo teste. */
export const E0_SIMULATION_LABEL = "TESTE — E0 SIMULADA";
