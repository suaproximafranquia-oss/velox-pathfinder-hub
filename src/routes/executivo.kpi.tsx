import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Gauge,
  HandCoins,
  RotateCcw,
  Users,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { CampanhaVeloxCard } from "@/components/executive/kpi/campanha-velox";
import {
  getSession,
  loadUsers,
  type ExecutiveSession,
  type ExecutiveUser,
} from "@/lib/executive-auth";
import {
  AVAILABLE_MONTHS,
  DEFAULT_MONTH_KEY,
  INDICATORS,
  averageRow,
  daysInMonth,
  findMonth,
  formatCurrency,
  formatValue,
  isWeekend,
  loadDataset,
  resetDataset,
  saveDataset,
  summarize,
  sumRow,
  useKpiContext,
  type KpiDataset,
  type KpiIndicator,
} from "@/lib/kpi-manager";
import { visibleCollaborators } from "@/lib/teams";
import { cn } from "@/lib/utils";

const CONSOLIDATED_VIEW_ID = "__atlas_consolidated__";

/**
 * Faixa da campanha por valor vendido acumulado. Retorna a classe utilitária
 * aplicada à célula "Total" do indicador principal (Valor Vendido) — mantém
 * a UX imediata e sem estado extra: a classe deriva do valor a cada render.
 */
function campaignTierClass(value: number): string {
  if (value >= 100000) return "kpi-tier-supreme";
  if (value >= 90000) return "kpi-tier-phd";
  if (value >= 70000) return "kpi-tier-doutor";
  if (value >= 55000) return "kpi-tier-mestre";
  return "";
}

/** Identificador do indicador oficial "Valor Vendido" (coluna Total colorida). */
const SALES_VALUE_INDICATOR_ID = "salesValue";

