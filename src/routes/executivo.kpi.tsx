import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Gauge,
  HandCoins,
  RotateCcw,
  Users,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { CampanhaVeloxCard } from "@/components/executive/kpi/campanha-velox";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
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

export const Route = createFileRoute("/executivo/kpi")({
  head: () => ({
    meta: [
      { title: "KPI Manager — Atlas Platform" },
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

function KpiManagerBody({ session }: { session: ExecutiveSession }) {
  const collaborators = useMemo(() => visibleCollaborators(session), [session]);
  const defaults = useMemo(
    () => ({
      monthKey: DEFAULT_MONTH_KEY,
      collaboratorId: collaborators[0]?.id ?? session.userId,
    }),
    [collaborators, session],
  );
  const { ctx, update } = useKpiContext(session, defaults);

  const activeMonth = findMonth(ctx.monthKey);
  const activeCollab =
    collaborators.find((c) => c.id === ctx.collaboratorId) ?? collaborators[0];
  const activeUserId = activeCollab?.id ?? session.userId;

  const [dataset, setDataset] = useState<KpiDataset>(() =>
    loadDataset(activeUserId, activeMonth.key),
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const [flashCell, setFlashCell] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    setDataset(loadDataset(activeUserId, activeMonth.key));
  }, [activeUserId, activeMonth.key]);

  const days = daysInMonth(activeMonth);
  const summary = useMemo(() => summarize(dataset), [dataset]);

  function commitCell(indicatorId: string, day: number, next: number) {
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
    if (!window.confirm(`Restaurar dados fictícios de ${activeMonth.label}?`)) return;
    const fresh = resetDataset(activeUserId, activeMonth.key);
    setDataset(fresh);
  }

  return (
    <ExecutiveShell session={session} title="KPI Manager">
     <div className="w-full min-w-0 overflow-x-hidden">
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
        <div className="flex items-center gap-2">
          <MonthSelector
            currentKey={ctx.monthKey}
            onSelect={(k) => update({ monthKey: k })}
          />
          <button
            type="button"
            onClick={resetMonth}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
            title="Restaurar dados fictícios do mês ativo"
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar
          </button>
        </div>
      </div>

      {/* Container dedicado do módulo KPI ---------------------------------- */}
      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)]/55 p-4 sm:p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">

      {/* Resumo executivo do topo — apenas informações estratégicas ------- */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">Competência</p>
          <p className="font-display text-lg mt-1">{activeMonth.label}</p>
          <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">{activeCollab?.name ?? "—"} · {days} dias</p>
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
        <CampanhaVeloxCard salesValue={summary.salesValue} />
      </div>

      {/* Cabeçalho da planilha -------------------------------------------- */}
      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[#F5F6F8] text-[color:var(--navy-deep)] overflow-hidden shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-black/10 bg-white/60">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[color:var(--navy)]" />
            <h2 className="font-display text-base leading-none">{activeMonth.label}</h2>
            <span className="text-xs text-black/55">· {activeCollab?.name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-black/55">
            <Activity className="h-3.5 w-3.5" />
            {days} dias · edite qualquer célula
          </div>
        </div>

        {/* Planilha */}
        <KpiSpreadsheet
          matrix={dataset.matrix}
          days={days}
          isWeekendDay={(d) => isWeekend(activeMonth, d)}
          onCommit={commitCell}
          flashCell={flashCell}
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
        <div className="overflow-x-auto">
          <div className="flex min-w-max">
            {collaborators.map((c) => {
              const active = c.id === ctx.collaboratorId;
              const initials = c.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update({ collaboratorId: c.id })}
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
                    {initials}
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

const ROW_H = 32;
const HEADER_H = 34;
const DAY_W_COUNT = 48;
const DAY_W_CURRENCY = 96;
const IND_W = 288;
const TOTAL_W = 132;
const AVG_W = 108;

function KpiSpreadsheet({
  matrix,
  days,
  isWeekendDay,
  onCommit,
  flashCell,
}: {
  matrix: KpiDataset["matrix"];
  days: number;
  isWeekendDay: (d: number) => boolean;
  onCommit: (indicatorId: string, day: number, value: number) => void;
  flashCell: string | null;
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
    <div className="flex w-full min-w-0 max-h-[560px] overflow-hidden">
      {/* Coluna Indicador — fixa à esquerda */}
      <div className="shrink-0 border-r border-black/10 bg-[color:var(--navy-deep)] text-[color:var(--foreground)]" style={{ width: IND_W }}>
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
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
                style={{ backgroundColor: ind.marker === "green" ? "#16A34A" : "#B8894A" }}
              />
            )}
            <span className="truncate text-[12px] font-medium">{ind.label}</span>
          </div>
        ))}
      </div>

      {/* Área dos dias — única com rolagem horizontal */}
      <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden kpi-scroll bg-[#F5F6F8]">
        <div style={{ width: dayList.length * DAY_W }}>
          {/* Cabeçalho dos dias */}
          <div className="flex border-b border-black/10 bg-white/70" style={{ height: HEADER_H }}>
            {dayList.map((d) => (
              <div
                key={d}
                className={cn(
                  "flex items-center justify-center text-[10px] font-medium tabular-nums border-r border-black/5",
                  isWeekendDay(d) ? "text-[color:var(--navy)]/60 bg-black/[0.03]" : "text-black/55",
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
                    onCommit={(v) => onCommit(ind.id, d, v)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Total + Média — fixos à direita */}
      <div className="shrink-0 flex border-l border-black/10 bg-white/70 text-[color:var(--navy-deep)]">
        <div style={{ width: TOTAL_W }}>
          <div
            className="flex items-center justify-end pr-3 text-[10px] uppercase tracking-[0.22em] text-[color:var(--navy)]/70 border-b border-black/10"
            style={{ height: HEADER_H }}
          >
            Total
          </div>
          {rows.map(({ ind, total }, i) => (
            <div
              key={ind.id}
              className={cn(
                "flex items-center justify-end pr-3 text-[12px] font-semibold tabular-nums border-b border-black/5 text-[color:var(--navy)]",
                i % 2 === 1 && "bg-black/[0.015]",
              )}
              style={{ height: ROW_H }}
            >
              {formatValue(total, ind.unit)}
            </div>
          ))}
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
  width,
  onCommit,
}: {
  value: number;
  unit: "count" | "currency";
  weekend: boolean;
  flash: boolean;
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
        weekend && "bg-black/[0.035]",
        flash && "kpi-flash",
      )}
      style={{ width }}
    >
      <input
        inputMode="numeric"
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          setDraft(raw);
        }}
        onBlur={() => {
          setFocused(false);
          const n = Number(draft || 0);
          if (n !== value) onCommit(n);
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