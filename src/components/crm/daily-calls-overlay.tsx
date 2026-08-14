/**
 * Ligações do Dia — central de execução sobreposta ao Portal dos Leads.
 *
 * Lista simples (nome + telefone) à direita, lead selecionado à
 * esquerda. Concluir remove apenas a ocorrência de hoje e persiste no
 * banco; o lead continua na cadência.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Phone, RefreshCw, X } from "lucide-react";
import {
  completeCadenceTaskFn,
  listCadenceQueue,
  type CadenceQueueView,
} from "@/lib/crm/cadence.functions";

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}` : iso;
}

export function DailyCallsOverlay({
  open,
  onClose,
  onOpenLead,
}: {
  open: boolean;
  onClose: () => void;
  /** Abre a ficha completa no CRM para consulta detalhada. */
  onOpenLead: (leadId: string) => void;
}) {
  const fetchQueue = useServerFn(listCadenceQueue);
  const completeTask = useServerFn(completeCadenceTaskFn);

  const [queue, setQueue] = useState<CadenceQueueView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchQueue({ data: { channel: "call" } });
      setQueue(rows);
      setSelectedId((current) =>
        current && rows.some((r) => r.leadId === current) ? current : (rows[0]?.leadId ?? null),
      );
    } finally {
      setLoading(false);
    }
  }, [fetchQueue]);

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
    () => queue.find((item) => item.leadId === selectedId) ?? null,
    [queue, selectedId],
  );

  async function handleDone(item: CadenceQueueView) {
    setBusy(true);
    try {
      await completeTask({
        data: {
          leadId: item.leadId,
          step: item.step,
          dueDate: item.dueDate,
          channel: "call",
        },
      });
      setQueue((prev) => {
        const index = prev.findIndex((r) => r.leadId === item.leadId);
        const rest = prev.filter((r) => r.leadId !== item.leadId);
        setSelectedId(rest[Math.min(index, rest.length - 1)]?.leadId ?? null);
        return rest;
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        aria-label="Fechar Ligações do Dia"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ligações do Dia"
        className="relative flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--navy-deep)] text-white/85 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
              <Phone className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base leading-tight text-white">Ligações do Dia</h2>
              <p className="text-[11px] text-white/45">
                {queue.length} ligação(ões) pendente(s) · cadência D1 · D3 · D4 · D7
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Atualizar fila"
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

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_320px]">
          <section className="flex min-h-0 flex-col justify-center gap-5 border-b border-white/10 p-6 md:border-b-0 md:border-r">
            {loading && queue.length === 0 ? (
              <p className="text-sm text-white/50">Calculando a fila do dia…</p>
            ) : !selected ? (
              <div className="text-center">
                <p className="font-display text-lg text-white">Fila zerada</p>
                <p className="mt-1 text-sm text-white/50">
                  Nenhuma ligação prevista para hoje. O sistema recalcula automaticamente.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Tentativa D{selected.step} · entrada {formatDay(selected.entryDate)}
                    {selected.overdue ? ` · prevista ${formatDay(selected.dueDate)}` : ""}
                  </p>
                  <h3 className="mt-2 font-display text-3xl leading-tight text-white">
                    {selected.name || "Sem nome"}
                  </h3>
                  <a
                    href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}
                    className="mt-2 inline-block text-xl text-[color:var(--gold)]"
                  >
                    {selected.phone || "Sem telefone"}
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleDone(selected)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Ligação concluída
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenLead(selected.leadId)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                  >
                    <ExternalLink className="h-4 w-4" /> Ver ficha completa
                  </button>
                </div>
                <p className="text-[11px] text-white/35">
                  Concluir registra apenas a tentativa de hoje. O lead permanece na cadência e
                  volta na próxima data prevista.
                </p>
              </>
            )}
          </section>

          <aside className="flex min-h-0 flex-col">
            <p className="border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-white/40">
              Pendentes
            </p>
            <ul className="flex-1 space-y-1 overflow-y-auto p-2">
              {queue.length === 0 && (
                <li className="px-2 py-6 text-center text-[11px] text-white/30">
                  Nenhuma ligação pendente
                </li>
              )}
              {queue.map((item) => (
                <li key={item.leadId}>
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                      item.leadId === selectedId
                        ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.leadId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-[13px] font-medium text-white/90">
                        {item.name || "Sem nome"}
                      </p>
                      <p className="truncate text-[11px] text-white/50">
                        {item.phone || "Sem telefone"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDone(item)}
                      disabled={busy}
                      aria-label={`Concluir ligação de ${item.name}`}
                      title="Ligação realizada — remover da fila de hoje"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/60 transition hover:border-[color:var(--gold)]/50 hover:text-[color:var(--gold)] disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}