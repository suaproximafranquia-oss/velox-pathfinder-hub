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
import { flushSync } from "react-dom";
import {
  Check,
  ExternalLink,
  MessageCircle,
  MessageSquare,
  SkipForward,
  StickyNote,
  X,
} from "lucide-react";
import { normalizeWhatsappNumber } from "@/lib/whatsapp-number";
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
import { loadMessageForModal } from "@/lib/crm/daily-action-message";
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

/** Formatação exclusivamente visual; o valor persistido nunca é alterado. */
export function formatDailyActionPhone(phone: string): string {
  const raw = phone.trim();
  const normalized = normalizeWhatsappNumber(raw);
  if (!normalized.valid || !normalized.digits.startsWith("55")) return raw;

  const national = normalized.digits.slice(2);
  if (national.length === 11) {
    return `+55 (${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `+55 (${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }
  return raw;
}

/** URL de abertura manual do contato, sem texto e sem qualquer efeito operacional. */
export function dailyActionWhatsappUrl(phone: string | null | undefined): string | null {
  const normalized = normalizeWhatsappNumber(phone);
  return normalized.valid
    ? `https://api.whatsapp.com/send?phone=${normalized.digits}`
    : null;
}

export function openDailyActionWhatsapp(
  phone: string | null | undefined,
  openWindow: (url: string, target: string, features: string) => unknown = (url, target, features) =>
    window.open(url, target, features),
): boolean {
  const url = dailyActionWhatsappUrl(phone);
  if (!url) return false;
  openWindow(url, "_blank", "noopener,noreferrer");
  return true;
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
  const [followUpAttendance, setFollowUpAttendance] = useState<boolean | null>(null);
  const [followUpPending, setFollowUpPending] = useState<{ attended: boolean; willReschedule: boolean } | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [message, setMessage] = useState<StepMessageView | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageNote, setMessageNote] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const [whatsappFeedback, setWhatsappFeedback] = useState<string | null>(null);

  /** Trocar de ação limpa os rascunhos da ação anterior. */
  useEffect(() => {
    setCallAwaitingRing(false);
    setCallPending(null);
    setCallNote("");
    setSkipOpen(false);
    setSkipReason("");
    setNote("");
    setMeetingNote("");
    setFollowUpAttendance(null);
    setFollowUpPending(null);
    setRescheduleAt("");
    setMessage(null);
    setMessageOpen(false);
    setMessageNote("");
    setCopyStatus("idle");
    setWhatsappFeedback(null);
    setFeedback(null);
  }, [item.actionKey]);

  /**
   * PRÉ-GATILHO — SOMENTE ANTECIPAÇÃO DE PROCESSAMENTO.
   *
   * O resultado tem consequência determinística: a régua segue dentro
   * da MESMA etapa para a mensagem oficial. Enquanto
   * o Executivo não clica em "Concluído", a mensagem dessa etapa já é
   * lida em segundo plano e o caminho do servidor é aquecido.
   *
     * Toda ligação atendida prepara o contexto CONTATO_REALIZADO; o servidor
     * resolve esse contexto para a finalidade editorial oficial.
   *
   * Nada aqui efetiva, cria fila, avança o motor, grava histórico ou
   * marca execução. Trocar a decisão ou abandonar o card descarta o
   * preparo, e a autoridade continua sendo a fila oficial do servidor.
   */
  const primedRef = useRef<{ actionKey: string; key: string } | null>(null);
  useEffect(() => {
    if (!isCallAction(item) || locked) return;
    const baseKey = stepMessageKey(item.leadId, item.stepLabel);
    const key =
      callPending?.outcome === "SIM" && baseKey
        ? `${baseKey}::CONTATO_REALIZADO`
        : baseKey;
    if (callPending) {
      if (!key) return;
      adapter.prewarmOutcome?.();
      primeStepMessage(key, () => adapter.loadMessage(
        item,
        callPending.outcome === "SIM" ? "CONTATO_REALIZADO" : undefined,
      ).catch(() => null));
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
    void (async () => {
      try {
        const result = await run();
        if (result.ok) applyResult(result);
        else setFeedback(result.message ?? fallback);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : fallback);
      }
    })();
  }

  /** Conclui ligação e mensagem, em sequência, no único card aberto. */
  function completeCallAndMessage(outcome: "SIM" | "NAO", rang?: boolean | null) {
    if (!isCallAction(item) || locked) return;
    const observation = [callNote.trim(), messageNote.trim()].filter(Boolean).join(" · ");
    setCallAwaitingRing(false);
    setCallPending(null);
    setCallNote("");
    setMessageNote("");
    setMessageOpen(false);
    setCopyStatus("idle");
    onUndoableChange?.(item.source === "queue" && adapter.undoCallOutcome ? item : null);
    resolveNow(async () => {
      if (adapter.completeCallAndMessage) {
        return adapter.completeCallAndMessage(item, outcome, rang, observation);
      }
      if (observation.length >= 3) await adapter.addNote(item, observation).catch(() => undefined);
      const callResult = await adapter.completeCall(item, outcome, rang);
      if (!callResult.ok) return callResult;
      const messageItem = callResult.queue?.find((candidate) =>
        candidate.leadId === item.leadId &&
        candidate.stepLabel === item.stepLabel &&
        candidate.kind === "mensagem",
      );
      if (!messageItem) {
        return {
          ...callResult,
          message: "Ligação registrada; a mensagem permaneceu pendente para reconciliação.",
        };
      }
      return adapter.registerMessage(messageItem, observation);
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

  /** AGENDAMENTO GREENSALES — comparecimento + intenção de novo agendamento. */
  function handleFollowUpContact(decision: { attended: boolean; willReschedule: boolean }) {
    if (locked) return;
    const observation = meetingNote.trim();
    setMeetingNote("");
    setFollowUpAttendance(null);
    resolveNow(
      () => adapter.resolveFollowUpContact(item, { ...decision, note: observation }),
      "Não foi possível registrar o desfecho.",
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
  async function handleOpenMessage(context?: "CONTATO_REALIZADO") {
    setBusy(true);
    setMessage(null);
    setWhatsappFeedback(null);
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
        const baseKey = stepMessageKey(item.leadId, item.messageRef?.step ?? item.stepLabel);
        const prepared = takeStepMessage(
          context && baseKey ? `${baseKey}::${context}` : baseKey,
        );
        const state = await loadMessageForModal(
          async () => (await (prepared ?? adapter.loadMessage(item, context))) ?? null,
          (loadedMessage) => {
            flushSync(() => {
              setMessage(loadedMessage);
              setCopyStatus("copying");
              setMessageOpen(true);
            });
          },
          copyMessageBody,
        );
        view = state.message;
        setCopyStatus(state.copied ? "copied" : "failed");
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Não foi possível ler a mensagem oficial. Tente novamente.",
        );
        return;
      }
      if (!view) {
        setFeedback("Esta ação não tem mensagem oficial vinculada.");
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyMessageBody(raw: string | null | undefined) {
    const body = (raw ?? "").trim();
    if (!body) {
      setCopyStatus("failed");
      return false;
    }
    const ok = await copyToClipboard(body);
    setCopyStatus(ok ? "copied" : "failed");
    return ok;
  }

  function handleOpenWhatsapp() {
    const opened = openDailyActionWhatsapp(item.phone);
    setWhatsappFeedback(
      opened ? null : "Telefone não disponível para abrir o WhatsApp.",
    );
  }

  function handleRegisterMessage() {
    if (locked) return;
    const observation = messageNote.trim();
    setMessageNote("");
    setCopyStatus("idle");
    setMessageOpen(false);
    resolveNow(
      () => adapter.registerMessage(item, observation),
      "Não foi possível registrar a mensagem.",
    );
  }

  function handleCompleteManual() {
    if (locked) return;
    const observation = manualNote.trim();
    setManualNote("");
    resolveNow(
      () => adapter.completeManual(item, observation),
      "Não foi possível concluir a ação manual.",
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
      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          {actionHeadline(item)}
          {item.startsAt ? ` · ${operationalTime(item.startsAt)}` : ""}
          {item.bucket === "atrasada" ? ` · atrasada desde ${formatDay(item.dueDate)}` : ""}
        </p>
        <h3 className="mt-2 font-display text-3xl leading-tight text-white">
          {item.name || "Sem nome"}
        </h3>
        {item.kind !== "compromisso" && (
          <div className="mt-2 flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleOpenWhatsapp}
              aria-label="Abrir WhatsApp deste contato"
              title="Abrir WhatsApp"
              className="h-7 w-7 shrink-0 text-[color:var(--gold)] hover:bg-white/10 hover:text-[color:var(--gold)]"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <a
              href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
              className="text-xl text-[color:var(--gold)]"
            >
              {item.phone ? formatDailyActionPhone(item.phone) : "Sem telefone"}
            </a>
          </div>
        )}
        {!messageOpen && whatsappFeedback && (
          <p role="status" className="mt-1 text-[11px] text-amber-200/80">
            {whatsappFeedback}
          </p>
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
        {item.kind === "reuniao" && item.followUp && followUpAttendance === null && !followUpPending && (
          <>
            <button
              type="button"
              onClick={() => setFollowUpAttendance(true)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Sim, compareceu
            </button>
            <button
              type="button"
              onClick={() => setFollowUpAttendance(false)}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              <X className="h-4 w-4" /> Não compareceu
            </button>
          </>
        )}
        {item.kind === "reuniao" && item.followUp && followUpAttendance !== null && !followUpPending && (
          <>
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/50">
              Deseja fazer um novo agendamento?
            </span>
            <button
              type="button"
              onClick={() => setFollowUpPending({ attended: followUpAttendance, willReschedule: true })}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-40"
            >
              Sim, vou reagendar no GreenSales
            </button>
            <button
              type="button"
              onClick={() => setFollowUpPending({ attended: followUpAttendance, willReschedule: false })}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => setFollowUpAttendance(null)}
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
        {item.kind === "manual" && (
          <button
            type="button"
            onClick={() => void handleCompleteManual()}
            disabled={busy || locked}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Concluído
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
              onClick={() => void handleOpenMessage(
                callPending.outcome === "SIM"
                  ? "CONTATO_REALIZADO"
                  : undefined,
              )}
              disabled={busy || locked}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-40"
            >
              <MessageSquare className="h-4 w-4" /> Copiar mensagem
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
            A pessoa compareceu no horário agendado?
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
            <span className="text-sm text-muted-foreground">{followUpPending.attended ? "Compareceu" : "Não compareceu"}</span>
            <Button disabled={busy || locked} onClick={() => handleFollowUpContact(followUpPending)}><Check className="h-4 w-4" /> Concluído</Button>
            <Button variant="ghost" onClick={() => { setFollowUpPending(null); setFollowUpAttendance(null); }}>Alterar resultado</Button>
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
          value={item.kind === "manual" ? manualNote : note}
          onChange={(e) => item.kind === "manual" ? setManualNote(e.target.value) : setNote(e.target.value)}
          placeholder="Observação operacional"
          className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
        />
        {item.kind !== "manual" && <button
          type="button"
          onClick={() => void handleNote()}
          disabled={busy}
          className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          <StickyNote className="mr-1 inline h-3.5 w-3.5" /> Salvar observação
        </button>}
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
          <div role="dialog" aria-modal="true" aria-label="Mensagem oficial" className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
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
              {copyStatus === "failed" && (
                <p role="status" className="text-[11px] text-amber-200/80">
                  Mensagem não foi copiada.
                </p>
              )}
              <input
                value={messageNote}
                onChange={(e) => setMessageNote(e.target.value)}
                placeholder="Observação operacional (opcional)"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
              />
              {whatsappFeedback && (
                <p role="status" className="text-[11px] text-amber-200/80">
                  {whatsappFeedback}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyMessageBody(message?.body)}
                  disabled={!message?.body}
                  className="flex-1 rounded-lg border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-3 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                >
                  Copiar mensagem
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsapp}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10"
                >
                  <MessageCircle className="mr-1 inline h-4 w-4" /> WhatsApp
                </button>
              </div>
              {/* Nada é enviado pelo sistema: somente Concluído encerra
                  a ação, grava histórico, snapshot e a observação. */}
              <button
                type="button"
                  onClick={() => void (callPending
                    ? completeCallAndMessage(callPending.outcome, callPending.rang)
                    : handleRegisterMessage())}
                disabled={busy || !message?.body}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  "border-emerald-400/50 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
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
