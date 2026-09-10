/**
 * CARD OPERACIONAL DE UMA AÇÃO — peça única, reaproveitada.
 *
 * Este é EXATAMENTE o card que a Ação do Dia executa. Ele foi extraído
 * para poder ser aberto também sobre a Central de Operações, na
 * resolução de uma pendência já pulada. Nenhuma regra nova existe aqui:
 * mesmo adaptador, mesmas funções de servidor, mesma Biblioteca, mesma
 * `actionKey`. A fila e a posição 1 continuam sendo responsabilidade da
 * Ação do Dia e do servidor.
 */
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  MessageSquare,
  SkipForward,
  StickyNote,
  X,
} from "lucide-react";
import type {
  AdapterResult,
  DailyActionsAdapter,
  StepMessageView,
} from "@/lib/crm/daily-actions.adapter";
import { copyToClipboard } from "@/lib/clipboard";
import {
  clearStepMessagePrefetch,
  primeStepMessage,
  stepMessageKey,
  takeStepMessage,
} from "@/lib/crm/daily-actions-prefetch";
import { KIND_LABEL, operationalTime, type DailyAction } from "@/lib/crm/daily-actions";
import { Button } from "@/components/ui/button";

/**
 * LIGAÇÃO OFICIAL: item da fila legada (com `cadence`) OU ação interna
 * de ligação da régua V2 (fonte `queue`).
 */
export function isCallAction(item: DailyAction | null | undefined): boolean {
  return (
    Boolean(item) && item!.kind === "ligacao" && (Boolean(item!.cadence) || item!.source === "queue")
  );
}