export const Route = createFileRoute("/executivo/kpi")({
  head: () => ({
    meta: [
      { title: "KPI Manager — Atlas Platform" },
      {
        name: "description",
        content:
          "Workspace operacional de indicadores, campanhas e consolidação executiva da Atlas Platform.",
      },
      { property: "og:title", content: "KPI Manager — Atlas Platform" },
      {
        property: "og:description",
        content:
          "Workspace operacional de indicadores, campanhas e consolidação executiva da Atlas Platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KpiManagerPage,
});

function KpiManagerPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);
  if (!session) return null;
  return <KpiManagerBody session={session} />;
}

function kpiCollaborators(session: ExecutiveSession): ExecutiveUser[] {
  const visible = visibleCollaborators(session).filter(
    (u) => u.id !== "usr_joao" && u.id !== "usr_felipe",
  );
  if (session.activeRole !== "super_admin") return visible;

  const currentUser = loadUsers().find(
    (u) => u.id === session.userId && u.status === "ativo",
  );
  if (!currentUser || visible.some((u) => u.id === currentUser.id)) return visible;
  return [currentUser, ...visible];
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function buildConsolidatedDataset(
  collaborators: ExecutiveUser[],
  monthKey: string,
): KpiDataset {
  const matrix: KpiDataset["matrix"] = {};
  for (const ind of INDICATORS) matrix[ind.id] = {};
  let updatedAt = Date.now();

  for (const collaborator of collaborators) {
    const ds = loadDataset(collaborator.id, monthKey);
    updatedAt = Math.max(updatedAt, ds.updatedAt);
    for (const ind of INDICATORS) {
      const row = ds.matrix[ind.id] ?? {};
      for (const dayKey in row) {
        const day = Number(dayKey);
        matrix[ind.id][day] = (matrix[ind.id][day] ?? 0) + (row[day] ?? 0);
      }
    }
  }

  return {
    userId: CONSOLIDATED_VIEW_ID,
    monthKey,
    matrix,
    updatedAt,
  };
}

function KpiManagerBody({ session }: { session: ExecutiveSession }) {
  const collaborators = useMemo(() => kpiCollaborators(session), [session]);
  const canUseConsolidated = session.activeRole !== "executivo";
  const defaultViewId = canUseConsolidated ? CONSOLIDATED_VIEW_ID : session.userId;
  const [viewId, setViewId] = useState(defaultViewId);
  const defaults = useMemo(
    () => ({
      monthKey: DEFAULT_MONTH_KEY,
      collaboratorId: defaultViewId,
    }),
    [defaultViewId],
  );
  const { ctx, update } = useKpiContext(session, defaults);

  const activeMonth = findMonth(ctx.monthKey);
  const isConsolidated = canUseConsolidated && viewId === CONSOLIDATED_VIEW_ID;
  const activeCollab = isConsolidated
    ? null
    : collaborators.find((c) => c.id === viewId) ?? collaborators[0] ?? null;
  const activeUserId = activeCollab?.id ?? session.userId;
  const activeLabel = isConsolidated
    ? session.activeRole === "super_admin"
      ? "Consolidado geral"
      : "Consolidado da equipe"
    : activeCollab?.name ?? session.name;

  const [dataset, setDataset] = useState<KpiDataset>(() =>
    loadDataset(activeUserId, activeMonth.key),
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const [flashCell, setFlashCell] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    setViewId(defaultViewId);
  }, [defaultViewId]);

  useEffect(() => {
    if (!isConsolidated) setDataset(loadDataset(activeUserId, activeMonth.key));
  }, [activeUserId, activeMonth.key, isConsolidated]);

  const days = daysInMonth(activeMonth);
  const consolidatedDataset = useMemo(
    () => buildConsolidatedDataset(collaborators, activeMonth.key),
    [collaborators, activeMonth.key],
  );
  const visibleDataset = isConsolidated ? consolidatedDataset : dataset;
  const summary = useMemo(() => summarize(visibleDataset), [visibleDataset]);

  function commitCell(indicatorId: string, day: number, next: number) {
    if (isConsolidated) return;
    setDataset((prev) => {
      const nextMatrix = { ...prev.matrix };
      nextMatrix[indicatorId] = { ...(nextMatrix[indicatorId] ?? {}), [day]: next };
      const nd: KpiDataset = { ...prev, matrix: nextMatrix, updatedAt: Date.now() };
      // Persistência com debounce
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveDataset(nd);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1400);
      }, 250);
      return nd;
    });
    const cellKey = `${indicatorId}-${day}`;
    setFlashCell(cellKey);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashCell(null), 900);
  }

  function resetMonth() {
    if (isConsolidated) return;
    if (!window.confirm(`Restaurar dados fictícios de ${activeMonth.label}?`)) return;
    const fresh = resetDataset(activeUserId, activeMonth.key);
    setDataset(fresh);
  }

  return (
    <ExecutiveShell session={session} title="KPI Manager" fullBleed>
      <div
        className="w-full min-w-0 max-w-full flex flex-col"
        style={{
          overflowX: "clip",
          contain: "inline-size",
          // Viewport próprio do KPI: preenche a área útil abaixo do header
          // do shell e nunca faz a página inteira rolar.
          height: "calc(100vh - var(--atlas-shell-offset, 96px))",
        }}
      >
      {/* Barra de contexto ------------------------------------------------- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
          <Gauge className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          <span className="uppercase tracking-[0.22em]">
            Fonte oficial de indicadores
          </span>
          <span
            className={cn(
              "ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition",
              savedFlash
                ? "bg-emerald-400/10 text-emerald-300 opacity-100"
                : "bg-[color:var(--card)]/40 text-[color:var(--muted-foreground)]/70 opacity-70",
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            {savedFlash ? "Alterações salvas automaticamente" : "Auto save ativo"}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <MonthSelector
            currentKey={ctx.monthKey}
            onSelect={(k) => update({ monthKey: k })}
          />
          <button
            type="button"
            onClick={resetMonth}
            disabled={isConsolidated}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] transition",
              isConsolidated
                ? "cursor-not-allowed text-[color:var(--muted-foreground)]/40 opacity-60"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40",
            )}
            title={isConsolidated ? "Disponível apenas no KPI individual" : "Restaurar dados fictícios do mês ativo"}
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar
          </button>
        </div>
      </div>

      {/* Container dedicado do módulo KPI ---------------------------------- */}
      <div className="max-w-full overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)]/55 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] sm:p-5">

      {/* Resumo executivo do topo — apenas informações estratégicas ------- */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">Competência</p>
          <p className="font-display text-lg mt-1">{activeMonth.label}</p>
          <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">{activeLabel} · {days} dias</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--gold)]/10 to-transparent p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
              <HandCoins className="h-3.5 w-3.5" strokeWidth={1.6} />
            </span>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">Valor Vendido Acumulado</p>
          </div>
          <p className="font-display text-xl mt-2 tabular-nums text-[color:var(--gold)]">{formatCurrency(summary.salesValue)}</p>
        </div>
        {isConsolidated ? (
          <ConsolidatedSummaryCard summary={summary} collaboratorCount={collaborators.length} />
        ) : (
          <CampanhaVeloxCard salesValue={summary.salesValue} />
        )}
      </div>

      {/* Cabeçalho da planilha -------------------------------------------- */}
      <div className="mt-4 max-w-full overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[#F5F6F8] text-[color:var(--navy-deep)] shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-black/10 bg-white/60">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[color:var(--navy)]" />
            <h2 className="font-display text-base leading-none">{activeMonth.label}</h2>
             <span className="text-xs text-black/55">· {activeLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-black/55">
            <Activity className="h-3.5 w-3.5" />
             {days} dias · {isConsolidated ? "modo consolidado" : "edite qualquer célula"}
          </div>
        </div>

        {/* Planilha */}
        <KpiSpreadsheet
          matrix={visibleDataset.matrix}
          days={days}
          isWeekendDay={(d) => isWeekend(activeMonth, d)}
          onCommit={commitCell}
          flashCell={flashCell}
          readOnly={isConsolidated}
        />
      </div>

      {/* Rodapé: abas de colaboradores ------------------------------------ */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/20 overflow-hidden">
        <div className="px-5 py-3 border-b border-[color:var(--border)] flex items-center gap-2">
          <Users className="h-4 w-4 text-[color:var(--gold)]" />
          <span className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Colaboradores
          </span>
          <span className="ml-auto text-[11px] text-[color:var(--muted-foreground)]">
            Escopo respeitando permissões do perfil ativo
          </span>
        </div>
        <div className="max-w-full overflow-x-auto kpi-scroll">
          <div className="flex w-max min-w-full">
            {canUseConsolidated && (
              <button
                key={CONSOLIDATED_VIEW_ID}
                type="button"
                onClick={() => setViewId(CONSOLIDATED_VIEW_ID)}
                className={cn(
                  "px-5 py-3 text-sm border-r border-[color:var(--border)] transition whitespace-nowrap flex items-center gap-2",
                  isConsolidated
                    ? "bg-[color:var(--accent)] text-[color:var(--foreground)] border-b-2 border-b-[color:var(--gold)]"
                    : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] border-b-2 border-b-transparent",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium",
                    isConsolidated
                      ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                      : "bg-[color:var(--card)]/60 text-[color:var(--muted-foreground)]",
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </span>
                {session.activeRole === "super_admin" ? "Geral" : "Equipe"}
              </button>
            )}
            {collaborators.map((c) => {
              const active = !isConsolidated && c.id === activeUserId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setViewId(c.id)}
                  className={cn(
                    "px-5 py-3 text-sm border-r border-[color:var(--border)] transition whitespace-nowrap flex items-center gap-2",
                    active
                      ? "bg-[color:var(--accent)] text-[color:var(--foreground)] border-b-2 border-b-[color:var(--gold)]"
                      : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] border-b-2 border-b-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium",
                      active
                        ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                        : "bg-[color:var(--card)]/60 text-[color:var(--muted-foreground)]",
                    )}
                  >
                    {initialsFor(c.name)}
                  </span>
                  {c.name.split(" ")[0]}
                </button>
              );
            })}
            {collaborators.length === 0 && (
              <div className="px-5 py-4 text-sm text-[color:var(--muted-foreground)]">
                Nenhum colaborador visível no escopo atual.
              </div>
            )}
          </div>
        </div>
      </div>

      </div>

      <p className="mt-4 text-[11px] text-[color:var(--muted-foreground)] text-center max-w-2xl mx-auto">
        Dados fictícios de Julho/2026 para demonstração. A partir de Agosto/2026 a
        estrutura receberá lançamentos reais e alimentará automaticamente o Brain
        Analytics, os Relatórios e a IA Corporativa — respeitando as permissões do
        perfil ativo.
      </p>
     </div>
    </ExecutiveShell>
  );
}

