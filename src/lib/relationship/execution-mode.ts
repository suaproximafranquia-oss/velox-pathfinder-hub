/**
 * MODO DE EXECUÇÃO — FONTE ÚNICA DE VERDADE (COMANDO 2A §10).
 *
 * Antes existiam dois conceitos concorrentes de simulação: uma constante
 * de código (`E0_SIMULATION_ENABLED`) e a decisão por ambiente
 * (`channel.ts` / `environment.server.ts`). Uma podia contradizer a
 * outra. Agora existe uma única regra e ela começa pelo AMBIENTE:
 *
 *   • homologação  → SEMPRE simulado (a Meta nunca é chamada);
 *   • lead de teste → SEMPRE simulado, mesmo em produção;
 *   • produção com lead real → execução real, obedecendo às regras do
 *     canal oficial (que ainda pode estar indisponível por falta de
 *     credencial — isso é decidido no canal, não aqui).
 *
 * Nenhuma flag antiga pode sobrepor esta decisão.
 */
export type ExecutionMode = {
  /** true = nada sai para o canal externo; o registro é marcado como simulado. */
  simulated: boolean;
  /** Motivo legível, usado em log, timeline e auditoria. */
  reason: string;
};

export function resolveExecutionMode(input: {
  production: boolean;
  isTestLead?: boolean;
}): ExecutionMode {
  if (!input.production) {
    return {
      simulated: true,
      reason: "Ambiente de homologação: execução simulada, sem chamada à Meta.",
    };
  }
  if (input.isTestLead) {
    return {
      simulated: true,
      reason: "Lead de lote de teste: execução simulada mesmo em produção.",
    };
  }
  return { simulated: false, reason: "Produção com lead real: canal oficial." };
}

/** Marca obrigatória em toda mensagem/timeline gerada em modo simulado. */
export const SIMULATION_LABEL = "SIMULAÇÃO — SEM ENTREGA REAL";
