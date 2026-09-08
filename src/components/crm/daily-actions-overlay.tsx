/**
 * AÇÕES DO DIA — central de execução sobreposta ao Portal dos Leads.
 *
 * Uma lista única com tudo que precisa ser feito hoje: reuniões,
 * compromissos da Agenda, mensagens previstas e ligações. Nada é criado
 * aqui — o painel só apresenta as obrigações que já existem nas fontes
 * oficiais, sem repetir a mesma ação duas vezes e sem transformar
 * atraso em tarefa de hoje.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ExternalLink,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  SkipForward,
  StickyNote,
  X,
} from "lucide-react";
import type { DailyActionsAdapter, StepMessageView } from "@/lib/crm/daily-actions.adapter";
import { copyToClipboard } from "@/lib/clipboard";
import {
  resolveOperationalWindow,
  type OperationalWindow,
} from "@/lib/crm/daily-actions-window";
import {
  KIND_LABEL,
  operationalTime,
  type DailyAction,
  type DailyActionBucket,
  type DailyActionKind,
} from "@/lib/crm/daily-actions";



/**
 * LIGAÇÃO OFICIAL: item da fila legada (com `cadence`) OU ação interna
 * de ligação da régua V2 (fonte `queue`). As duas usam os mesmos botões
 * Atendeu / Não atendeu; a diferença fica no adaptador.
 */
function isCallAction(item: DailyAction | null | undefined): boolean {
  return Boolean(item) && item!.kind === "ligacao" && (Boolean(item!.cadence) || item!.source === "queue");
}

