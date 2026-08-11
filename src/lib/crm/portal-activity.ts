/**
 * Atividades do investidor no Portal (DEF 2.4.10 §2).
 *
 * Qualquer movimento real do investidor — acessar o Manual, abrir o
 * Material Institucional, usar a Calculadora, entrar no Workspace ou
 * simplesmente retornar ao Portal — vira automaticamente:
 *
 *   • um alerta exibido na Ficha do Investidor;
 *   • um registro permanente na Timeline do CRM.
 *
 * A fonte é o Journey Engine: nenhuma base paralela é criada e nenhum
 * dado é inventado.
 */
import { getJourney, type JourneyModule } from "@/lib/journey/engine";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { recordPortalActivityAlert } from "@/lib/workspace-alerts";

export type CrmPortalActivity = {
  id: string;
  investorId: string;
  at: string;
  label: string;
  detail?: string;
  module: JourneyModule;
};

const MODULE_LABEL: Record<JourneyModule, string> = {
  portal: "Retornou ao Portal",
  manual: "Acessou o Manual do Investidor",
  material: "Acessou o Material Institucional",
  simulador: "Utilizou a Calculadora",
  ia: "Consultou a IA do Portal",
  contato: "Solicitou contato",
  reuniao: "Movimentou uma reunião",
};

/** Janela considerada "atividade recente" para exibição na Ficha. */
const WINDOW_MS = 7 * 86_400_000;

/** Atividades reais do investidor, da mais recente para a mais antiga. */
export function listPortalActivities(
  investorId: string,
  limit = 6,
): CrmPortalActivity[] {
  const journey = getJourney(investorId);
  if (!journey) return [];
  return journey.timeline
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit)
    .map((entry, index) => ({
      id: `crmact_${investorId}_${Date.parse(entry.at)}_${index}`,
      investorId,
      at: entry.at,
      label: entry.label || MODULE_LABEL[entry.module],
      detail: entry.detail,
      module: entry.module,
    }));
}

/**
 * Sincronização automática: gera alerta + Timeline para toda atividade
 * recente ainda não registrada. Idempotente por investidor + instante.
 */
export function syncPortalActivity(
  items: { id: string; name: string; ownerId: string; originLabel: string }[],
): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  for (const item of items) {
    for (const activity of listPortalActivities(item.id, 4)) {
      const at = Date.parse(activity.at);
      if (!Number.isFinite(at) || now - at > WINDOW_MS) continue;
      // Somente o PRIMEIRO acesso a cada módulo vira alerta: acessos
      // repetidos continuam visíveis na Timeline, sem poluir a Central.
      recordPortalActivityAlert({
        moduleKey: activity.module,
        ownerUserId: item.ownerId,
        investorId: item.id,
        investorName: item.name,
        title: `${item.name}: ${MODULE_LABEL[activity.module]}`,
        description: activity.detail ?? activity.label,
        dateIso: activity.at,
      });
      recordCrmEvent({
        investorId: item.id,
        event: "atividade_portal",
        origin: item.originLabel,
        reason: `${MODULE_LABEL[activity.module]}${activity.detail ? ` — ${activity.detail}` : ""}.`,
        ownerId: item.ownerId,
        actorId: "sistema",
      });
    }
  }
}