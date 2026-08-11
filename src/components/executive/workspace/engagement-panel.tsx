/**
 * ENGAJAMENTO — investidores mais engajados do Portal.
 *
 * Ranking construído exclusivamente com dados REAIS persistidos pelo
 * Portal (sessões, retornos, tempo ativo, módulos e recência). Nenhum
 * dado é gerado, estimado por IA ou preenchido artificialmente.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowUpRight } from "lucide-react";
import {
  listPortalEngagement,
  type PortalEngagementRow,
} from "@/lib/portal-engagement.functions";
import {
  ENGAGEMENT_LEVEL_LABEL,
  MODULE_LABEL,
  RANKED_MODULES,
  engagementLevel,
  engagementScore,
  formatActiveTime,
  moduleCount,
  relativeTime,
} from "@/lib/engagement/score";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<string, string> = {
  alto: "border-emerald-400/40 text-emerald-300",
  moderado: "border-[color:var(--gold)]/40 text-[color:var(--gold)]",
  baixo: "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
};

export function EngagementPanel({ onOpen }: { onOpen: (investorId: string) => void }) {
  const [rows, setRows] = useState<PortalEngagementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    listPortalEngagement()
      .then((data) => {
        if (active) setRows(data);
      })
      .catch(() => {
        if (active) setError("Não foi possível consultar o engajamento agora.");
      });
    return () => {
      active = false;
    };
  }, []);

  const ranked = useMemo(
    () => (rows ?? []).slice().sort((a, b) => engagementScore(b) - engagementScore(a)),
    [rows],
  );
  const visible = showAll ? ranked : ranked.slice(0, 5);

  return (
    <section className="mb-6">
      <h2 className="font-display text-xl">Investidores mais engajados</h2>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
        Ranking calculado com o comportamento real registrado no Portal.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">{error}</p>
      ) : rows === null ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Consultando o engajamento…
        </p>
      ) : ranked.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/30 p-10 text-center text-sm text-[color:var(--muted-foreground)]">
          Ainda não há atividade registrada no Portal para os seus investidores.
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {visible.map((row, index) => {
              const level = engagementLevel(row);
              return (
                <li key={row.investorId}>
                  <button
                    type="button"
                    onClick={() => onOpen(row.investorId)}
                    className="group flex w-full items-start gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-4 text-left transition hover:border-[color:var(--gold)]/40"
                  >
                    <span className="mt-0.5 font-display text-lg text-[color:var(--muted-foreground)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-display text-base">{row.name}</span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                            LEVEL_STYLE[level],
                          )}
                        >
                          {ENGAGEMENT_LEVEL_LABEL[level]}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-[color:var(--muted-foreground)]">
                        {row.sessions} {row.sessions === 1 ? "sessão" : "sessões"} ·{" "}
                        {formatActiveTime(row)} · {moduleCount(row)}{" "}
                        {moduleCount(row) === 1 ? "módulo" : "módulos"} · {row.returns}{" "}
                        {row.returns === 1 ? "retorno" : "retornos"}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {RANKED_MODULES.map((m) => (
                          <span
                            key={m}
                            className={
                              row.modules[m]
                                ? "text-[color:var(--foreground)]"
                                : "text-[color:var(--muted-foreground)]/50"
                            }
                          >
                            {MODULE_LABEL[m]} {row.modules[m] ? "✓" : "—"}
                          </span>
                        ))}
                      </span>
                      <span className="mt-1 block text-xs text-[color:var(--muted-foreground)]">
                        Último acesso: {relativeTime(row.lastAccessAt)}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)] transition group-hover:text-[color:var(--gold)]" />
                  </button>
                </li>
              );
            })}
          </ul>
          {ranked.length > 5 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-4 text-xs uppercase tracking-[0.16em] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
            >
              {showAll ? "Ver apenas os 5 primeiros" : `Ver todos (${ranked.length})`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