/** Cabeçalho oficial: "LIGAÇÃO — ETAPA E0", "MENSAGEM — ETAPA E0"… */
function actionHeadline(item: DailyAction): string {
  if (item.source === "queue" && item.stepLabel) {
    const base = item.kind === "ligacao" ? "Ligação" : "Mensagem";
    const second = (item.queueActionOrder ?? 1) > 1 && item.kind === "ligacao" ? "Segunda ligação" : base;
    return `${second} — Etapa ${item.stepLabel}`;
  }
  return `${KIND_LABEL[item.kind]}${item.stepLabel ? ` · ${item.stepLabel}` : ""}`;
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}` : iso;
}

const KIND_ICON: Record<DailyActionKind, typeof Phone> = {
  primeiro_contato: MessageCircle,
  reuniao: CalendarClock,
  compromisso: CalendarDays,
  mensagem: MessageSquare,
  ligacao: Phone,
};

const BLOCKS: { key: DailyActionBucket; label: string; tone: string }[] = [
  { key: "agora", label: "Agora", tone: "text-[color:var(--gold)]" },
  { key: "atrasada", label: "Atrasadas", tone: "text-red-300/80" },
  { key: "hoje", label: "Para hoje", tone: "text-white/40" },
];

export function DailyActionsOverlay({
  open,
  onClose,
  onOpenLead,
  adapter,
}: {
  open: boolean;
  onClose: () => void;
  /** Abre a ficha completa do investidor no Workspace operacional. */
  onOpenLead: (leadId: string, scope: string | null) => void;
  /**
   * FONTE DOS DADOS. O painel não conhece servidor nem banco: tudo o
   * que ele faz passa por este adaptador. O modo real o liga às funções
   * oficiais; o modo demonstração o liga a dados em memória.
   */
  adapter: DailyActionsAdapter;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const [actions, setActions] = useState<DailyAction[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Ligação sem atendimento aguardando a resposta "chamou?". */
  const [callAwaitingRing, setCallAwaitingRing] = useState<string | null>(null);
  /**
   * Resultado da ligação já escolhido, aguardando a confirmação final.
   * "Não atendeu" é resultado da tentativa; só "Concluído" encerra.
   */
  const [callPending, setCallPending] = useState<{
    key: string;
    outcome: "SIM" | "NAO";
    rang: boolean | null;
  } | null>(null);
  const [callNote, setCallNote] = useState("");
  /** Janela operacional de execução manual (06–22 seg–sex, 06–17 sáb). */
  const [operationalWindow, setOperationalWindow] = useState<OperationalWindow>(() =>
    resolveOperationalWindow(),
  );

  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [note, setNote] = useState("");
  const [meetingNote, setMeetingNote] = useState("");
  /** Agendamento GreenSales: "NÃO" houve contato → pergunta "Deseja reagendar?". */
  const [followUpNoContact, setFollowUpNoContact] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [message, setMessage] = useState<StepMessageView | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageNote, setMessageNote] = useState("");
  /** Confirmação explícita: copiou → enviou? Só SIM conclui o item. */
  const [copied, setCopied] = useState(false);
  /** Último resultado de ligação da régua V2 — reversível até a próxima ação irreversível. */
  const [undoable, setUndoable] = useState<DailyAction | null>(null);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await adapter.load();
      setActions(rows);
      setSelectedKey((current) =>
        current && rows.some((r) => r.actionKey === current)
          ? current
          : (rows[0]?.actionKey ?? null),
      );
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /** Relógio da janela operacional — reavaliado enquanto o painel está aberto. */
  useEffect(() => {
    if (!open) return;
    setOperationalWindow(resolveOperationalWindow());
    const timer = window.setInterval(() => setOperationalWindow(resolveOperationalWindow()), 30000);
    return () => window.clearInterval(timer);
  }, [open]);

  /** Trocar de ação limpa os rascunhos da ação anterior. */
  useEffect(() => {
    setCallAwaitingRing(null);
    setCallPending(null);
    setCallNote("");
    setSkipOpen(false);
    setSkipReason("");
    setNote("");
    setMeetingNote("");
    setRescheduleAt("");
    setMessage(null);
    setMessageOpen(false);
    setMessageNote("");
  }, [selectedKey]);



  const selected = useMemo(
    () => actions.find((item) => item.actionKey === selectedKey) ?? null,
    [actions, selectedKey],
  );

  const blocks = useMemo(
    () =>
      BLOCKS.map((block) => ({
        ...block,
        items: actions.filter((item) => item.bucket === block.key),
      })).filter((block) => block.items.length > 0),
    [actions],
  );

  const overdueCount = actions.filter((a) => a.bucket === "atrasada").length;
  const todayCount = actions.filter((a) => a.bucket === "hoje" || a.bucket === "agora").length;
  /**
   * Fora da janela operacional nada é executado — a pendência continua
   * na lista, apenas indisponível até a próxima abertura.
   */
  const locked = !operationalWindow.open;


  function dropAction(key: string) {
    setActions((prev) => {
      const index = prev.findIndex((r) => r.actionKey === key);
      const rest = prev.filter((r) => r.actionKey !== key);
      setSelectedKey(rest[Math.min(index, rest.length - 1)]?.actionKey ?? null);
      return rest;
    });
  }

  /**
   * Fila contínua (demonstração): a ação sai da posição atual e volta
   * para o FINAL, e a seleção avança para a próxima. Nenhum registro é
   * criado — a mesma lista circula indefinidamente.
   */
  function requeueAction(key: string) {
    setActions((prev) => {
      const index = prev.findIndex((r) => r.actionKey === key);
      if (index < 0) return prev;
      const item = prev[index];
      const rest = prev.filter((r) => r.actionKey !== key);
      setSelectedKey(rest[Math.min(index, rest.length - 1)]?.actionKey ?? item.actionKey);
      return [...rest, item];
    });
  }

  function applyResult(key: string, result: { requeue?: boolean; message?: string }) {
    if (result.requeue) requeueAction(key);
    else dropAction(key);
    if (result.message) setFeedback(result.message);
  }

  /**
   * LIGAÇÃO. "Atendeu?" é sempre a primeira pergunta e a resposta é
   * apenas o RESULTADO da tentativa — ela nunca encerra a ação sozinha.
   * O encerramento acontece só no botão "Concluído"; se houver
   * observação, ela é salva antes nas Notas do Executivo. Nenhuma
   * quantidade de tentativas é decidida aqui: quem define é a cadência.
   */
  async function completeCall(item: DailyAction, outcome: "SIM" | "NAO", rang?: boolean | null) {
    if (!isCallAction(item)) return;
    if (!operationalWindow.open) return;
    setBusy(true);
    try {
      const observation = callNote.trim();
      if (observation.length >= 3) await adapter.addNote(item, observation);
      const result = await adapter.completeCall(item, outcome, rang);
      if (result.ok) {
        setCallAwaitingRing(null);
        setCallPending(null);
        setCallNote("");
        setUndoable(item.source === "queue" && adapter.undoCallOutcome ? item : null);
        applyResult(item.actionKey, result);
        // A régua pode ter liberado a próxima ação (ex.: mensagem E0): relê a lista oficial.
        if (item.source === "queue") void load();
      } else {
        setFeedback(result.message ?? "Não foi possível registrar a ligação.");
        // Fora de ordem / já resolvida: a lista oficial é a verdade.
        void load();
      }
    } finally {
      setBusy(false);
    }
  }

  /** DESFAZER o resultado da ligação — o servidor decide se ainda é reversível. */
  async function handleUndoCall() {
    if (!undoable || !adapter.undoCallOutcome) return;
    setBusy(true);
    try {
      const result = await adapter.undoCallOutcome(undoable);
      setFeedback(result.message ?? null);
      if (result.ok) {
        setUndoable(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }


  /**
   * PRIMEIRO CONTATO (E0): não existe mais execução por esta tela. A E0
   * é etapa da régua V2 — ligação 1 → 10 min → ligação 2 → mensagem
   * apenas para COPIAR. Nenhum botão desta interface envia a mensagem.
   */


  /** PULAR — a justificativa é obrigatória e vira histórico oficial. */
  async function handleSkip(item: DailyAction) {
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
        applyResult(item.actionKey, result);
      } else setFeedback(result.message ?? "Não foi possível pular a ação.");
    } finally {
      setBusy(false);
    }
  }

  /** OBSERVAÇÃO — registro operacional; a ação continua pendente. */
  async function handleNote(item: DailyAction) {
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
  async function handleMeetingOutcome(item: DailyAction, attended: boolean) {
    if (!operationalWindow.open) return;
    setBusy(true);
    try {
      const result = await adapter.resolveMeeting(item, attended, meetingNote.trim());
      if (result.ok) {
        setMeetingNote("");
        applyResult(item.actionKey, result);
      } else setFeedback(result.message ?? "Não foi possível registrar o desfecho.");
    } finally {
      setBusy(false);
    }
  }

  /** AGENDAMENTO GREENSALES — "Houve contato de agendamento?" */
  async function handleFollowUpContact(
    item: DailyAction,
    decision: { contacted: boolean; willReschedule?: boolean },
  ) {
    if (!operationalWindow.open) return;
    setBusy(true);
    try {
      const result = await adapter.resolveFollowUpContact(item, { ...decision, note: meetingNote.trim() });
      if (result.ok) {
        setMeetingNote("");
        setFollowUpNoContact(null);
        applyResult(item.actionKey, result);
      } else setFeedback(result.message ?? "Não foi possível registrar o desfecho.");
    } finally {
      setBusy(false);
    }
  }

  /** OBRIGAÇÃO DE 24h — "Deseja encerrar esse fluxo?" */
  async function handleFollowUpReview(item: DailyAction, close: boolean) {
    if (!operationalWindow.open) return;
    setBusy(true);
    try {
      const result = await adapter.resolveFollowUpReview(item, { close, note: meetingNote.trim() });
      if (result.ok) {
        setMeetingNote("");
        applyResult(item.actionKey, result);
      } else setFeedback(result.message ?? "Não foi possível registrar a decisão.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReschedule(item: DailyAction) {
    if (!operationalWindow.open) return;
    if (!rescheduleAt) {
      setFeedback("Informe a nova data e hora da reunião.");
      return;
    }
    setBusy(true);
    try {
      const result = await adapter.rescheduleMeeting(
        item,
        new Date(rescheduleAt).toISOString(),
        meetingNote.trim(),
      );
      if (result.ok) {
        setRescheduleAt("");
        setMeetingNote("");
        applyResult(item.actionKey, result);
      } else setFeedback(result.message ?? "Não foi possível reagendar.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * MENSAGEM — leitura do texto oficial e cópia imediata. Esta tela
   * nunca envia nada e COPIAR NÃO CONCLUI a ação: só o botão Concluído
   * encerra o item da fila.
   */
  async function handleOpenMessage(item: DailyAction) {
    setBusy(true);
    setMessage(null);
    try {
      const view = await adapter.loadMessage(item);
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

  /**
   * CÓPIA REAL. O texto vem da Biblioteca oficial já resolvida pelo
   * servidor; só uma cópia CONFIRMADA marca a mensagem como copiada e
   * libera o botão Concluído.
   */
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

  async function copyMessage() {
    await copyMessageBody(message?.body);
  }

  async function handleRegisterMessage(item: DailyAction) {
    if (!operationalWindow.open) return;
    if (!copied) {
      setFeedback("Copie a mensagem oficial antes de concluir.");
      return;
    }
    setBusy(true);
    try {
      const result = await adapter.registerMessage(item, messageNote.trim());
      if (result.ok) {
        setMessageNote("");
        setCopied(false);
        setMessageOpen(false);
        applyResult(item.actionKey, result);
      } else setFeedback(result.message ?? "Não foi possível registrar a mensagem.");
    } finally {
      setBusy(false);
    }
  }




  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        aria-label="Fechar Ações do Dia"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ações do Dia"
        className="relative flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--navy-deep)] text-white/85 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <h2 className="flex items-center gap-2 font-display text-base leading-tight text-white">
                Ações do Dia
                {adapter.demoLabel && (
                  <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    {adapter.demoLabel}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-white/45">
                {overdueCount > 0
                  ? `${overdueCount} atrasada(s) · ${todayCount} para hoje`
                  : `${todayCount} para hoje`}
                {" · reuniões e compromissos têm prioridade"}
              </p>
            </div>

          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Atualizar ações"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_340px]">
          <section className="flex min-h-0 flex-col justify-center gap-5 overflow-y-auto border-b border-white/10 p-6 md:border-b-0 md:border-r">
            {locked && (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/90">
                  Fora da janela operacional
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {operationalWindow.label}. A execução está indisponível e as pendências
                  continuam registradas — retomam {operationalWindow.nextLabel}.
                </p>
              </div>
            )}

            {loading && actions.length === 0 ? (
              <p className="text-sm text-white/50">Reunindo as ações do dia…</p>
            ) : !selected ? (
              <div className="text-center">
                <p className="font-display text-lg text-white">Nada pendente</p>
                <p className="mt-1 text-sm text-white/50">
                  Nenhuma ação prevista para hoje. A lista é recalculada automaticamente.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    {actionHeadline(selected)}
                    {selected.startsAt ? ` · ${operationalTime(selected.startsAt)}` : ""}
                    {selected.bucket === "atrasada"
                      ? ` · atrasada desde ${formatDay(selected.dueDate)}`
                      : ""}
                  </p>
                  <h3 className="mt-2 font-display text-3xl leading-tight text-white">
                    {selected.name || "Sem nome"}
                  </h3>
                  {selected.kind !== "compromisso" && (
                    <a
                      href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}
                      className="mt-2 inline-block text-xl text-[color:var(--gold)]"
                    >
                      {selected.phone || "Sem telefone"}
                    </a>
                  )}
                  <p className="mt-2 text-sm text-white/55">{selected.title}</p>
                  {selected.attempts.length > 0 && (
                    <p className="mt-3 text-[11px] text-white/45">
                      Histórico:{" "}
                      {selected.attempts
                        .map(
                          (a) =>
                            `L${a.step} ${formatDay(a.date)} — ${
                              a.outcome === "SIM" ? "atendeu" : "não atendeu"
                            }`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                  {selected.secondary && selected.secondary.length > 0 && (
                    <p className="mt-3 text-[11px] text-white/45">
                      Também pendente para este investidor:{" "}
                      {selected.secondary
                        .map((s) => `${KIND_LABEL[s.kind]}${s.stepLabel ? ` ${s.stepLabel}` : ""}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">

                  {/* LIGAÇÃO — resultado da tentativa. Nenhuma resposta
                      encerra a ação: só o botão Concluído encerra. */}
                  {isCallAction(selected) &&
                    callAwaitingRing !== selected.actionKey &&
                    callPending?.key !== selected.actionKey && (
                      <>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                          O investidor atendeu?
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCallPending({ key: selected.actionKey, outcome: "SIM", rang: true })
                          }
                          disabled={busy || locked}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                        >
                          <Check className="h-4 w-4" /> Atendeu
                        </button>
                        <button
                          type="button"
                          onClick={() => setCallAwaitingRing(selected.actionKey)}
                          disabled={busy || locked}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                        >
                          <X className="h-4 w-4" /> Não atendeu
                        </button>
                      </>
                    )}
                  {isCallAction(selected) && callAwaitingRing === selected.actionKey && (
                    <>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        Chamou?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCallAwaitingRing(null);
                          setCallPending({
                            key: selected.actionKey,
                            outcome: "NAO",
                            rang: true,
                          });
                        }}
                        disabled={busy || locked}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
                      >
                        Sim, chamou
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCallAwaitingRing(null);
                          setCallPending({
                            key: selected.actionKey,
                            outcome: "NAO",
                            rang: false,
                          });
                        }}
                        disabled={busy || locked}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                      >
                        Não chamou
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallAwaitingRing(null)}
                        className="text-[11px] text-white/40 underline underline-offset-4"
                      >
                        voltar
                      </button>
                    </>
                  )}
                  {selected.kind === "reuniao" && selected.followUp?.mode === "revisao_24h" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleFollowUpReview(selected, true)}
                        disabled={busy || locked}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                      >
                        <X className="h-4 w-4" /> Sim, encerrar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleFollowUpReview(selected, false)}
                        disabled={busy || locked}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" /> Não, retomar
                      </button>
                    </>
                  )}
                  {selected.kind === "reuniao" &&
                    selected.followUp?.mode === "contato" &&
                    followUpNoContact !== selected.actionKey && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleFollowUpContact(selected, { contacted: true })}
                          disabled={busy || locked}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                        >
                          <Check className="h-4 w-4" /> Sim, houve contato
                        </button>
                        <button
                          type="button"
                          onClick={() => setFollowUpNoContact(selected.actionKey)}
                          disabled={busy || locked}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                        >
                          <X className="h-4 w-4" /> Não houve contato
                        </button>
                      </>
                    )}
                  {selected.kind === "reuniao" &&
                    selected.followUp?.mode === "contato" &&
                    followUpNoContact === selected.actionKey && (
                      <>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                          Deseja reagendar?
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleFollowUpContact(selected, { contacted: false, willReschedule: true })
                          }
                          disabled={busy || locked}
                          className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-40"
                        >
                          Sim, vou reagendar no GreenSales
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleFollowUpContact(selected, { contacted: false, willReschedule: false })
                          }
                          disabled={busy || locked}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                        >
                          Não
                        </button>
                        <button
                          type="button"
                          onClick={() => setFollowUpNoContact(null)}
                          className="text-[11px] text-white/40 underline underline-offset-4"
                        >
                          voltar
                        </button>
                      </>
                    )}
                  {selected.kind === "reuniao" && !selected.followUp && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleMeetingOutcome(selected, true)}
                        disabled={busy || locked}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" /> Compareceu
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMeetingOutcome(selected, false)}
                        disabled={busy || locked}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                      >
                        <X className="h-4 w-4" /> Não compareceu
                      </button>
                    </>
                  )}
                  {selected.kind === "mensagem" && (
                    <button
                      type="button"
                      onClick={() => void handleOpenMessage(selected)}
                      disabled={busy || locked}
                      className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-40"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {selected.stepLabel ? `Copiar mensagem — Etapa ${selected.stepLabel}` : "Copiar mensagem"}
                    </button>
                  )}

                  {/* Não existe "Abrir conversa" na Ação do Dia oficial: mensagem
                      é COPIAR o texto da Biblioteca; ligação é ligação. A ficha
                      completa continua disponível. */}

                  {selected.leadId && (
                    <button
                      type="button"
                      onClick={() => onOpenLead(selected.leadId as string, selected.scope ?? null)}
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

                {/*
                  LIGAÇÃO — confirmação final. O resultado já foi
                  escolhido; a observação é opcional e, quando existe,
                  vira Nota do Executivo antes de a ação ser concluída.
                */}
                {isCallAction(selected) && callPending?.key === selected.actionKey && (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                      Resultado: {callPending.outcome === "SIM" ? "Atendeu" : "Não atendeu"}
                      {callPending.outcome === "NAO"
                        ? callPending.rang
                          ? " · chamou"
                          : " · não chamou"
                        : ""}
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
                        onClick={() =>
                          void completeCall(selected, callPending.outcome, callPending.rang)
                        }
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
                {selected.kind === "reuniao" && selected.followUp && (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--gold)]/80">
                      {selected.followUp.mode === "revisao_24h"
                        ? "Ontem houve um agendamento em que não houve contato e você optou por não reagendar. Deseja encerrar esse fluxo?"
                        : "Houve contato de agendamento?"}
                    </span>
                    <span className="text-[11px] text-white/40">
                      Reagendamentos são feitos no GreenSales — o Portal atualiza automaticamente.
                    </span>
                    <input
                      value={meetingNote}
                      onChange={(e) => setMeetingNote(e.target.value)}
                      placeholder="Observação (opcional)"
                      className="min-w-[220px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
                    />
                  </div>
                )}

                {/* REUNIÃO — reagendamento na própria reunião oficial. */}
                {selected.kind === "reuniao" && !selected.followUp && (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                      Reagendar
                    </span>
                    <input
                      type="datetime-local"
                      value={rescheduleAt}
                      onChange={(e) => setRescheduleAt(e.target.value)}
                      className="rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80"
                    />
                    <button
                      type="button"
                      onClick={() => void handleReschedule(selected)}
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
                      onClick={() => void handleSkip(selected)}
                      disabled={busy}
                      className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                    >
                      Pular com justificativa
                    </button>
                  </div>
                )}

                {/* OBSERVAÇÃO — a ação continua pendente. */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Observação operacional"
                    className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => void handleNote(selected)}
                    disabled={busy}
                    className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-sm text-white/75 transition hover:bg-white/[0.1] disabled:opacity-50"
                  >
                    <StickyNote className="mr-1 inline h-3.5 w-3.5" /> Salvar observação
                  </button>
                </div>

                {feedback && <p className="text-[11px] text-[color:var(--gold)]">{feedback}</p>}
                {undoable && adapter.undoCallOutcome && (
                  <button
                    type="button"
                    onClick={() => void handleUndoCall()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/70 transition hover:bg-white/[0.08] disabled:opacity-40"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Desfazer resultado da ligação ({undoable.name})
                  </button>
                )}
                <p className="text-[11px] text-white/35">
                  {selected.kind === "primeiro_contato"
                    ? "O primeiro contato acontece pela régua: ligação 1, 10 minutos, ligação 2 e, só então, a mensagem para copiar. Esta tela nunca envia a mensagem."

                    : selected.source === "queue" && selected.kind === "ligacao"
                    ? "Atendeu: as ações restantes desta etapa são canceladas, nenhuma mensagem é enviada e o lead aguarda o seu encaminhamento. Não atendeu: a régua libera a próxima ação da etapa (2ª ligação em 10 minutos; depois a mensagem para copiar)."
                    : selected.source === "queue" && selected.kind === "mensagem"
                    ? "Copiar busca a versão ativa da Biblioteca, com o tratamento da Central dos Nomes. Nada é enviado pelo sistema: você cola a mensagem e só então marca Concluído, que grava o registro histórico."
                    : selected.cadence
                    ? "O desfecho registra apenas a tentativa de hoje. Atendeu encerra a sequência de ligações do ciclo; não atendeu mantém o lead na cadência para a próxima data prevista pela configuração."
                    : selected.kind === "reuniao"
                    ? "A reunião permanece nesta lista até ser resolvida: comparecimento, não comparecimento, reagendamento ou pulo com justificativa — sempre na reunião oficial."
                    : "Esta ação pertence à sua origem (Agenda, reunião ou fila de mensagens) e é encerrada por lá — aqui ela apenas aparece no lugar certo da sua ordem do dia."}
                </p>
                <p className="text-[11px] text-white/25">
                  Pular registra autor, horário, investidor, etapa e justificativa. A ação sai
                  apenas do dia de hoje e volta enquanto a origem continuar pendente.
                </p>

              </>
            )}
          </section>

          <aside className="flex min-h-0 flex-col">
            <p className="border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-white/40">
              Ordem do dia
            </p>
            <div className="flex-1 overflow-y-auto p-2">
              {blocks.length === 0 ? (
                <p className="px-2 py-4 text-[11px] text-white/35">Nenhuma ação pendente.</p>
              ) : (
                blocks.map((block) => (
                  <div key={block.key}>
                    <p
                      className={`px-2 pb-1 pt-3 text-[10px] uppercase tracking-[0.16em] ${block.tone}`}
                    >
                      {block.label} · {block.items.length}
                    </p>
                    <ul className="space-y-1">
                      {block.items.map((item) => (
                        <ActionRow
                          key={item.actionKey}
                          item={item}
                          selected={item.actionKey === selectedKey}
                          onSelect={() => setSelectedKey(item.actionKey)}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        {/*
          MENSAGEM OFICIAL DA ETAPA — leitura da Biblioteca ativa. Esta
          janela NUNCA envia: o Executivo copia o texto e conduz a
          conversa por fora. O botão apenas registra o histórico.
        */}
        {messageOpen && selected && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4">
            <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--navy-deep)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                    Mensagem oficial
                    {message?.step ? ` · ${message.step}` : ""}
                    {selected.messageRef?.flow ? ` · ${selected.messageRef.flow}` : ""}
                    {message?.libraryVersion ? ` · v${message.libraryVersion}` : ""}
                  </p>
                  <p className="font-display text-lg text-white">{selected.name}</p>
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
                <p
                  className={`text-[11px] ${copied ? "text-emerald-200/80" : "text-amber-200/80"}`}
                >
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
                    onClick={() => void copyMessage()}
                    disabled={!message?.body}
                    className="flex-1 rounded-lg border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-3 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                  >
                    {copied ? "Copiar novamente" : "Copiar mensagem"}
                  </button>
                  {selected.leadId && (
                    <button
                      type="button"
                      onClick={() => onOpenLead(selected.leadId as string, selected.scope ?? null)}
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
                  onClick={() => void handleRegisterMessage(selected)}
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
      </div>
    </div>

  );
}

/** Linha da lista lateral — mesma leitura em qualquer bloco. */
function ActionRow({
  item,
  selected,
  onSelect,
}: {
  item: DailyAction;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
          selected
            ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10"
            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
        }`}
      >
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
            item.priorityMax
              ? "border-[color:var(--gold)]/50 text-[color:var(--gold)]"
              : "border-white/15 text-white/55"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white/90">
            {item.name || "Sem nome"}
          </span>
          <span className="block truncate text-[11px] text-white/50">
            {KIND_LABEL[item.kind]}
            {item.stepLabel ? ` · ${item.stepLabel}` : ""}
            {item.startsAt ? ` · ${operationalTime(item.startsAt)}` : ""}
          </span>
        </span>
        {item.bucket === "atrasada" && (
          <span className="rounded-full bg-red-400/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-red-300">
            atrasada
          </span>
        )}
      </button>
    </li>
  );
}
