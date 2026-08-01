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
import { canViewAllInvestors, type ExecutiveSession } from "@/lib/executive-auth";
import { listJourneys } from "@/lib/journey/engine";
import { summarizeJourney } from "@/lib/journey/insights";

export type WorkspaceAlertCategory =
  | "movimentacao"
  | "novo_lead"
  | "manual_concluido"
  | "simulacao"
  | "contato_whatsapp"
  | "engajamento_alto"
  | "reuniao"
  | "reuniao_solicitada"
  | "reuniao_confirmada"
  | "reuniao_cancelada"
  | "reuniao_alterada";

export type WorkspaceAlert = {
  id: string;
  ownerUserId: string;
  category: WorkspaceAlertCategory;
  title: string;
  description: string;
  investorId?: string;
  date: string; // ISO
  /** Link direto de ação (ex.: entrar na reunião). */
  actionUrl?: string;
  archived?: boolean;
};

export const WORKSPACE_ALERT_CATEGORY_LABEL: Record<WorkspaceAlertCategory, string> = {
  movimentacao: "Movimentação do Investidor",
  novo_lead: "Novo Investidor Identificado",
  manual_concluido: "Manual Concluído",
  simulacao: "Simulação Realizada",
  contato_whatsapp: "Contato Solicitado",
  engajamento_alto: "Engajamento Elevado",
  reuniao: "Lembrete de Reunião",
  reuniao_solicitada: "Nova Solicitação de Reunião",
  reuniao_confirmada: "Reunião Confirmada",
  reuniao_cancelada: "Reunião Cancelada",
  reuniao_alterada: "Alteração de Horário",
};

const ALERTS_KEY = "atlas:workspace-alerts:v1";
const LAST_SEEN_KEY = "atlas:investor-last-seen:v1";
const READ_KEY = "atlas:workspace-alerts-read:v1";

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

function pushAlert(alert: Omit<WorkspaceAlert, "id">, stableId?: string) {
  const id = stableId ?? `wa_${alert.category}_${alert.investorId ?? "x"}_${Date.parse(alert.date)}`;
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
      actionUrl: m.meetUrl || m.meetingProviderUrl || undefined,
    });
  }
}

/**
 * Ciclo de vida comercial das reuniões do executivo: solicitação,
 * confirmação, alteração de horário e cancelamento.
 */
export function evaluateMeetingLifecycle(session: ExecutiveSession) {
  const meetings = listMeetings({ executiveId: session.userId });
  for (const m of meetings) {
    const when = new Date(m.scheduledAt).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (m.status === "Solicitada") {
      const options = (m.requestedSlots?.length ? m.requestedSlots : [m.scheduledAt])
        .map((iso) =>
          new Date(iso).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        )
        .join(" ou ");
      pushAlert({
        ownerUserId: session.userId,
        category: "reuniao_solicitada",
        title: `${m.investorName} solicitou uma conversa`,
        description: `Horários preferenciais: ${options}. Confirme um deles na Central de Reuniões.`,
        investorId: m.investorId,
        date: m.createdAt,
      });
      continue;
    }
    const category: WorkspaceAlertCategory | null =
      m.status === "Confirmada"
        ? "reuniao_confirmada"
        : m.status === "Reagendada"
          ? "reuniao_alterada"
          : m.status === "Cancelada"
            ? "reuniao_cancelada"
            : null;
    if (!category) continue;
    pushAlert({
      ownerUserId: session.userId,
      category,
      title:
        category === "reuniao_confirmada"
          ? `Reunião confirmada com ${m.investorName}`
          : category === "reuniao_alterada"
            ? `Horário alterado — ${m.investorName}`
            : `Reunião cancelada — ${m.investorName}`,
      description:
        category === "reuniao_cancelada"
          ? `Encontro de ${when} cancelado.${m.cancelReason ? ` Motivo: ${m.cancelReason}.` : ""}`
          : `${when}${m.meetUrl ? ` · ${m.meetUrl}` : ""}`,
      investorId: m.investorId,
      date: m.updatedAt,
    });
  }
}

/**
 * Alertas automáticos derivados do Journey Engine. Cada marco relevante
 * da jornada vira um alerta para o executivo responsável.
 */
/**
 * Novo Lead identificado — vale para qualquer Lead da carteira visível,
 * inclusive os que chegam de outro dispositivo e ainda não possuem
 * jornada registrada neste navegador. Nome, origem, data e hora vêm
 * sempre da base real.
 */
