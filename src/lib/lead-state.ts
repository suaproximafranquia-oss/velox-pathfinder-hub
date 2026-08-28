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
import { loadLeads, patchCachedLead } from "@/lib/leads";
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

/**
 * PERSISTÊNCIA CONFIRMADA — nunca mais otimista nem silenciosa.
 *
 * O cache local só é atualizado DEPOIS que o servidor confirma a
 * gravação. Se a gravação falhar (erro ou nenhuma linha afetada), o
 * estado anterior é mantido, o cache é revertido e o executivo é
 * avisado — antes, o Workspace mostrava "em andamento" e o lead voltava
 * para "Novo" na próxima sincronização.
 */
function persist(
  leadId: string,
  patch: { viewedAt?: string | null; closedAt?: string | null },
): Promise<boolean> {
  const previous = entryFor(leadId);
  const rollback: { viewedAt?: string | null; closedAt?: string | null } = {};
  if (patch.viewedAt !== undefined) rollback.viewedAt = previous?.viewedAt ?? null;
  if (patch.closedAt !== undefined) rollback.closedAt = previous?.closedAt ?? null;

  patchCachedLead(leadId, patch);
  return updateWorkspaceOperational({ data: { id: leadId, ...patch } })
    .then((result) => {
      const updated = (result as { updated?: number } | undefined)?.updated ?? 0;
      if (!updated) throw new Error("Nenhum registro atualizado.");
      notifySync("status");
      return true;
    })
    .catch((error: unknown) => {
      patchCachedLead(leadId, rollback);
      notifySync("status");
      const message =
        error instanceof Error ? error.message : "Falha ao registrar a operação.";
      void import("sonner")
        .then(({ toast }) =>
          toast.error("Não foi possível registrar esta operação no servidor.", {
            description: message,
          }),
        )
        .catch(() => undefined);
      return false;
    });
}

export type LeadStateSubject = { id: string; lastActivity?: string };

/**
 * Regra automática — nunca depende de escolha manual de cor.
 *
 * `lastActivity` recebido aqui JÁ deve representar atividade real do
 * investidor (ver `@/lib/events/investor-activity`). Ação do executivo
 * não produz novidade: um lead trabalhado pelo executivo permanece
 * "em andamento".
 */
export function resolveLeadState(subject: LeadStateSubject): LeadState {
  const entry = entryFor(subject.id);
  if (entry?.closedAt) return "encerrado";
  if (!entry?.viewedAt) return "novo";
  const activity = subject.lastActivity ? Date.parse(subject.lastActivity) : 0;
  const viewed = Date.parse(entry.viewedAt);
  if (Number.isFinite(activity) && activity > viewed) return "novo";
  return "em_andamento";
}

/**
 * Chamado quando o executivo abre o card/perfil: verde → amarelo.
 *
 * GUARDA DE MUDANÇA REAL — o lead já visualizado e não encerrado JÁ está
 * em andamento: reabrir o card, voltar para a tela, dar F5 ou remontar o
 * componente não é acontecimento algum. Sem esta guarda cada montagem
 * gravava `viewed_at` de novo e emitia "Status do Lead atualizado",
 * poluindo o histórico da jornada.
 */
export function markLeadViewed(leadId: string, actorId?: string | null): void {
  const entry = entryFor(leadId);
  if (entry?.closedAt) return;
  if (entry?.viewedAt) return; // nada mudou — nenhum evento, nenhuma escrita
  void persist(leadId, { viewedAt: new Date().toISOString() }).then((ok) => {
    if (!ok) return;
    emitEvent({
      type: "lead.status.changed",
      investorId: leadId,
      actorId: actorId ?? null,
      payload: { to: "em_andamento" },
      dedupeKey: `lead.status.changed:${leadId}:em_andamento`,
    });
  });
}

/**
 * Encerramento manual — disponível apenas no menu de três pontos.
 * Guarda de mudança real + chave determinística: duplo clique ou
 * reprocessamento não geram duas linhas no histórico.
 */
export function closeLead(leadId: string, actorId?: string | null): void {
  if (entryFor(leadId)?.closedAt) return;
  void persist(leadId, { closedAt: new Date().toISOString() }).then((ok) => {
    if (!ok) return;
    emitEvent({
      type: "lead.status.changed",
      investorId: leadId,
      actorId: actorId ?? null,
      payload: { to: "encerrado" },
      dedupeKey: `lead.status.changed:${leadId}:encerrado`,
    });
  });
}

/** Reabertura manual — volta ao ciclo automático. */
export function reopenLead(leadId: string, actorId?: string | null): void {
  const entry = entryFor(leadId);
  if (!entry?.closedAt) return; // já aberto — nada mudou
  const target = entry.viewedAt ? "em_andamento" : "novo";
  void persist(leadId, { closedAt: null }).then((ok) => {
    if (!ok) return;
    emitEvent({
      type: "lead.status.changed",
      investorId: leadId,
      actorId: actorId ?? null,
      payload: { to: target },
      dedupeKey: `lead.status.changed:${leadId}:reabertura:${target}`,
    });
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
