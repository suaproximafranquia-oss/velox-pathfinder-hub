/**
 * BLOCO 4 — PLANO DE FLUXO (etapas, ordem e prazo) COMO DADO.
 *
 * A Biblioteca é dona da EXISTÊNCIA e do CONTEÚDO da etapa. O FLUXO
 * define quais etapas participam, em que ordem e com que prazo — e
 * cada versão publicada é imutável.
 *
 * Este arquivo é puro: não conhece banco, não conhece rede. Ele apenas
 * descreve o plano e sabe montar o plano de COMPATIBILIDADE a partir da
 * configuração atual (`config.ts`), usada por ciclos legados.
 */
import { FLOW_SEQUENCE, STEPS } from "./config";
import type { CadenceFlow, CadenceStep } from "./types";

export type FlowPlanStep = {
  step: CadenceStep;
  position: number;
  /** Prazo em dias úteis — pertence à ASSOCIAÇÃO, não à mensagem. */
  businessDaysAfterReference: number;
  active: boolean;
};

export type FlowPlan = {
  flowKey: CadenceFlow;
  /** null = plano de compatibilidade (ciclo legado, sem versão). */
  flowVersionId: string | null;
  version: number | null;
  steps: FlowPlanStep[];
};

/** Sequência operacional: apenas etapas ativas, na ordem da versão. */
export function planSequence(plan: FlowPlan): CadenceStep[] {
  return plan.steps
    .filter((s) => s.active)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => s.step);
}

export function planBusinessDays(plan: FlowPlan, step: CadenceStep): number | null {
  const found = plan.steps.find((s) => s.step === step);
  return found ? found.businessDaysAfterReference : null;
}

/**
 * PLANO DE COMPATIBILIDADE (versão 1 conceitual): reproduz exatamente a
 * configuração atual do `config.ts`. Ciclos legados — sem versão
 * gravada — continuam seguindo esta sequência, sem reescrita alguma.
 */
export function compatibilityPlan(flow: CadenceFlow): FlowPlan {
  const sequence = FLOW_SEQUENCE[flow] ?? [];
  return {
    flowKey: flow,
    flowVersionId: null,
    version: null,
    steps: sequence.map((step, index) => ({
      step,
      position: index + 1,
      businessDaysAfterReference: STEPS[step]?.businessDaysAfterReference ?? 0,
      active: true,
    })),
  };
}
