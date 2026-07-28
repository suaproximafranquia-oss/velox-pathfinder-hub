import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { derivePendings, PENDING_KIND_LABEL, type Pending } from "@/lib/pendings";
import { onEvent } from "@/lib/events/bus";

export function PendingsCard({ executiveId }: { executiveId?: string }) {
  const [items, setItems] = useState<Pending[]>([]);

  useEffect(() => {
    const refresh = () => setItems(derivePendings({ executiveId }));
    refresh();
    return onEvent(refresh);
  }, [executiveId]);

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[color:var(--gold)]" />
          <h3 className="font-display text-base">Pendências inteligentes</h3>
        </div>
        <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Nenhuma pendência no momento. Sua carteira está em dia.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 8).map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/30 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm text-[color:var(--foreground)]">{p.title}</p>
                <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed truncate">
                  {p.description}
                </p>
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
                {PENDING_KIND_LABEL[p.kind]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}