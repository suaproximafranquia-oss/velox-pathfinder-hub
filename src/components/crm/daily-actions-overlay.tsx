/**
 * AÇÕES DO DIA — central de execução sobreposta ao Portal dos Leads.
 *
 * Uma lista única com tudo que precisa ser feito hoje: reuniões,
 * compromissos da Agenda, mensagens previstas e ligações. Nada é criado
 * aqui — o painel só apresenta as obrigações que já existem nas fontes
 * oficiais, sem repetir a mesma ação duas vezes e sem transformar
 * atraso em tarefa de hoje. A execução em si acontece no card
 * operacional (`DailyActionCard`), a mesma peça reaproveitada pela
 * Central de Operações.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Lock,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";
import type { DailyActionsAdapter, SkippedPendingView } from "@/lib/crm/daily-actions.adapter";
import { DailyActionCard } from "@/components/crm/daily-action-card";
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
  /**
   * COMPROMISSO DE OUTRO DIA: fica visível para o Executivo se preparar,
   * mas não é trabalho de hoje — nunca ocupa a posição 1 nem abre como
   * card principal.
   */
  { key: "futura", label: "Próximos compromissos", tone: "text-sky-300/70" },
];

/**
 * A ação ativa é sempre a PRIMEIRA da fila oficial que pode ser
 * executada hoje. Compromissos futuros são pulados nesta escolha.
 */