export function evaluateNewLeads(session: ExecutiveSession) {
  const all = listAllInvestors();
  const mine = canViewAllInvestors(session.activeRole)
    ? all
    : all.filter((i) => i.assignedToUserId === session.userId);
  const originLabel: Record<string, string> = {
    green_sales: "Link personalizado (Green Sales)",
    portal: "Portal Velox",
    manual: "Manual do Investidor",
  };
  for (const inv of mine) {
    const created = inv.lastActivity;
    if (!created || Number.isNaN(Date.parse(created))) continue;
    const when = new Date(created);
    pushAlert(
      {
        ownerUserId: session.userId,
        category: "novo_lead",
        title: `Novo investidor: ${inv.name}`,
        description: `${originLabel[inv.origin ?? "manual"] ?? "Origem não informada"} · ${when.toLocaleDateString(
          "pt-BR",
        )} às ${when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
        investorId: inv.id,
        date: when.toISOString(),
      },
      // Um único alerta por Lead — a atividade seguinte não duplica o aviso.
      `wa_novo_lead_${inv.id}`,
    );
  }
}

export function evaluateJourneyAlerts(session: ExecutiveSession) {
  for (const record of listJourneys()) {
    const owner = record.executiveId ?? session.userId;
    if (owner !== session.userId) continue;
    const s = summarizeJourney(record);

    pushAlert({
      ownerUserId: owner,
      category: "novo_lead",
      title: `${record.name} iniciou a jornada`,
      description: `Origem: ${record.origin}${record.campaign ? ` · Campanha: ${record.campaign}` : ""}.`,
      investorId: record.investorId,
      date: record.createdAt,
    });

    if (record.progress.percent >= 100) {
      pushAlert({
        ownerUserId: owner,
        category: "manual_concluido",
        title: `${record.name} concluiu o Manual`,
        description: `${s.effectiveMinutes} min efetivos de leitura · engajamento ${s.engagementLabel}.`,
        investorId: record.investorId,
        date: record.lastActivityAt,
      });
    }

    if (record.counters.simulations > 0) {
      pushAlert({
        ownerUserId: owner,
        category: "simulacao",
        title: `${record.name} simulou potencial de receita`,
        description: `${record.counters.simulations} simulação(ões) registrada(s).`,
        investorId: record.investorId,
        date: record.lastActivityAt,
      });
    }

    if (record.counters.whatsapp > 0) {
      pushAlert({
        ownerUserId: owner,
        category: "contato_whatsapp",
        title: `${record.name} pediu contato`,
        description: "Solicitou atendimento pelo WhatsApp.",
        investorId: record.investorId,
        date: record.lastActivityAt,
      });
    }

    if (s.contactReadiness.ready) {
      pushAlert({
        ownerUserId: owner,
        category: "engajamento_alto",
        title: `${record.name} está no momento ideal para contato`,
        description: s.contactReadiness.reason,
        investorId: record.investorId,
        date: record.lastActivityAt,
      });
    }
  }
}

export function runWorkspaceAlertEvaluation(session: ExecutiveSession) {
  /**
   * Alertas automáticos do Journey Engine — todo evento relevante da
   * jornada gera um alerta para o executivo responsável, sem qualquer
   * dado fictício.
   */
  evaluateInvestorMovement();
  evaluateNewLeads(session);
  evaluateJourneyAlerts(session);
  try {
    evaluateMeetingReminders(session);
    evaluateMeetingLifecycle(session);
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

/**
 * Histórico completo (inclusive arquivados) — consumido pela Central de
 * Alertas. Mesma fonte de dados do Drawer, sem duplicação de lógica.
 */
export function listWorkspaceAlertHistory(session: ExecutiveSession): WorkspaceAlert[] {
  return readAlerts()
    .filter((a) => a.ownerUserId === session.userId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ----------------------- Estado de leitura (não lidos) --------------------- */

function readReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function isAlertRead(id: string): boolean {
  return readReadIds().includes(id);
}

/** Alertas ativos ainda não lidos pelo executivo. */
export function unreadWorkspaceAlerts(session: ExecutiveSession): WorkspaceAlert[] {
  const read = new Set(readReadIds());
  return listWorkspaceAlerts(session).filter((a) => !read.has(a.id));
}

/** Marca como lidos todos os alertas ativos do executivo. */
export function markWorkspaceAlertsRead(session: ExecutiveSession) {
  if (typeof window === "undefined") return;
  const ids = new Set(readReadIds());
  for (const a of listWorkspaceAlerts(session)) ids.add(a.id);
  window.localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)));
}

export function onWorkspaceAlertsChange(cb: () => void) {
  return onEvent((e) => {
    // Atualização automática: novos leads, atualizações de lead, retornos
    // ao Portal e movimentações de reunião.
    if (
      e.type === "investor.reactivated" ||
      e.type === "meeting.created" ||
      e.type === "meeting.requested" ||
      e.type === "meeting.confirmed" ||
      e.type === "meeting.rescheduled" ||
      e.type === "meeting.cancelled" ||
      e.type === "profile.updated" ||
      e.type === "lead.status.changed"
    ) {
      cb();
    }
  });
}
