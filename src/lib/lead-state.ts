/**
 * Estado operacional do Lead — regra ÚNICA e AUTOMÁTICA.
 *
 * Vale igualmente para Portal Velox e Green Sales: nunca pode existir
 * divergência entre os dois ambientes.
 *
 *  🟢 novo          — Lead novo, ou com atualização ainda não visualizada.
 *  🟡 em_andamento  — Oportunidade em andamento (card já aberto pelo executivo).
 *  ⚪ encerrado     — Encerramento manual, exclusivamente pelo menu (⋮).
 *
 * Não existe alteração manual de cor: o indicador reflete a situação real.
 */
import { emitEvent, onEvent } from "@/lib/events/bus";
import { notifySync } from "@/lib/sync-bus";
import { loadLeads, updateLead } from "@/lib/leads";
import { updateWorkspaceOperational } from "@/lib/workspace-operational.functions";

export type LeadState = "novo" | "em_andamento" | "encerrado";

export const LEAD_STATE_META: Record<
  LeadState,
  { label: string; hint: string; dot: string; text: string; border: string }
> = {
  novo: {
    label: "Novo / atualizado",
    hint: "Lead novo ou com atualização ainda não visualizada.",
    dot: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
  },
  em_andamento: {
    label: "Em andamento",
    hint: "Oportunidade em andamento — Lead já visualizado.",
    dot: "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]",
    text: "text-amber-300",
    border: "border-amber-400/40",
  },
  encerrado: {
    label: "Encerrado",
    hint: "Negociação encerrada pelo executivo.",
    dot: "bg-[color:var(--muted-foreground)]/60",
    text: "text-[color:var(--muted-foreground)]",
    border: "border-[color:var(--border)]",
  },
};

function entryFor(leadId: string) {
  return loadLeads().find((lead) => lead.id === leadId);
}

function persist(leadId: string, patch: { viewedAt?: string | null; closedAt?: string | null }) {
  updateLead(leadId, patch);
  void updateWorkspaceOperational({ data: { id: leadId, ...patch } })
    .then(() => notifySync("status"))
    .catch(() => undefined);
}

export type LeadStateSubject = { id: string; lastActivity?: string };

/** Regra automática — nunca depende de escolha manual de cor. */
export function resolveLeadState(subject: LeadStateSubject): LeadState {
  const entry = entryFor(subject.id);
  if (entry?.closedAt) return "encerrado";
  if (!entry?.viewedAt) return "novo";
  const activity = subject.lastActivity ? Date.parse(subject.lastActivity) : 0;
  const viewed = Date.parse(entry.viewedAt);
  if (Number.isFinite(activity) && activity > viewed) return "novo";
  return "em_andamento";
}

/** Chamado quando o executivo abre o card/perfil: verde → amarelo. */
export function markLeadViewed(leadId: string, actorId?: string | null): void {
  const entry = entryFor(leadId);
  if (entry?.closedAt) return;
  persist(leadId, { viewedAt: new Date().toISOString() });
  emitEvent({
    type: "lead.status.changed",
    investorId: leadId,
    actorId: actorId ?? null,
    payload: { to: "em_andamento" },
  });
}

/** Encerramento manual — disponível apenas no menu de três pontos. */
export function closeLead(leadId: string, actorId?: string | null): void {
  persist(leadId, { closedAt: new Date().toISOString() });
  emitEvent({
    type: "lead.status.changed",
    investorId: leadId,
    actorId: actorId ?? null,
    payload: { to: "encerrado" },
  });
}

/** Reabertura manual — volta ao ciclo automático. */
export function reopenLead(leadId: string, actorId?: string | null): void {
  const entry = entryFor(leadId);
  persist(leadId, { closedAt: null });
  emitEvent({
    type: "lead.status.changed",
    investorId: leadId,
    actorId: actorId ?? null,
    payload: { to: entry?.viewedAt ? "em_andamento" : "novo" },
  });
}

export function isLeadClosed(leadId: string): boolean {
  return !!entryFor(leadId)?.closedAt;
}

export function onLeadStateChange(cb: (leadId: string | null) => void): () => void {
  return onEvent((e) => {
    if (e.type === "lead.status.changed") cb(e.investorId ?? null);
  });
}
