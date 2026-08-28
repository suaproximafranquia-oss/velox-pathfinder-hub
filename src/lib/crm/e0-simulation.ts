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
/**
 * @deprecated O modo de execução agora é decidido em um único lugar:
 * `@/lib/relationship/execution-mode` (regra pura) e
 * `@/server/relationship/execution-mode.server` (ambiente real).
 * Este rótulo permanece SOMENTE para reconhecer mensagens históricas
 * já gravadas com a marca antiga. Não use em código novo.
 */
export const LEGACY_E0_SIMULATION_LABEL = "TESTE — E0 SIMULADA";
