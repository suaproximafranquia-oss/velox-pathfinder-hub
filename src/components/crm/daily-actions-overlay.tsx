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
  X,
} from "lucide-react";
import type { DailyActionsAdapter } from "@/lib/crm/daily-actions.adapter";
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
}: {
  open: boolean;
  onClose: () => void;
  /** Abre a ficha completa do investidor em endereço próprio. */
  onOpenLead: (leadId: string) => void;
}) {
  const fetchActions = useServerFn(listDailyActions);
  const completeTask = useServerFn(completeCadenceTaskFn);
  const registerWhatsapp = useServerFn(registerWhatsappCallAttemptFn);
  const executeFirstContact = useServerFn(executeFirstContactAction);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [actions, setActions] = useState<DailyAction[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchActions();
      setActions(rows);
      setSelectedKey((current) =>
        current && rows.some((r) => r.actionKey === current)
          ? current
          : (rows[0]?.actionKey ?? null),
      );
    } finally {
      setLoading(false);
    }
  }, [fetchActions]);

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

  /** Ligação: registra o desfecho da tentativa; não encerra a cadência. */
  async function handleCallOutcome(item: DailyAction, outcome: "SIM" | "NAO") {
    if (!item.cadence) return;
    setBusy(true);
    try {
      await completeTask({
        data: {
          leadId: item.cadence.crmLeadId,
          step: item.cadence.step,
          dueDate: item.cadence.dueDate,
          cycleDate: item.cadence.cycleDate,
          channel: "call",
          outcome,
        },
      });
      dropAction(item.actionKey);
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
      const result = await executeFirstContact({
        data: { actionId: item.firstContactActionId },
      });
      if (result.ok) {
        dropAction(item.actionKey);
        setFeedback("Primeiro contato registrado.");
      } else {
        setFeedback(result.reason ?? "Não foi possível executar o primeiro contato.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleWhatsapp(item: DailyAction) {
    const digits = item.phone.replace(/\D/g, "");
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, "_blank", "noopener");
    if (!item.cadence) return;
    try {
      await registerWhatsapp({
        data: {
          leadId: item.cadence.crmLeadId,
          step: item.cadence.step,
          cycleDate: item.cadence.cycleDate,
        },
      });
    } catch {
      /* o registro de histórico nunca bloqueia a operação */
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
              <h2 className="font-display text-base leading-tight text-white">Ações do Dia</h2>
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
                  {selected.cadence && (
                    <>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        O investidor atendeu?
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCallOutcome(selected, "SIM")}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCallOutcome(selected, "NAO")}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Não
                      </button>
                    </>
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
                </div>
                {feedback && <p className="text-[11px] text-[color:var(--gold)]">{feedback}</p>}
                <p className="text-[11px] text-white/35">
                  {selected.kind === "primeiro_contato"
                    ? "O primeiro contato é executado pelo mesmo caminho oficial do modo automático, com registro de autor, horário e resultado. A trava global de envio real permanece ativa."
                    : selected.cadence
                    ? "O desfecho registra apenas a tentativa de hoje. Atendeu encerra a sequência de ligações do ciclo; não atendeu mantém o lead na cadência para a próxima data prevista."
                    : "Esta ação pertence à sua origem (Agenda, reunião ou fila de mensagens) e é encerrada por lá — aqui ela apenas aparece no lugar certo da sua ordem do dia."}
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
