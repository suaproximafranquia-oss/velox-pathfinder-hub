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
import {
  KIND_LABEL,
  operationalTime,
  type DailyAction,
  type DailyActionBucket,
  type DailyActionKind,
} from "@/lib/crm/daily-actions";


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
  /** Abre a ficha completa do investidor em endereço próprio. */
  onOpenLead: (leadId: string) => void;
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
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [note, setNote] = useState("");
  const [meetingNote, setMeetingNote] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [message, setMessage] = useState<StepMessageView | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageNote, setMessageNote] = useState("");
  /** Confirmação explícita: copiou → enviou? Só SIM conclui o item. */
  const [copied, setCopied] = useState(false);


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

  /** Trocar de ação limpa os rascunhos da ação anterior. */
  useEffect(() => {
    setCallAwaitingRing(null);
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
   * LIGAÇÃO. "Atendeu?" é sempre a primeira pergunta. Quando NÃO, a
   * tela pergunta se o telefone CHAMOU antes de registrar — as duas
   * respostas viram histórico na mesma tentativa. Nenhuma quantidade
   * de tentativas é decidida aqui: quem define é a cadência.
   */
  async function completeCall(item: DailyAction, outcome: "SIM" | "NAO", rang?: boolean | null) {
    if (!item.cadence) return;
    setBusy(true);
    try {
      const result = await adapter.completeCall(item, outcome, rang);
      if (result.ok) {
        setCallAwaitingRing(null);
        applyResult(item.actionKey, result);
      } else setFeedback(result.message ?? "Não foi possível registrar a ligação.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * PRIMEIRO CONTATO (E0) em modo manual: a execução usa o MESMO
   * caminho oficial do modo automático; aqui só registramos que o
   * executivo executou. Nenhum envio real é liberado por esta tela.
   */
  async function handleFirstContact(item: DailyAction) {
    if (!item.firstContactActionId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await adapter.executeFirstContact(item);
      if (result.ok) {
        applyResult(item.actionKey, {
          requeue: result.requeue,
          message: result.message ?? "Primeiro contato registrado.",
        });
      } else {
        setFeedback(result.message ?? "Não foi possível executar o primeiro contato.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleWhatsapp(item: DailyAction) {
    const result = await adapter.openWhatsapp(item);
    if (result.message) setFeedback(result.message);
  }

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

  async function handleReschedule(item: DailyAction) {
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

  /** MENSAGEM — leitura do texto oficial. Esta tela nunca envia nada. */
  async function handleOpenMessage(item: DailyAction) {
    setBusy(true);
    setMessage(null);
    try {
      const view = await adapter.loadMessage(item);
      setMessage(view);
      setMessageOpen(true);
      if (!view) setFeedback("Esta ação não tem mensagem oficial vinculada.");
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage() {
    const body = message?.body?.trim();
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
    } catch {
      setFeedback("Não foi possível copiar automaticamente — selecione o texto acima.");
    }
  }

  async function handleRegisterMessage(item: DailyAction) {
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
                    {KIND_LABEL[selected.kind]}
                    {selected.stepLabel ? ` · ${selected.stepLabel}` : ""}
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
                  {selected.kind === "primeiro_contato" && (
                    <button
                      type="button"
                      onClick={() => void handleFirstContact(selected)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Executar primeiro contato (E0)
                    </button>
                  )}
                  {selected.cadence && callAwaitingRing !== selected.actionKey && (
                    <>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        O investidor atendeu?
                      </span>
                      <button
                        type="button"
                        onClick={() => void completeCall(selected, "SIM")}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallAwaitingRing(selected.actionKey)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Não
                      </button>
                    </>
                  )}
                  {selected.cadence && callAwaitingRing === selected.actionKey && (
                    <>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        Chamou?
                      </span>
                      <button
                        type="button"
                        onClick={() => void completeCall(selected, "NAO", true)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
                      >
                        Sim, chamou
                      </button>
                      <button
                        type="button"
                        onClick={() => void completeCall(selected, "NAO", false)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
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
                  {selected.kind === "reuniao" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleMeetingOutcome(selected, true)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Compareceu
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMeetingOutcome(selected, false)}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Não compareceu
                      </button>
                    </>
                  )}
                  {selected.kind === "mensagem" && (
                    <button
                      type="button"
                      onClick={() => void handleOpenMessage(selected)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                    >
                      <MessageSquare className="h-4 w-4" /> Ver mensagem completa
                    </button>
                  )}
                  {selected.phone && (
                    <button
                      type="button"
                      onClick={() => void handleWhatsapp(selected)}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {selected.cadence ? "Tentar ligação pelo WhatsApp" : "Abrir conversa"}
                    </button>
                  )}
                  {selected.leadId && (
                    <button
                      type="button"
                      onClick={() => onOpenLead(selected.leadId as string)}
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

                {/* REUNIÃO — reagendamento na própria reunião oficial. */}
                {selected.kind === "reuniao" && (
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
                <p className="text-[11px] text-white/35">
                  {selected.kind === "primeiro_contato"
                    ? "O primeiro contato é executado pelo mesmo caminho oficial do modo automático, com registro de autor, horário e resultado. A trava global de envio real permanece ativa."
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
                <input
                  value={messageNote}
                  onChange={(e) => setMessageNote(e.target.value)}
                  placeholder="Observação (opcional)"
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30"
                />
                {!copied ? (
                  <button
                    type="button"
                    onClick={() => void copyMessage()}
                    disabled={!message?.body}
                    className="w-full rounded-lg border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-3 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                  >
                    Copiar mensagem
                  </button>
                ) : (
                  <div className="space-y-2">
                    {/* Nada é enviado pelo sistema: o Executivo cola no
                        WhatsApp e confirma aqui o que realmente fez. */}
                    <p className="text-sm text-white/70">
                      Mensagem copiada. Você enviou esta mensagem ao investidor?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRegisterMessage(selected)}
                        disabled={busy || !message?.body}
                        className="flex-1 rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        SIM — enviei
                      </button>
                      <button
                        type="button"
                        onClick={() => setCopied(false)}
                        disabled={busy}
                        className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        NÃO — ainda não
                      </button>
                    </div>
                  </div>
                )}
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
