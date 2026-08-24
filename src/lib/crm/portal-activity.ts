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
import { listCrmTimeline, recordCrmEvent } from "@/lib/crm/timeline";
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

/**
 * Ocorrências já transformadas em alerta/Timeline nesta sessão do
 * navegador. Sem esta trava a sincronização se auto-alimentava: cada
 * gravação avisava o barramento, o CRM recalculava a lista e a mesma
 * atividade era registrada de novo, em laço — origem do "pisca-pisca"
 * observado na tela de Conversas.
 */
const processed = new Set<string>();
let syncing = false;

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
  if (syncing) return;
  syncing = true;
  const now = Date.now();
  try {
  for (const item of items) {
    for (const activity of listPortalActivities(item.id, 4)) {
      const at = Date.parse(activity.at);
      if (!Number.isFinite(at) || now - at > WINDOW_MS) continue;
      const key = `${item.id}|${activity.module}|${activity.at}`;
      if (processed.has(key)) continue;
      processed.add(key);
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
      /**
       * IDEMPOTÊNCIA DURÁVEL — a trava em memória só vale nesta sessão.
       * Antes de gravar, a Timeline oficial (hidratada do servidor) é
       * consultada pela assinatura exata da atividade: a mesma
       * movimentação jamais gera um segundo registro, mesmo recarregando
       * a página ou trocando de dispositivo.
       */
      const reason = `${MODULE_LABEL[activity.module]}${activity.detail ? ` — ${activity.detail}` : ""}.`;
      const alreadyRecorded = listCrmTimeline(item.id).some(
        (e) => e.event === "atividade_portal" && e.reason === reason,
      );
      if (alreadyRecorded) continue;
      recordCrmEvent({
        investorId: item.id,
        event: "atividade_portal",
        origin: item.originLabel,
        reason,
        ownerId: item.ownerId,
        actorId: "sistema",
      });
    }
  }
  } finally {
    syncing = false;
  }
}
/**
 * ETAPA 3 §8 — RESUMO EXECUTIVO DO PORTAL.
 *
 * O card do CRM NÃO é uma timeline: mostra apenas o ÚLTIMO acesso de
 * cada item relevante e o último acesso geral ao Portal. O histórico
 * completo continua íntegro na jornada/auditoria do Workspace.
 */
export type PortalLastAccess = {
  module: JourneyModule;
  label: string;
  at: string;
  detail?: string;
};

const SUMMARY_ORDER: JourneyModule[] = [
  "manual",
  "material",
  "simulador",
  "ia",
  "reuniao",
  "contato",
];

export function summarizePortalActivity(investorId: string): {
  items: PortalLastAccess[];
  lastPortalAt: string | null;
} {
  const journey = getJourney(investorId);
  if (!journey) return { items: [], lastPortalAt: null };
  const latest = new Map<JourneyModule, PortalLastAccess>();
  let lastPortalAt: string | null = null;
  for (const entry of journey.timeline) {
    if (!lastPortalAt || entry.at > lastPortalAt) lastPortalAt = entry.at;
    const current = latest.get(entry.module);
    if (current && current.at >= entry.at) continue;
    latest.set(entry.module, {
      module: entry.module,
      label: MODULE_LABEL[entry.module],
      at: entry.at,
      detail: entry.detail,
    });
  }
  const items = SUMMARY_ORDER.map((m) => latest.get(m)).filter(
    (v): v is PortalLastAccess => Boolean(v),
  );
  return { items, lastPortalAt };
}
