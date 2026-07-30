/**
 * Central de Alertas — Workspace do Executivo.
 *
 * Componente GLOBAL (não pertence mais ao Brain Analytics). Apenas duas
 * categorias de alerta são geradas, ambas a partir de dados reais:
 *
 *  1. Movimentação do Investidor — o investidor retorna ao Portal após
 *     ficar inativo por, no mínimo, a janela de reativação configurada
 *     em Configurações (`platform-settings.ts`).
 *  2. Lembretes de Reuniões — reuniões futuras próximas do horário.
 *
 * Nenhum dado fictício é gerado. Persistência local por workspace.
 */
import { emitEvent, onEvent } from "@/lib/events/bus";
import { getReactivationWindowMs } from "@/lib/platform-settings";
import { listAllInvestors, formatRelative, type Investor } from "@/lib/executive-data";
import { listMeetings } from "@/lib/meetings";
import type { ExecutiveSession } from "@/lib/executive-auth";

export type WorkspaceAlertCategory = "movimentacao" | "reuniao";

export type WorkspaceAlert = {
  id: string;
  ownerUserId: string;
  category: WorkspaceAlertCategory;
  title: string;
  description: string;
  investorId?: string;
  date: string; // ISO
  archived?: boolean;
};

export const WORKSPACE_ALERT_CATEGORY_LABEL: Record<WorkspaceAlertCategory, string> = {
  movimentacao: "Movimentação do Investidor",
  reuniao: "Lembrete de Reunião",
};

const ALERTS_KEY = "atlas:workspace-alerts:v1";
const LAST_SEEN_KEY = "atlas:investor-last-seen:v1";

type LastSeenMap = Record<string, string>;

function readAlerts(): WorkspaceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERTS_KEY);
    const arr = raw ? (JSON.parse(raw) as WorkspaceAlert[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAlerts(list: WorkspaceAlert[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ALERTS_KEY, JSON.stringify(list.slice(-300)));
}

function readLastSeen(): LastSeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw ? (JSON.parse(raw) as LastSeenMap) : {};
  } catch {
    return {};
  }
}

function writeLastSeen(map: LastSeenMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
}

function pushAlert(alert: Omit<WorkspaceAlert, "id">) {
  const id = `wa_${alert.category}_${alert.investorId ?? "x"}_${Date.parse(alert.date)}`;
  const list = readAlerts();
  if (list.some((a) => a.id === id)) return;
  list.push({ ...alert, id });
  writeAlerts(list);
  emitEvent({ type: "investor.reactivated", investorId: alert.investorId, payload: { alertId: id } });
}

/**
 * Avalia todos os investidores: quem retornou ao Portal após ficar inativo
 * por, no mínimo, a janela de reativação configurada, gera um alerta de
 * Movimentação. Atualiza o "último visto" para não repetir o alerta.
 */
export function evaluateInvestorMovement(): Investor[] {
  const windowMs = getReactivationWindowMs();
  const lastSeen = readLastSeen();
  const investors = listAllInvestors().filter((i) => i.origin === "portal");
  const reactivated: Investor[] = [];

  for (const inv of investors) {
    const activityMs = new Date(inv.lastActivity).getTime();
    const previousSeen = lastSeen[inv.id];
    if (previousSeen) {
      const previousMs = new Date(previousSeen).getTime();
      const inactiveGap = activityMs - previousMs;
      if (activityMs > previousMs && inactiveGap >= windowMs) {
        pushAlert({
          ownerUserId: inv.assignedToUserId,
          category: "movimentacao",
          title: `${inv.name} retornou ao Portal`,
          description: `Estava inativo há ${formatRelative(previousSeen)} e voltou a interagir com o Portal.`,
          investorId: inv.id,
          date: inv.lastActivity,
        });
        reactivated.push(inv);
      }
    }
    lastSeen[inv.id] = inv.lastActivity;
  }
  writeLastSeen(lastSeen);
  return reactivated;
}

/** Investidores destacados visualmente por retorno recente (últimas 24h). */
export function recentlyReactivatedIds(): Set<string> {
  const alerts = readAlerts().filter(
    (a) => a.category === "movimentacao" && !a.archived && Date.now() - Date.parse(a.date) < 24 * 60 * 60 * 1000,
  );
  return new Set(alerts.map((a) => a.investorId).filter((v): v is string => !!v));
}

/** Gera lembretes para reuniões futuras dentro das próximas 24h. */
export function evaluateMeetingReminders(session: ExecutiveSession) {
  const meetings = listMeetings({ executiveId: session.userId, status: ["Agendada", "Confirmada"] });
  const now = Date.now();
  for (const m of meetings) {
    const start = new Date(m.scheduledAt).getTime();
    const diff = start - now;
    if (diff <= 0 || diff > 24 * 60 * 60 * 1000) continue;
    pushAlert({
      ownerUserId: session.userId,
      category: "reuniao",
      title: `Reunião com ${m.investorName ?? "investidor"}`,
      description: `Agendada para ${new Date(m.scheduledAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}.`,
      investorId: m.investorId,
      date: m.scheduledAt,
    });
  }
}

export function runWorkspaceAlertEvaluation(session: ExecutiveSession) {
  evaluateInvestorMovement();
  try {
    evaluateMeetingReminders(session);
  } catch {
    /* Central de Reuniões pode não estar disponível em todos os contextos. */
  }
}

export function listWorkspaceAlerts(session: ExecutiveSession): WorkspaceAlert[] {
  return readAlerts()
    .filter((a) => a.ownerUserId === session.userId && !a.archived)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function archiveWorkspaceAlert(id: string) {
  const next = readAlerts().map((a) => (a.id === id ? { ...a, archived: true } : a));
  writeAlerts(next);
}

export function onWorkspaceAlertsChange(cb: () => void) {
  return onEvent((e) => {
    if (e.type === "investor.reactivated" || e.type === "meeting.created") cb();
  });
}
