/**
 * Montagem do MOTOR DE RELACIONAMENTO em produção — SERVER ONLY.
 *
 * O motor sai daqui já vinculado ao escopo de produção, ao relógio real
 * e ao canal oficial. A homologação montará o MESMO motor com outro
 * repositório, outro despachante e o relógio virtual — sem lógica
 * paralela (COMANDO 2A §83).
 */
import { RELATIONSHIP_CONFIG } from "@/lib/relationship/config";
import { createEngine, type Engine } from "@/lib/relationship/engine";
import { realClock } from "@/lib/relationship/clock";
import type { EngineDispatcher } from "@/lib/relationship/ports";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createRepository } from "./repository.server";
import { assertProductionRecipient } from "./guard.server";
import { loadLeadStageContext } from "./lead-context.server";

/**
 * Despachante de produção. Enquanto o motor estiver desabilitado ou uma
 * etapa não tiver template oficial associado, nada sai: o COMANDO 2A
 * não autoriza disparo, apenas a estrutura.
 */
const productionDispatcher: EngineDispatcher = {
  scope: "production",
  assertRecipientAllowed: assertProductionRecipient,
  async send(request) {
    if (!RELATIONSHIP_CONFIG.enabled) {
      return { delivered: false, error: "Motor desabilitado — nenhum disparo é executado." };
    }
    if (request.useTemplate && !request.templateId) {
      return {
        delivered: false,
        error: "Etapa exige template oficial e nenhum está associado à finalidade.",
      };
    }
    // Os textos oficiais e o vínculo com o canal serão fornecidos na
    // sequência da implementação. Até lá, registrar e não enviar é o
    // comportamento correto — nunca inventar conteúdo.
    await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "production",
      action: "envio_nao_executado",
      details: {
        leadId: request.leadId,
        step: request.step,
        motivo: "Conteúdo oficial da etapa ainda não fornecido.",
      },
    } as any);
    return { delivered: false, error: "Conteúdo oficial da etapa ainda não fornecido." };
  },
};

export function productionEngine(): Engine {
  return createEngine({
    repository: createRepository("production", null),
    dispatcher: productionDispatcher,
    clock: realClock,
    config: RELATIONSHIP_CONFIG,
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