function firstExecutableKey(rows: DailyAction[]): string | null {
  return rows.find((row) => row.bucket !== "futura")?.actionKey ?? null;
}


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
  /** Janela operacional de execução manual (06–22 seg–sex, 06–17 sáb). */
  const [operationalWindow, setOperationalWindow] = useState<OperationalWindow>(() =>
    resolveOperationalWindow(),
  );
  /** Último resultado de ligação da régua V2 — reversível até a próxima ação irreversível. */
  const [undoable, setUndoable] = useState<DailyAction | null>(null);

  /**
   * JANELA DE ACOMODAÇÃO (~4s).
   *
   * Concluir uma ação pode fazer o servidor criar, poucos instantes
   * depois, a PRÓXIMA ação do MESMO investidor (por exemplo a mensagem
   * E0 logo após a 2ª ligação). Sem cuidado, essa ação nasce durante a
   * troca de card e o investidor "volta" na tela sem aviso.
   *
   * A janela não atrasa nada: o card sai no clique e o próximo assume na
   * hora. Ela apenas segura, por alguns segundos, a ENTRADA VISUAL das
   * ações recém-nascidas do investidor que acabou de ser concluído — e
   * então as acomoda na fila oficial, na posição que o servidor mandar.
   */
  const SETTLE_MS = 4000;
  /** Ações já resolvidas nesta tela — respostas atrasadas não as ressuscitam. */
  const resolvedKeysRef = useRef<Map<string, number>>(new Map());
  /** Investidores concluídos há pouco: novas ações deles ficam em acomodação. */
  const settlingLeadsRef = useRef<Map<string, number>>(new Map());
  /** Última fila oficial recebida — reaplicada quando a janela fecha. */
  const pendingQueueRef = useRef<DailyAction[] | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    },
    [],
  );

  /**
   * A FILA OFICIAL DO SERVIDOR CONTINUA SENDO A AUTORIDADE. Aqui só se
   * remove o que já foi resolvido nesta tela e se adia a entrada visual
   * das ações nascidas dentro da janela de acomodação.
   */
  const commitQueue = useCallback((rows: DailyAction[]) => {
    const now = Date.now();
    for (const [key, expires] of resolvedKeysRef.current)
      if (expires <= now) resolvedKeysRef.current.delete(key);
    for (const [lead, expires] of settlingLeadsRef.current)
      if (expires <= now) settlingLeadsRef.current.delete(lead);

    const official = rows.filter((row) => !resolvedKeysRef.current.has(row.actionKey));
    pendingQueueRef.current = official;

    setActions((prev) => {
      const known = new Set(prev.map((row) => row.actionKey));
      let nextFlush = 0;
      const visible = official.filter((row) => {
        if (known.has(row.actionKey) || !row.leadId) return true;
        const until = settlingLeadsRef.current.get(row.leadId);
        if (!until || until <= now) return true;
        nextFlush = Math.max(nextFlush, until);
        return false;
      });
      if (nextFlush > 0) {
        if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = window.setTimeout(
          () => {
            flushTimerRef.current = null;
            const queued = pendingQueueRef.current;
            if (queued) commitQueue(queued);
          },
          Math.max(200, nextFlush - now + 50),
        );
      }
      setSelectedKey(firstExecutableKey(visible));
      return visible;
    });
  }, []);

  /**
   * ORDEM DO DIA — a lista oficial vem sempre do servidor e a ação
   * ativa é SEMPRE a primeira. `silent` recarrega em segundo plano,
   * sem cortina de carregamento: o próximo card já assumiu a posição 1
   * na tela e a releitura apenas confirma com o servidor.
   */
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        commitQueue(await adapter.load());
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [adapter, commitQueue],
  );

  /** Pendências puladas do próprio Executivo (histórico, não fila). */
  const [pendings, setPendings] = useState<SkippedPendingView[]>([]);
  const [pendingsOpen, setPendingsOpen] = useState(false);
  const loadPendings = useCallback(async () => {
    if (!adapter.listPendings) return;
    try {
      setPendings(await adapter.listPendings());
    } catch {
      /* a área de pendências nunca bloqueia a Ação do Dia */
    }
  }, [adapter]);

  useEffect(() => {
    if (!open) return;
    void load();
    void loadPendings();
  }, [open, load, loadPendings]);

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
      const rest = prev.filter((r) => r.actionKey !== key);
      setSelectedKey(firstExecutableKey(rest));
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
      setSelectedKey(rest[0]?.actionKey ?? item.actionKey);
      return [...rest, item];
    });
  }

  /** Abre a janela de acomodação do investidor cuja ação acabou de sair. */
  function openSettleWindow(key: string, requeue: boolean) {
    const now = Date.now();
    const action = actions.find((row) => row.actionKey === key);
    if (!requeue) resolvedKeysRef.current.set(key, now + 60000);
    if (action?.leadId) settlingLeadsRef.current.set(action.leadId, now + SETTLE_MS);
  }

  function applyResult(
    key: string,
    result: {
      requeue?: boolean;
      message?: string;
      queue?: DailyAction[];
      reload?: boolean;
    },
  ) {
    openSettleWindow(key, result.requeue === true);
    /**
     * FILA OFICIAL DO SERVIDOR — quando ela vem junto com a conclusão,
     * é ela que define a próxima ação. Se o MESMO investidor tiver outra
     * ação liberada (por exemplo a mensagem E0 após a 2ª ligação), ela já
     * assume a posição 1, sem passar por outro lead nem esperar recarga.
     */
    if (result.queue) {
      commitQueue(result.queue);
      if (result.message) setFeedback(result.message);
      return;
    }
    if (result.requeue) requeueAction(key);
    else dropAction(key);
    if (result.message) setFeedback(result.message);
    /**
     * CONFIRMAÇÃO EM SEGUNDO PLANO: o servidor não devolveu a fila (ou
     * recusou a execução). A releitura silenciosa devolve a lista
     * oficial sem cortina de carregamento.
     */
    if (result.reload) void load(true);
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


  /**
   * RESOLVER PENDÊNCIA — a MESMA ação pulada volta para a fila de hoje.
   * A trava do servidor continua valendo: ela só fica executável quando
   * chegar à posição 1.
   */
  async function handleResumePending(actionKey: string) {
    if (!adapter.resumePending) return;
    setBusy(true);
    try {
      const result = await adapter.resumePending(actionKey);
      setFeedback(result.message ?? null);
      if (result.ok) {
        await load(true);
        await loadPendings();
      }
    } finally {
      setBusy(false);
    }
  }

  /*
   * Ligação, mensagem, reunião, agendamento, pulo e observação são
   * executados pelo card operacional (`DailyActionCard`) — a mesma peça
   * usada pela Central de Operações. Aqui fica apenas a fila do dia.
   */




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
                {/*
                  CARD OPERACIONAL — peça única, a mesma usada pela
                  Central de Operações na resolução de uma pendência.
                */}
                <DailyActionCard
                  key={selected.actionKey}
                  item={selected}
                  adapter={adapter}
                  locked={locked}
                  onOpenLead={onOpenLead}
                  onResolved={(key, result) => {
                    applyResult(key, result);
                    void loadPendings();
                  }}
                  onReload={(silent) => void load(silent)}
                  onUndoableChange={setUndoable}
                />
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
                          locked={item.actionKey !== selectedKey}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {/*
              PENDÊNCIAS PULADAS — histórico das ações que você pulou e
              que ainda não foram concluídas. "Resolver pendência"
              devolve a MESMA ação para a fila de hoje: nada novo é
              criado e o motivo original continua registrado.
            */}
            {adapter.listPendings && (
              <div className="border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setPendingsOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70"
                >
                  <span>Pendências puladas</span>
                  <span className="text-white/60">{pendings.length}</span>
                </button>
                {pendingsOpen && (
                  <div className="max-h-56 overflow-y-auto px-2 pb-3">
                    {pendings.length === 0 ? (
                      <p className="px-2 py-2 text-[11px] text-white/35">
                        Nenhuma pendência pulada em aberto.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {pendings.map((pending) => (
                          <li
                            key={pending.actionKey}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                          >
                            <p className="truncate text-[13px] text-white/85">
                              {pending.title ?? "Ação pulada"}
                            </p>
                            <p className="truncate text-[11px] text-white/45">
                              {pending.step ? `${pending.step} · ` : ""}
                              {pending.skippedDate}
                              {pending.motivo ? ` · ${pending.motivo}` : ""}
                            </p>
                            <button
                              type="button"
                              disabled={busy || pending.retomadaHoje}
                              onClick={() => void handleResumePending(pending.actionKey)}
                              className="mt-2 w-full rounded-lg border border-white/20 px-2 py-1 text-[11px] text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                            >
                              {pending.retomadaHoje
                                ? "Já retomada — está na fila de hoje"
                                : "Resolver pendência"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>

        </div>

        {/* A janela da mensagem oficial vive dentro do próprio card. */}
      </div>
    </div>

  );
}

/** Linha da lista lateral — mesma leitura em qualquer bloco. */
function ActionRow({
  item,
  selected,
  locked,
}: {
  item: DailyAction;
  selected: boolean;
  /** Visível, porém bloqueado: só a posição 1 é executável. */
  locked: boolean;
}) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li>
      <div
        aria-disabled={locked}
        title={locked ? "Disponível quando chegar à posição 1 da fila." : undefined}
        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
          selected
            ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10"
            : "border-white/10 bg-white/[0.03] opacity-60"
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
        {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-white/30" />}
      </div>
    </li>
  );
}
