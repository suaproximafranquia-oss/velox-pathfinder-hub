/**
 * RESOLVER PENDÊNCIA — SOBRE A PRÓPRIA CENTRAL DE OPERAÇÕES.
 *
 * Abre o MESMO card operacional da Ação do Dia para uma pendência já
 * pulada pelo próprio Executivo. Não existe segunda fila, segundo motor
 * nem nova obrigação: o servidor devolve a mesma ação (mesma
 * `actionKey`, mesma etapa, mesmo tipo) e a execução usa exatamente as
 * mesmas funções oficiais.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";
import { DailyActionCard } from "@/components/crm/daily-action-card";
import { useRealDailyActionsAdapter } from "@/components/crm/daily-actions-real-adapter";
import { resolvePendingActionFn } from "@/lib/crm/daily-actions.functions";
import type { DailyAction } from "@/lib/crm/daily-actions";

export function PendingResolverModal({
  actionKey,
  onClose,
  onResolved,
}: {
  actionKey: string;
  onClose: () => void;
  /** A pendência foi executada — a Central relê os indicadores. */
  onResolved: () => void;
}) {
  /** Adaptador em modo recuperação: a ação autorizada é a pendência. */
  const adapter = useRealDailyActionsAdapter({ pendingRecovery: true });
  const openPending = useServerFn(resolvePendingActionFn);
  const [action, setAction] = useState<DailyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = (await openPending({ data: { actionKey } })) as DailyAction | null;
        if (!alive) return;
        if (!result) {
          setError("Esta pendência não está mais disponível para execução.");
        } else setAction(result);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Não foi possível abrir a pendência.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [actionKey, openPending]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Resolver pendência"
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--navy-deep)] text-white/85 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Pendência pulada
            </p>
            <h2 className="font-display text-base text-white">Resolver pendência</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a ação original…
            </p>
          ) : error ? (
            <p className="text-sm text-rose-200">{error}</p>
          ) : action ? (
            <DailyActionCard
              item={action}
              adapter={adapter}
              locked={false}
              onResolved={() => {
                onResolved();
                onClose();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