/** Cabeçalho oficial: "LIGAÇÃO — ETAPA E0", "MENSAGEM — ETAPA E0"… */
export function actionHeadline(item: DailyAction): string {
  if (item.source === "queue" && item.stepLabel) {
    const base = item.kind === "ligacao" ? "Ligação" : "Mensagem";
    return `${base} — Etapa ${item.stepLabel}`;
  }
  return `${KIND_LABEL[item.kind]}${item.stepLabel ? ` · ${item.stepLabel}` : ""}`;
}

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}` : iso;
}

/** Data completa (dd/mm/aaaa) de um instante, em America/Sao_Paulo. */
export function formatFullDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function DailyActionCard({
  item,
  adapter,
  locked,
  onOpenLead,
  onResolved,
  onReload,
  onUndoableChange,
  onComplete,
}: {
  item: DailyAction;
  adapter: DailyActionsAdapter;
  /** Fora da janela operacional nada é executado. */
  locked: boolean;
  onOpenLead?: (leadId: string, scope: string | null) => void;
  /** A ação saiu da lista (concluída, pulada ou recolocada na fila). */
  onResolved: (
    actionKey: string,
    result: {
      requeue?: boolean;
      message?: string;
      queue?: DailyAction[];
      /** Peça a releitura oficial ao painel (confirmação em segundo plano). */
      reload?: boolean;
    },
  ) => void;
  /** Releitura da lista oficial após uma execução. */
  onReload?: (silent?: boolean) => void;
  /** Último resultado de ligação, reversível pelo painel que hospeda o card. */
  onUndoableChange?: (item: DailyAction | null) => void;
  /** Barreira de conclusão da Ação do Dia /f; não usada na recuperação ou demo. */
  onComplete?: (item: DailyAction, run: () => Promise<AdapterResult>, fallback: string) => Promise<void>;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [callAwaitingRing, setCallAwaitingRing] = useState(false);
  const [callPending, setCallPending] = useState<{
    outcome: "SIM" | "NAO";
    rang: boolean | null;
  } | null>(null);
  const [callNote, setCallNote] = useState("");
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [note, setNote] = useState("");
  const [meetingNote, setMeetingNote] = useState("");
  const [followUpNoContact, setFollowUpNoContact] = useState(false);
  const [followUpPending, setFollowUpPending] = useState<{ contacted: boolean; willReschedule?: boolean } | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [message, setMessage] = useState<StepMessageView | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageNote, setMessageNote] = useState("");
  const [copied, setCopied] = useState(false);

  /** Trocar de ação limpa os rascunhos da ação anterior. */
  useEffect(() => {
    setCallAwaitingRing(false);
    setCallPending(null);
    setCallNote("");
    setSkipOpen(false);
    setSkipReason("");
    setNote("");
    setMeetingNote("");
    setFollowUpNoContact(false);
    setFollowUpPending(null);
    setRescheduleAt("");
    setMessage(null);
    setMessageOpen(false);
    setMessageNote("");
    setCopied(false);
    setFeedback(null);
  }, [item.actionKey]);

  /**
   * PRÉ-GATILHO — SOMENTE ANTECIPAÇÃO DE PROCESSAMENTO.
   *
   * "Não atendeu" tem consequência determinística: a régua segue dentro
   * da MESMA etapa (2ª ligação e, depois, a mensagem oficial). Enquanto
   * o Executivo não clica em "Concluído", a mensagem dessa etapa já é
   * lida em segundo plano e o caminho do servidor é aquecido.
   *
   * "Atendeu" não gera mensagem: nada é preparado.
   *
   * Nada aqui efetiva, cria fila, avança o motor, grava histórico ou
   * marca execução. Trocar a decisão ou abandonar o card descarta o
   * preparo, e a autoridade continua sendo a fila oficial do servidor.
   */
  const primedRef = useRef<{ actionKey: string; key: string } | null>(null);
  useEffect(() => {
    if (!isCallAction(item) || locked) return;
    const key = stepMessageKey(item.leadId, item.stepLabel);
    if (callPending?.outcome === "NAO") {
      if (!key) return;
      adapter.prewarmOutcome?.();
      primeStepMessage(key, () => adapter.loadMessage(item).catch(() => null));
      primedRef.current = { actionKey: item.actionKey, key };
      return;
    }
    // Decisão trocada (ou desfeita) dentro do MESMO card: descarta.
    if (primedRef.current?.actionKey === item.actionKey) {
      clearStepMessagePrefetch();
      primedRef.current = null;
    }
  }, [item, locked, adapter, callPending?.outcome]);


  function applyResult(result: {
    requeue?: boolean;
    message?: string;
    queue?: DailyAction[];
    reload?: boolean;
  }) {
    onResolved(item.actionKey, result);
    if (result.message) setFeedback(result.message);
  }

  /**
   * TROCA IMEDIATA DO CARD.
   *
   * A ação sai da tela no clique e a próxima assume na hora. A gravação
   * segue em segundo plano e, quando o servidor responde, é a FILA
   * OFICIAL dele que passa a comandar a lista — inclusive quando o MESMO
   * investidor tem outra ação liberada. O servidor continua sendo a
   * autoridade: se ele recusar (fora de ordem, já resolvida), a lista é
   * relida e o motivo aparece na tela.
   *
   * O modo demonstração (fila contínua, `requeue`) não usa este caminho.
   */
  function resolveNow(run: () => Promise<AdapterResult>, fallback: string) {
    if (onComplete) {
      void onComplete(item, run, fallback);
      return;
    }
    if (adapter.demoLabel) {
      void (async () => {
        const result = await run().catch(() => ({ ok: false }) as AdapterResult);
        if (result.ok) applyResult(result);
        else setFeedback(result.message ?? fallback);
      })();
      return;
    }
    const key = item.actionKey;
    onResolved(key, {});
    void (async () => {
      try {
        const result = await run();
        if (result.ok) {
          onResolved(key, {
            queue: result.queue,
            message: result.message,
            reload: !result.queue,
          });
        } else {
          onResolved(key, { message: result.message ?? fallback, reload: true });
        }
      } catch (error) {
        onResolved(key, {
          message: error instanceof Error ? error.message : fallback,
          reload: true,
        });
      }
    })();
  }

  /**
   * LIGAÇÃO. "Atendeu?" é apenas o RESULTADO da tentativa; só o botão
   * "Concluído" encerra a ação.
   */
  function completeCall(outcome: "SIM" | "NAO", rang?: boolean | null) {
    if (!isCallAction(item) || locked) return;
    // Atendeu: a mensagem da etapa perde a finalidade — preparo descartado.
    if (outcome === "SIM") {
      clearStepMessagePrefetch();
      primedRef.current = null;
    }
    const observation = callNote.trim();
    setCallAwaitingRing(false);
    setCallPending(null);
    setCallNote("");
    onUndoableChange?.(item.source === "queue" && adapter.undoCallOutcome ? item : null);
    resolveNow(async () => {
      // A observação é histórico: nunca atrasa a troca do card.
      if (observation.length >= 3) await adapter.addNote(item, observation).catch(() => undefined);
      return adapter.completeCall(item, outcome, rang);
    }, "Não foi possível registrar a ligação.");
  }


  /** PULAR — a justificativa é obrigatória e vira histórico oficial. */
  async function handleSkip() {
    if (skipReason.trim().length < 3) {
      setFeedback("Escreva a justificativa antes de pular esta ação.");
      return;
    }
    setBusy(true);
    try {
      const result = await adapter.skip(item, skipReason.trim());
      if (result.ok) {
        setSkipReason("");
        setSkipOpen(false);
        applyResult(result);
      } else setFeedback(result.message ?? "Não foi possível pular a ação.");
    } finally {
      setBusy(false);
    }
  }

  /** OBSERVAÇÃO — registro operacional; a ação continua pendente. */
  async function handleNote() {
    if (note.trim().length < 3) {
      setFeedback("Escreva a observação antes de salvar.");
      return;
    }
    setBusy(true);
    try {
      const result = await adapter.addNote(item, note.trim());
      setNote("");
      setFeedback(result.message ?? "Observação registrada.");
    } finally {
      setBusy(false);
    }
  }

  /** REUNIÃO — desfecho registrado na própria reunião. */
  function handleMeetingOutcome(attended: boolean) {
    if (locked) return;
    const observation = meetingNote.trim();
    setMeetingNote("");
    resolveNow(
      () => adapter.resolveMeeting(item, attended, observation),
      "Não foi possível registrar o desfecho.",
    );
  }

  /** AGENDAMENTO GREENSALES — "Houve contato de agendamento?" */
  function handleFollowUpContact(decision: { contacted: boolean; willReschedule?: boolean }) {
    if (locked) return;
    const observation = meetingNote.trim();
    setMeetingNote("");
    setFollowUpNoContact(false);
    resolveNow(
      () => adapter.resolveFollowUpContact(item, { ...decision, note: observation }),
      "Não foi possível registrar o desfecho.",
    );
  }

  /** OBRIGAÇÃO DE 24h — "Deseja encerrar esse fluxo?" */
  function handleFollowUpReview(close: boolean) {
    if (locked) return;
    const observation = meetingNote.trim();
    setMeetingNote("");
    resolveNow(
      () => adapter.resolveFollowUpReview(item, { close, note: observation }),
      "Não foi possível registrar a decisão.",
    );
  }

  function handleReschedule() {
    if (locked) return;
    if (!rescheduleAt) {
      setFeedback("Informe a nova data e hora da reunião.");
      return;
    }
    const when = new Date(rescheduleAt).toISOString();
    const observation = meetingNote.trim();
    setRescheduleAt("");
    setMeetingNote("");
    resolveNow(
      () => adapter.rescheduleMeeting(item, when, observation),
      "Não foi possível reagendar.",
    );
  }


  /**
   * MENSAGEM — leitura do texto oficial e cópia imediata. Esta tela
   * nunca envia nada e COPIAR NÃO CONCLUI a ação.
   */
  async function handleOpenMessage() {
    setBusy(true);
    setMessage(null);
    try {
      /**
       * Se o pré-gatilho da ligação anterior já leu esta mesma mensagem
       * oficial, ela é reaproveitada; caso contrário, leitura normal.
       *
       * LEITURA QUE FALHA NÃO PODE SUMIR COM A AÇÃO: a exceção é tratada
       * aqui, o card permanece na tela e o motivo aparece para o
       * Executivo. Copiar continua não concluindo nada.
       */
      let view: StepMessageView | null = null;
      try {
        const prepared = takeStepMessage(
          stepMessageKey(item.leadId, item.messageRef?.step ?? item.stepLabel),
        );
        view = (await (prepared ?? adapter.loadMessage(item))) ?? null;
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Não foi possível ler a mensagem oficial. Tente novamente.",
        );
        return;
      }
      setMessage(view);
      setCopied(false);
      setMessageOpen(true);
      if (!view) {
        setFeedback("Esta ação não tem mensagem oficial vinculada.");
        return;
      }
      await copyMessageBody(view.body);
    } finally {
      setBusy(false);
    }
  }

  async function copyMessageBody(raw: string | null | undefined) {
    const body = (raw ?? "").trim();
    if (!body) {
      setCopied(false);
      return false;
    }
    const ok = await copyToClipboard(body);
    setCopied(ok);
    setFeedback(
      ok
        ? "Mensagem copiada da Biblioteca."
        : "A cópia não foi realizada — selecione o texto na janela e copie manualmente.",
    );
    return ok;
  }

  function handleRegisterMessage() {
    if (locked) return;
    if (!copied) {
      setFeedback("Copie a mensagem oficial antes de concluir.");
      return;
    }
    const observation = messageNote.trim();
    setMessageNote("");
    setCopied(false);
    setMessageOpen(false);
    resolveNow(
      () => adapter.registerMessage(item, observation),
      "Não foi possível registrar a mensagem.",
    );
  }


  /**
   * AVISO DE ATIVIDADE DO PORTAL — informação, não tarefa.
   *
   * Não é etapa, não é ligação, não é mensagem e não envia nada ao
   * investidor. "Concluído" encerra apenas o aviso; "Ver ficha completa"
   * abre o investidor oficial.
   */
  if (item.kind === "alerta_portal") {
    return (
      <div className="space-y-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
          Aviso · Atividade no Portal
        </p>
        <h3 className="font-display text-2xl leading-tight text-white">{item.title}</h3>
        {item.alertAt && (
          <p className="text-sm text-white/55">
            Acessou em {formatFullDay(item.alertAt)} às {operationalTime(item.alertAt)}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!adapter.concludeAlert) return;
              setBusy(true);
              void adapter
                .concludeAlert(item)
                .then((result) => {
                  if (result.ok) applyResult(result);
                  else setFeedback(result.message ?? "Não foi possível concluir o aviso.");
                })
                .finally(() => setBusy(false));
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Concluído
          </button>
          {item.leadId && onOpenLead && (
            <button
              type="button"
              onClick={() => onOpenLead(item.leadId as string, item.scope ?? null)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
            >
              <ExternalLink className="h-4 w-4" /> Ver ficha completa
            </button>
          )}
        </div>
        {feedback && <p className="text-[11px] text-[color:var(--gold)]">{feedback}</p>}
      </div>
    );
  }

  return (
    <>
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          {actionHeadline(item)}
          {item.startsAt ? ` · ${operationalTime(item.startsAt)}` : ""}
          {item.bucket === "atrasada" ? ` · atrasada desde ${formatDay(item.dueDate)}` : ""}
        </p>
        <h3 className="mt-2 font-display text-3xl leading-tight text-white">
          {item.name || "Sem nome"}
        </h3>
        {item.kind !== "compromisso" && (
          <a
            href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
            className="mt-2 inline-block text-xl text-[color:var(--gold)]"
          >
            {item.phone || "Sem telefone"}
          </a>
        )}
        <p className="mt-2 text-sm text-white/55">{item.source === "queue" && item.kind === "ligacao" ? `Ligação ${(item.queueActionOrder ?? 1) > 1 ? "02" : "01"}` : item.title}</p>
        {item.attempts.length > 0 && (
          <p className="mt-3 text-[11px] text-white/45">
            Histórico:{" "}
            {item.attempts
              .map(
                (a) =>
                  `L${a.step} ${formatDay(a.date)} — ${a.outcome === "SIM" ? "atendeu" : "não atendeu"}`,
              )
              .join(" · ")}
          </p>
        )}
        {item.secondary && item.secondary.length > 0 && (
          <p className="mt-3 text-[11px] text-white/45">
            Também pendente para este investidor:{" "}
            {item.secondary
              .map((s) => `${KIND_LABEL[s.kind]}${s.stepLabel ? ` ${s.stepLabel}` : ""}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* LIGAÇÃO — resultado da tentativa. */}
        {isCallAction(item) && !callAwaitingRing && !callPending && (
          <>
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
              O investidor atendeu?
            </span>
            <button
              type="button"
              onClick={() => setCallPending({ outcome: "SIM", rang: true })}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Atendeu
            </button>
            <button
              type="button"
              onClick={() => setCallAwaitingRing(true)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              <X className="h-4 w-4" /> Não atendeu
            </button>
          </>
        )}
        {isCallAction(item) && callAwaitingRing && (
          <>
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">Chamou?</span>
            <button
              type="button"
              onClick={() => {
                setCallAwaitingRing(false);
                setCallPending({ outcome: "NAO", rang: true });
              }}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              Sim, chamou
            </button>
            <button
              type="button"
              onClick={() => {
                setCallAwaitingRing(false);
                setCallPending({ outcome: "NAO", rang: false });
              }}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              Não chamou
            </button>
            <button
              type="button"
              onClick={() => setCallAwaitingRing(false)}
              className="text-[11px] text-white/40 underline underline-offset-4"
            >
              voltar
            </button>
          </>
        )}
        {item.kind === "reuniao" && item.followUp?.mode === "revisao_24h" && (
          <>
            <button
              type="button"
              onClick={() => void handleFollowUpReview(true)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              <X className="h-4 w-4" /> Sim, encerrar
            </button>
            <button
              type="button"
              onClick={() => void handleFollowUpReview(false)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Não, retomar
            </button>
          </>
        )}
        {item.kind === "reuniao" && item.followUp?.mode === "contato" && !followUpNoContact && !followUpPending && (
          <>
            <button
              type="button"
              onClick={() => setFollowUpPending({ contacted: true })}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Sim, houve contato
            </button>
            <button
              type="button"
              onClick={() => setFollowUpNoContact(true)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              <X className="h-4 w-4" /> Não houve contato
            </button>
          </>
        )}
        {item.kind === "reuniao" && item.followUp?.mode === "contato" && followUpNoContact && !followUpPending && (
          <>
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/50">
              Deseja reagendar?
            </span>
            <button
              type="button"
              onClick={() => setFollowUpPending({ contacted: false, willReschedule: true })}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-40"
            >
              Sim, vou reagendar no GreenSales
            </button>
            <button
              type="button"
              onClick={() => setFollowUpPending({ contacted: false, willReschedule: false })}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => setFollowUpNoContact(false)}
              className="text-[11px] text-white/40 underline underline-offset-4"
            >
              voltar
            </button>
          </>
        )}
        {item.kind === "reuniao" && !item.followUp && (
          <>
            <button
              type="button"
              onClick={() => void handleMeetingOutcome(true)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Compareceu
            </button>
            <button
              type="button"
              onClick={() => void handleMeetingOutcome(false)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              <X className="h-4 w-4" /> Não compareceu
            </button>
          </>
        )}
        {item.kind === "mensagem" && (
          <button
            type="button"
            onClick={() => void handleOpenMessage()}
            disabled={busy || locked}
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-40"
          >
            <MessageSquare className="h-4 w-4" />
            {item.stepLabel ? `Copiar mensagem — Etapa ${item.stepLabel}` : "Copiar mensagem"}
          </button>
        )}

        {item.leadId && onOpenLead && (
          <button
            type="button"
            onClick={() => onOpenLead(item.leadId as string, item.scope ?? null)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
          >
            <ExternalLink className="h-4 w-4" /> Ver ficha completa
          </button>
        )}
        <button
          type="button"
          onClick={() => setSkipOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
        >
          <SkipForward className="h-4 w-4" /> Pular
        </button>
      </div>

      {/* LIGAÇÃO — confirmação final. */}
      {isCallAction(item) && callPending && (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            Resultado: {callPending.outcome === "SIM" ? "Atendeu" : "Não atendeu"}
            {callPending.outcome === "NAO" ? (callPending.rang ? " · chamou" : " · não chamou") : ""}
          </p>
          <input
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            placeholder="Observação da ligação (opcional)"
            className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void completeCall(callPending.outcome, callPending.rang)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Concluído
            </button>
            <button
              type="button"
              onClick={() => {
                setCallPending(null);
                setCallNote("");
              }}
              className="text-[11px] text-white/40 underline underline-offset-4"
            >
              alterar resultado
            </button>
          </div>
        </div>
      )}

      {/* AGENDAMENTO GREENSALES — pergunta oficial e observação. */}
      {item.kind === "reuniao" && item.followUp && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--gold)]/80">
            {item.followUp.mode === "revisao_24h"
              ? "Ontem houve um agendamento em que não houve contato e você optou por não reagendar. Deseja encerrar esse fluxo?"
              : "Houve contato de agendamento?"}
          </span>
          {followUpPending?.willReschedule && <span className="text-[11px] text-white/40">
            Reagendamentos são feitos no GreenSales — o Portal atualiza automaticamente.
          </span>}
          <input
            value={meetingNote}
            onChange={(e) => setMeetingNote(e.target.value)}
            placeholder="Observação (opcional)"
            className="min-w-[220px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
          />
          {followUpPending && <div className="flex w-full flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{followUpPending.contacted ? "Houve contato" : "Não houve contato"}</span>
            <Button disabled={busy || locked} onClick={() => handleFollowUpContact(followUpPending)}><Check className="h-4 w-4" /> Concluído</Button>
            <Button variant="ghost" onClick={() => { setFollowUpPending(null); setFollowUpNoContact(false); }}>Alterar resultado</Button>
          </div>}
        </div>
      )}

      {/* REUNIÃO — reagendamento na própria reunião oficial. */}
      {item.kind === "reuniao" && !item.followUp && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">Reagendar</span>
          <input
            type="datetime-local"
            value={rescheduleAt}
            onChange={(e) => setRescheduleAt(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80"
          />
          <button
            type="button"
            onClick={() => void handleReschedule()}
            disabled={busy}
            className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            Confirmar nova data
          </button>
          <input
            value={meetingNote}
            onChange={(e) => setMeetingNote(e.target.value)}
            placeholder="Observação da reunião (opcional)"
            className="min-w-[220px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
          />
        </div>
      )}

      {/* PULAR — justificativa obrigatória, sempre com histórico. */}
      {skipOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/[0.06] p-3">
          <input
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Justificativa obrigatória para pular"
            className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={busy}
            className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
          >
            Pular com justificativa
          </button>
        </div>
      )}

      {/* OBSERVAÇÃO — a ação continua pendente. */}
      {!item.followUp && <div className="flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação operacional"
          className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => void handleNote()}
          disabled={busy}
          className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          <StickyNote className="mr-1 inline h-3.5 w-3.5" /> Salvar observação
        </button>
      </div>}

      {feedback && <p className="text-[11px] text-[color:var(--gold)]">{feedback}</p>}

      {/*
        As regras internas da régua (o que "Atendeu" cancela, quando a
        próxima ação nasce, o que o pulo registra) não ficam mais na
        tela: são comportamento do sistema, não instrução de execução.
      */}


      {/*
        MENSAGEM OFICIAL DA ETAPA — leitura da Biblioteca ativa. Esta
        janela NUNCA envia: o Executivo copia o texto e conduz a
        conversa por fora. O botão apenas registra o histórico.
      */}
      {messageOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--navy-deep)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                  Mensagem oficial
                  {message?.step ? ` · ${message.step}` : ""}
                  {item.messageRef?.flow ? ` · ${item.messageRef.flow}` : ""}
                  {message?.libraryVersion ? ` · v${message.libraryVersion}` : ""}
                </p>
                <p className="font-display text-lg text-white">{item.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setMessageOpen(false)}
                aria-label="Fechar mensagem"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {message?.body ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/85">
                  {message.body}
                </pre>
              ) : (
                <p className="text-sm text-rose-200">
                  {message?.blockedReason ??
                    "Sem versão ativa na Biblioteca para esta etapa. Nenhum texto é improvisado aqui."}
                </p>
              )}
              <p className="mt-3 text-[11px] text-white/35">
                Tratamento usado: {message?.investorNameUsed ?? "versão sem nome"} · Assinatura:{" "}
                {message?.executiveName ?? "—"}
                {message?.contentName ? ` · Link: ${message.contentName}` : ""}
              </p>
            </div>
            <div className="space-y-2 border-t border-white/10 px-4 py-3">
              <p className={`text-[11px] ${copied ? "text-emerald-200/80" : "text-amber-200/80"}`}>
                {copied
                  ? "Mensagem copiada. Copiar não conclui a ação."
                  : "Copie a mensagem oficial para liberar o botão Concluído."}
              </p>
              <input
                value={messageNote}
                onChange={(e) => setMessageNote(e.target.value)}
                placeholder="Observação operacional (opcional)"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyMessageBody(message?.body)}
                  disabled={!message?.body}
                  className="flex-1 rounded-lg border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-3 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                >
                  {copied ? "Copiar novamente" : "Copiar mensagem"}
                </button>
                {item.leadId && onOpenLead && (
                  <button
                    type="button"
                    onClick={() => onOpenLead(item.leadId as string, item.scope ?? null)}
                    className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10"
                  >
                    Ver ficha completa
                  </button>
                )}
              </div>
              {/* Nada é enviado pelo sistema: somente Concluído encerra
                  a ação, grava histórico, snapshot e a observação. */}
              <button
                type="button"
                onClick={() => void handleRegisterMessage()}
                disabled={busy || !message?.body || !copied}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  copied
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                    : "border-white/15 bg-white/[0.04] text-white/40"
                }`}
              >
                <Check className="mr-1 inline h-4 w-4" /> Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
