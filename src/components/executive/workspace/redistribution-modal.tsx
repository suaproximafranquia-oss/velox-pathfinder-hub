/**
 * COMANDO 4G §7/§8/§9 — confirmação MANUAL da redistribuição.
 *
 * A fila só é consultada depois do "Confirmar". Nenhum fluxo automático,
 * nenhuma cadência e nenhuma ligação são criados por esta ação.
 */
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import type { RedistributionPlan } from "@/lib/crm/redistribution";

export function RedistributionModal({
  plan,
  onCancel,
  onConfirm,
}: {
  plan: Extract<RedistributionPlan, { ok: true }>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar redistribuição"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] p-6 shadow-2xl">
        <header className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-[color:var(--gold)]" />
          <h2 className="font-display text-lg">Redistribuir lead</h2>
        </header>

        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          {plan.message}
        </p>

        {plan.exceptional ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Redistribuição excepcional: o proprietário original e todo o
            histórico são preservados. Apenas o responsável operacional muda.
          </p>
        ) : null}

        <p className="mt-3 text-[12px] leading-relaxed text-[color:var(--muted-foreground)]/80">
          O Executivo receptor assume o lead manualmente — nenhuma mensagem,
          cadência ou ligação é criada por esta ação.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)] hover:border-[color:var(--gold)] transition"
          >
            Redistribuir
          </button>
        </div>
      </div>
    </div>
  );
}