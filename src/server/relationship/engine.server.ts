/**
 * Montagem do MOTOR DE RELACIONAMENTO em produção — SERVER ONLY.
 *
 * O motor sai daqui já vinculado ao escopo de produção, ao relógio real
 * e ao canal oficial. A homologação monta o MESMO motor com outro
 * repositório, outro despachante e o relógio virtual — sem lógica
 * paralela (COMANDO 2A §83).
 */
import { RELATIONSHIP_CONFIG } from "@/lib/relationship/config";
import { createEngine, type Engine } from "@/lib/relationship/engine";
import { realClock } from "@/lib/relationship/clock";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { E0_SIMULATION_ENABLED } from "@/lib/crm/e0-simulation";
import { createRepository } from "./repository.server";
import { productionDispatcher } from "./dispatch.server";
import { loadLeadStageContext } from "./lead-context.server";

export function productionEngine(): Engine {
  return createEngine({
    repository: createRepository("production", null),
    dispatcher: productionDispatcher,
    clock: realClock,
    config: RELATIONSHIP_CONFIG,
    /**
     * ATIVAÇÃO CONTROLADA — TEMPLATE VIRTUAL ENQUANTO A SIMULAÇÃO ESTIVER
     * LIGADA. Nenhuma mensagem sai do sistema nesse modo, então exigir o
     * template oficial da Meta apenas impediria a observação da máquina.
     * Desligar `E0_SIMULATION_ENABLED` devolve a exigência do template
     * oficial para qualquer etapa fora da janela de 24 horas.
     */
    virtualTemplates: E0_SIMULATION_ENABLED,
    // O relógio da cadência só começa depois da primeira ação humana:
    // enquanto o lead estiver em NOVOS, nada é programado.
    leadContext: loadLeadStageContext,
  });
}


/** Log administrativo do motor (§107). */
export async function logEngineAction(
  action: string,
  details: Record<string, unknown> = {},
  actor?: string,
): Promise<void> {
  await supabaseAdmin.from("relationship_engine_log").insert({
    scope: "production",
    action,
    actor: actor ?? null,
    details: details as any,
  } as any);
}