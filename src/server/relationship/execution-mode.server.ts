/**
 * MODO DE EXECUÇÃO NO SERVIDOR — SERVER ONLY (COMANDO 2A §10).
 *
 * Ponto único onde o ambiente real da requisição encontra a regra pura
 * de `execution-mode.ts`. Todo caminho de envio (motor, primeiro
 * contato, filas) pergunta AQUI se a execução é simulada.
 */
import { isProductionRequest } from "@/server/environment.server";
import { resolveExecutionMode, type ExecutionMode } from "@/lib/relationship/execution-mode";

export { SIMULATION_LABEL } from "@/lib/relationship/execution-mode";
export type { ExecutionMode };

export function executionMode(options: { isTestLead?: boolean } = {}): ExecutionMode {
  return resolveExecutionMode({
    production: isProductionRequest(),
    isTestLead: Boolean(options.isTestLead),
  });
}

/** Atalho para os caminhos que só precisam do booleano. */
export function isSimulatedExecution(options: { isTestLead?: boolean } = {}): boolean {
  return executionMode(options).simulated;
}