/* ---------------------- Componentes internos ---------------------- */

function MonthSelector({
  currentKey,
  onSelect,
}: {
  currentKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 p-0.5 overflow-x-auto max-w-full">
      {AVAILABLE_MONTHS.map((m) => {
        const active = m.key === currentKey;
        const seeded = m.key === DEFAULT_MONTH_KEY;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onSelect(m.key)}
            className={cn(
              "relative rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap transition",
              active
                ? "bg-[color:var(--accent)] text-[color:var(--foreground)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            )}
            title={seeded ? "Mês com dados fictícios de demonstração" : "Aguardando lançamentos"}
          >
            {m.label}
            {seeded && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ConsolidatedSummaryCard({
  summary,
  collaboratorCount,
}: {
  summary: ReturnType<typeof summarize>;
  collaboratorCount: number;
}) {
  const allIndicators =
    summary.leads +
    summary.calls +
    summary.presentations +
    summary.contractsSent +
    summary.sales;

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.6} />
        </span>
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Consolidado
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[color:var(--muted-foreground)]">
        <span>Leads: <strong className="text-[color:var(--foreground)] tabular-nums">{summary.leads.toLocaleString("pt-BR")}</strong></span>
        <span>Ligações: <strong className="text-[color:var(--foreground)] tabular-nums">{summary.calls.toLocaleString("pt-BR")}</strong></span>
        <span>Contratos: <strong className="text-[color:var(--foreground)] tabular-nums">{summary.contractsSent.toLocaleString("pt-BR")}</strong></span>
        <span>Pagamentos: <strong className="text-[color:var(--foreground)] tabular-nums">{formatCurrency(summary.salesValue)}</strong></span>
      </div>
      <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
        {collaboratorCount} executivos · soma operacional: {allIndicators.toLocaleString("pt-BR")}
      </p>
    </section>
  );
}

// Dimensões da planilha — reajustadas (+~15%) para dar respiro visual
// mantendo a identidade compacta do KPI Manager.
const ROW_H = 43;
const HEADER_H = 46;
const DAY_W = 96;
const IND_W = 316;
const TOTAL_W = 154;
const AVG_W = 132;

function KpiSpreadsheet({
  matrix,
  days,
  isWeekendDay,
  onCommit,
  flashCell,
  readOnly,
}: {
  matrix: KpiDataset["matrix"];
  days: number;
  isWeekendDay: (d: number) => boolean;
  onCommit: (indicatorId: string, day: number, value: number) => void;
  flashCell: string | null;
  readOnly: boolean;
}) {
  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => i + 1),
    [days],
  );

  const rows = INDICATORS.map((ind) => {
    const total = sumRow(matrix, ind.id);
    const avg = days === 0 ? 0 : total / days;
    return { ind, total, avg };
  });

  return (
    <div
      className="grid w-full min-w-0 max-w-full max-h-[720px]"
      style={{
        overflow: "hidden",
        gridTemplateColumns: `minmax(240px, ${IND_W}px) minmax(0, 1fr) minmax(238px, ${TOTAL_W + AVG_W}px)`,
        contain: "inline-size",
      }}
    >
      {/* Coluna Indicador — fixa à esquerda */}
      <div className="min-w-0 border-r border-black/10 bg-[color:var(--navy-deep)] text-[color:var(--foreground)]">
        <div
          className="flex items-center px-3 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] border-b border-black/20"
          style={{ height: HEADER_H }}
        >
          Indicador
        </div>
        {rows.map(({ ind }, i) => (
          <div
            key={ind.id}
            className={cn(
              "relative flex items-center pl-3 pr-2 border-b border-white/5",
              i % 2 === 1 && "bg-white/[0.02]",
            )}
            style={{ height: ROW_H }}
          >
            {ind.marker && (
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-[5px]"
                style={{
                  backgroundColor: ind.marker === "green" ? "#16A34A" : "#D4AF37",
                  boxShadow: `0 0 0 1px ${ind.marker === "green" ? "rgba(22,163,74,0.45)" : "rgba(212,175,55,0.45)"}`,
                }}
              />
            )}
            <span className={cn("text-[12px] font-medium leading-tight", ind.marker && "pl-2")}>{ind.label}</span>
          </div>
        ))}
      </div>

      {/* Área dos dias — única com rolagem horizontal */}
      <div className="min-w-0 overflow-x-auto overflow-y-hidden kpi-scroll bg-[#F5F6F8]">
        <div style={{ width: dayList.length * DAY_W }}>
          {/* Cabeçalho dos dias */}
          <div className="flex border-b border-black/10 bg-white/70" style={{ height: HEADER_H }}>
            {dayList.map((d) => (
              <div
                key={d}
                className={cn(
                  "flex items-center justify-center text-[10px] font-medium tabular-nums border-r border-black/5",
                  isWeekendDay(d) ? "text-[color:var(--navy)] bg-[color:var(--navy)]/[0.16]" : "text-black/55",
                )}
                style={{ width: DAY_W }}
              >
                {String(d).padStart(2, "0")}
              </div>
            ))}
          </div>
          {/* Linhas */}
          {rows.map(({ ind }, i) => (
            <div
              key={ind.id}
              className={cn("flex border-b border-black/5", i % 2 === 1 && "bg-black/[0.015]")}
              style={{ height: ROW_H }}
            >
              {dayList.map((d) => {
                const key = `${ind.id}-${d}`;
                return (
                  <Cell
                    key={key}
                    width={DAY_W}
                    value={matrix[ind.id]?.[d] ?? 0}
                    unit={ind.unit}
                    weekend={isWeekendDay(d)}
                    flash={flashCell === key}
                    readOnly={readOnly}
                    onCommit={(v) => onCommit(ind.id, d, v)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Total + Média — fixos à direita */}
      <div className="min-w-0 flex border-l border-black/10 bg-white/70 text-[color:var(--navy-deep)]">
        <div style={{ width: TOTAL_W }}>
          <div
            className="flex items-center justify-end pr-3 text-[10px] uppercase tracking-[0.22em] text-[color:var(--navy)]/70 border-b border-black/10"
            style={{ height: HEADER_H }}
          >
            Total
          </div>
          {rows.map(({ ind, total }, i) => {
            const tier =
              ind.id === SALES_VALUE_INDICATOR_ID ? campaignTierClass(total) : "";
            return (
              <div
                key={ind.id}
                className={cn(
                  "flex items-center justify-end pr-3 text-[12px] font-semibold tabular-nums border-b border-black/5 text-[color:var(--navy)] transition-colors",
                  i % 2 === 1 && !tier && "bg-black/[0.015]",
                  tier,
                )}
                style={{ height: ROW_H }}
              >
                {formatValue(total, ind.unit)}
              </div>
            );
          })}
        </div>
        <div className="border-l border-black/5" style={{ width: AVG_W }}>
          <div
            className="flex items-center justify-end pr-3 text-[10px] uppercase tracking-[0.22em] text-black/45 border-b border-black/10"
            style={{ height: HEADER_H }}
          >
            Média
          </div>
          {rows.map(({ ind, avg }, i) => (
            <div
              key={ind.id}
              className={cn(
                "flex items-center justify-end pr-3 text-[11px] tabular-nums text-black/55 border-b border-black/5",
                i % 2 === 1 && "bg-black/[0.015]",
              )}
              style={{ height: ROW_H }}
            >
              {ind.unit === "currency"
                ? formatCurrency(avg)
                : avg.toFixed(1).replace(".", ",")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({
  value,
  unit,
  weekend,
  flash,
  readOnly,
  width,
  onCommit,
}: {
  value: number;
  unit: "count" | "currency";
  weekend: boolean;
  flash: boolean;
  readOnly: boolean;
  width: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value || ""));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value ? String(value) : "");
  }, [value, focused]);

  return (
    <div
      className={cn(
        "border-r border-black/5 transition-colors",
        weekend && "bg-[color:var(--navy)]/[0.11]",
        flash && "kpi-flash",
      )}
      style={{ width }}
    >
      <input
        inputMode="numeric"
        readOnly={readOnly}
        aria-readonly={readOnly}
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          if (readOnly) return;
          const raw = e.target.value.replace(/[^\d]/g, "");
          setDraft(raw);
        }}
        onBlur={() => {
          setFocused(false);
          const n = Number(draft || 0);
          if (!readOnly && n !== value) onCommit(n);
          setDraft(n ? String(n) : "");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder={unit === "currency" ? "0" : "—"}
        className={cn(
          "w-full h-full bg-transparent text-center tabular-nums text-[12px] outline-none px-1",
          "text-[color:var(--navy-deep)] placeholder:text-black/25",
          "focus:bg-white focus:ring-1 focus:ring-[color:var(--gold)]/60",
          value === 0 && "text-black/30",
        )}
        style={{ height: ROW_H }}
        aria-label="Valor do dia"
      />
    </div>
  );
}

function groupLabel(g: KpiIndicator["group"]): string {
  switch (g) {
    case "captacao": return "Captação";
    case "atividade": return "Atividade";
    case "reunioes": return "Reuniões";
    case "fechamento": return "Fechamento";
    case "resultado": return "Resultado";
  }
}

/* ---------------------- Prevent unused import warnings ---------------------- */
// averageRow is exposed for future consumers (Brain adapter); kept explicit.
void averageRow;