/**
 * Redistribuição — monitor automático.
 *
 * Não existe redistribuição manual: quando um número desconhecido entra
 * em contato pelo CRM, o próprio sistema verifica se o WhatsApp já tem
 * proprietário e, se não tiver, atribui o contato ao próximo Executivo
 * da fila oficial. Este painel apenas mostra o que o sistema decidiu.
 */
import { useMemo } from "react";
import { ArrowRightLeft, ShieldCheck } from "lucide-react";
import {
  peekNextExecutive,
  redistributionQueue,
  listRedistributedLeads,
} from "@/lib/crm/redistribution";

export function RedistributionPanel({ tick = 0 }: { tick?: number }) {
  const next = useMemo(() => {
    void tick;
    return peekNextExecutive();
  }, [tick]);
  const queue = useMemo(() => {
    void tick;
    return redistributionQueue();
  }, [tick]);
  const history = useMemo(() => {
    void tick;
    return listRedistributedLeads().slice(0, 6);
  }, [tick]);

  return (
    <section className="mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <header className="mb-3 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-[color:var(--gold)]" />
        <h2 className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          Redistribuição automática
        </h2>
      </header>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
        Todo contato que chega pelo WhatsApp é verificado automaticamente. Se o
        número já pertence a alguém, a conversa vai para o proprietário atual.
        Se for desconhecido, o sistema atribui ao próximo da fila oficial —
        sem escolha manual.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {queue.map((e) => (
          <span
            key={e.id}
            className={[
              "rounded-full border px-3 py-1 text-[11px]",
              e.id === next?.id
                ? "border-[color:var(--gold)]/60 bg-[color:var(--accent)] text-[color:var(--foreground)]"
                : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
            ].join(" ")}
          >
            {e.name}
            {e.id === next?.id ? " • próximo" : ""}
          </span>
        ))}
      </div>

      {history.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-[color:var(--border)] pt-3">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[color:var(--muted-foreground)]"
            >
              <span className="text-[color:var(--foreground)]">{h.name}</span>
              <span>
                {h.ownerName} • {new Date(h.at).toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}