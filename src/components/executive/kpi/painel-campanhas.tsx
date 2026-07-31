/**
 * Painel de Campanhas — ranking oficial da Campanha Velox.
 *
 * Consome exclusivamente o KPI Manager (loadDataset) — sem inventar
 * dados. Exibe posição, unidades vendidas, valor entregue e faltas
 * para cada nível (Mestre, Doutor, PhD, Supreme Closer). Todos os
 * usuários podem visualizar; a ordenação é apenas a posição ATUAL
 * na campanha ativa — não há comparação histórica entre pessoas.
 */
import { Trophy } from "lucide-react";
import type { ExecutiveUser } from "@/lib/executive-auth";
import {
  CAMPAIGN_LEVELS,
  campaignStatus,
  formatCurrency,
  loadDataset,
  sumRow,
} from "@/lib/kpi-manager";
import { cn } from "@/lib/utils";

const LEVEL_ORDER = ["mestre", "doutor", "phd", "supreme"] as const;
const LEVEL_LABEL: Record<(typeof LEVEL_ORDER)[number], string> = {
  mestre: "Mestre",
  doutor: "Doutor",
  phd: "PhD",
  supreme: "Supreme",
};
const LEVEL_MIN: Record<(typeof LEVEL_ORDER)[number], number> = Object.fromEntries(
  CAMPAIGN_LEVELS.map((l) => [l.key, l.min]),
) as Record<(typeof LEVEL_ORDER)[number], number>;

function tierClass(value: number): string {
  if (value >= LEVEL_MIN.supreme) return "pnl-tier-supreme";
  if (value >= LEVEL_MIN.phd) return "pnl-tier-phd";
  if (value >= LEVEL_MIN.doutor) return "pnl-tier-doutor";
  if (value >= LEVEL_MIN.mestre) return "pnl-tier-mestre";
  return "pnl-tier-none";
}

function tierLabel(value: number): string {
  if (value >= LEVEL_MIN.supreme) return "Supreme Closer";
  if (value >= LEVEL_MIN.phd) return "PhD";
  if (value >= LEVEL_MIN.doutor) return "Doutor";
  if (value >= LEVEL_MIN.mestre) return "Mestre";
  return "Entregue";
}

function medal(pos: number): string {
  return pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : "";
}

export type CampaignRow = {
  user: ExecutiveUser;
  units: number;
  value: number;
};

export function buildCampaignRows(
  users: ExecutiveUser[],
  monthKey: string,
): CampaignRow[] {
  const rows = users.map((user) => {
    const ds = loadDataset(user.id, monthKey);
    const units = sumRow(ds.matrix, "contractsSigned");
    const value = sumRow(ds.matrix, "salesValue");
    return { user, units, value };
  });
  rows.sort((a, b) => b.value - a.value || b.units - a.units);
  return rows;
}

export function PainelCampanhas({
  users,
  monthKey,
  onDownload,
}: {
  users: ExecutiveUser[];
  monthKey: string;
  onDownload?: (userId: string) => void;
}) {
  const rows = buildCampaignRows(users, monthKey);
  return (
    <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)]/55 p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
            <Trophy className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div>
            <h2 className="font-display text-lg leading-none">Painel de Campanhas</h2>
            <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
              Posição atual na Campanha Velox — alimentada pelo KPI Manager.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          {LEVEL_ORDER.map((k) => (
            <span
              key={k}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2 py-0.5",
                `pnl-tier-${k}`,
              )}
            >
              {LEVEL_LABEL[k]} · {formatCurrency(LEVEL_MIN[k])}
            </span>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto kpi-scroll">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              <th className="text-left font-normal px-3 py-2 w-14">#</th>
              <th className="text-left font-normal px-3 py-2">Executivo</th>
              <th className="text-right font-normal px-2 py-2 w-[68px]" title="Unidades">Unid.</th>
              <th className="text-right font-normal px-3 py-2">Valor entregue</th>
              <th className="text-right font-normal px-3 py-2">Falta p/ Mestre</th>
              <th className="text-right font-normal px-3 py-2">Falta p/ Doutor</th>
              <th className="text-right font-normal px-3 py-2">Falta p/ PhD</th>
              <th className="text-right font-normal px-3 py-2">Falta p/ Supreme</th>
              <th className="text-center font-normal px-4 py-2 w-[140px]">Nível</th>
              {onDownload && (
                <th className="text-center font-normal px-3 py-2 w-14"> </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pos = i + 1;
              const st = campaignStatus(r.value);
              const tCls = tierClass(r.value);
              const tLbl = tierLabel(r.value);
              return (
                <tr
                  key={r.user.id}
                  className="border-t border-[color:var(--border)]/60 hover:bg-[color:var(--accent)]/25 transition-colors"
                >
                  <td className="px-3 py-2 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="text-base leading-none">{medal(pos)}</span>
                      <span className={cn(pos <= 3 ? "text-[color:var(--foreground)] font-medium" : "text-[color:var(--muted-foreground)]")}>{pos}º</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium text-[color:var(--foreground)]">{r.user.name}</span>
                      <span className="text-[11px] text-[color:var(--muted-foreground)]">
                        {st.percent.toFixed(1).replace(".", ",")}% da meta máxima
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums w-[68px]">
                    {r.units.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[color:var(--foreground)] font-medium">
                    {formatCurrency(r.value)}
                  </td>
                  {LEVEL_ORDER.map((k) => {
                    const remaining = Math.max(0, LEVEL_MIN[k] - r.value);
                    const achieved = remaining === 0;
                    return (
                      <td
                        key={k}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          achieved
                            ? "text-emerald-400"
                            : "text-rose-400 font-medium",
                        )}
                        title={achieved ? "Meta atingida" : `Faltam ${formatCurrency(remaining)}`}
                      >
                        {achieved ? "Meta atingida" : formatCurrency(remaining)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium min-w-[116px] whitespace-nowrap",
                        tCls,
                      )}
                    >
                      {tLbl}
                    </span>
                  </td>
                  {onDownload && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onDownload(r.user.id)}
                        className="text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--gold)] underline underline-offset-2"
                        title="Gerar relatório individual (PDF)"
                      >
                        PDF
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={onDownload ? 10 : 9} className="px-3 py-6 text-center text-[color:var(--muted-foreground)] text-sm">
                  Nenhum executivo visível no escopo atual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}