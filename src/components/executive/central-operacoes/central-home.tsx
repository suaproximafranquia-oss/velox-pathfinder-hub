/**
 * CENTRAL DE OPERAÇÕES — RELATÓRIO DO QUE ACONTECEU NA AÇÃO DO DIA.
 *
 * Esta tela é somente leitura: nada aqui cria, executa, conclui, pula,
 * envia, reagenda ou redistribui. Ela lê a consolidação oficial do
 * servidor e mostra a produção realizada — quatro indicadores, uma
 * tabela por executivo (quando o escopo permitir) e uma tabela diária.
 * O escopo (equipe × própria operação) é decidido no servidor pela
 * identidade autenticada; o navegador nunca escolhe quem é consultado.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarRange,
  ExternalLink,
  Loader2,
  MessageSquare,
  Phone,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { relatorioOperacoes } from "@/lib/crm/operations-center.functions";
import { unitPath } from "@/lib/business-unit";
import { operationalDate } from "@/lib/crm/daily-actions";

type Counts = {
  ligacoes: number;
  mensagens: number;
  enviadas: number;
  reunioes: number;
  pulos: number;
  recuperadas: number;
  total: number;
};

type ExecutiveRow = Counts & { executiveId: string; executiveName: string };
type DayRow = Counts & { date: string };

type Skip = {
  id: string;
  at: string;
  date: string;
  executiveId: string;
  executiveName: string;
  investorId: string | null;
  investorName: string | null;
  step: string | null;
  motivo: string | null;
  recuperada?: boolean;
};

type Report = {
  from: string;
  to: string;
  scope: "equipe" | "propria";
  generatedAt: string;
  totals: Counts;
  executives: ExecutiveRow[];
  days: DayRow[];
  skips: Skip[];
  viewer: {
    role: string;
    executiveId: string | null;
    canSwitchScope: boolean;
  };
};

type PeriodKey = "hoje" | "ontem" | "7d" | "mes" | "custom";

const PERIOD_LABEL: Record<PeriodKey, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "Últimos 7 dias",
  mes: "Este mês",
  custom: "Personalizado",
};

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Períodos sempre em data operacional (America/Sao_Paulo). */
function periodRange(key: PeriodKey, customFrom: string, customTo: string) {
  const today = operationalDate();
  switch (key) {
    case "hoje":
      return { from: today, to: today };
    case "ontem":
      return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
    case "7d":
      return { from: shiftDay(today, -6), to: today };
    case "mes":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "custom":
    default: {
      const from = customFrom > today ? today : customFrom;
      const to = customTo > today ? today : customTo;
      return from > to ? { from: to, to } : { from, to };
    }
  }
}

function formatDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const CARDS = [
  { key: "ligacoes" as const, label: "Ligações efetuadas", icon: Phone },
  { key: "mensagens" as const, label: "Mensagens copiadas", icon: MessageSquare },
  { key: "enviadas" as const, label: "Mensagens enviadas", icon: MessageSquare },
  { key: "reunioes" as const, label: "Reuniões realizadas", icon: CalendarRange },
  { key: "pulos" as const, label: "Pulos", icon: SkipForward },
  { key: "recuperadas" as const, label: "Pendências recuperadas", icon: RotateCcw },
];

export function CentralOperacoesHome() {
  const fetchReport = useServerFn(relatorioOperacoes);
  const today = operationalDate();
  const [period, setPeriod] = useState<PeriodKey>("hoje");
  const [customFrom, setCustomFrom] = useState(shiftDay(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [scope, setScope] = useState<"equipe" | "propria">("equipe");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(
    () => periodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = (await fetchReport({
          data: { from: range.from, to: range.to, scope },
        })) as Report;
        if (!cancelled) setReport(result);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Não foi possível carregar o relatório.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReport, range.from, range.to, scope]);

  /** Caminho oficial já usado pelo Portal dos Leads / Ação do Dia. */
  function investorHref(skip: Skip): string | null {
    if (!skip.investorId) return null;
    return `${unitPath("/executivo/dashboard")}?perfil=${encodeURIComponent(skip.investorId)}`;
  }

  const totals = report?.totals;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Central de Operações</h1>
        <p className="text-sm text-muted-foreground">
          Relatório do que foi efetivamente realizado na Ação do Dia. Esta tela não cria,
          não executa e não altera nenhuma ação.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                period === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABEL[key]}
            </button>
          ))}
        </div>

        {period === "custom" ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">
              De
              <input
                type="date"
                max={today}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Até
              <input
                type="date"
                max={today}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
          </div>
        ) : null}

        {report?.viewer.canSwitchScope ? (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setScope("equipe")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                scope === "equipe"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              Toda a equipe
            </button>
            <button
              type="button"
              onClick={() => setScope("propria")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                scope === "propria"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              Minha operação
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório…
        </p>
      ) : null}

      {report ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {card.label}
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {totals ? totals[card.key] : 0}
                  </p>
                </div>
              );
            })}
          </section>

          {report.scope === "equipe" ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                Produção por executivo — {formatDay(report.from)} a {formatDay(report.to)}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Executivo</th>
                      <th className="px-4 py-2 text-right">Ligações</th>
                      <th className="px-4 py-2 text-right">Mensagens</th>
                      <th className="px-4 py-2 text-right">Reuniões</th>
                      <th className="px-4 py-2 text-right">Pulos</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.executives.map((row) => (
                      <tr key={row.executiveId} className="border-t border-border/60">
                        <td className="px-4 py-2 text-foreground">{row.executiveName}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.ligacoes}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.mensagens}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.reunioes}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.pulos}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-muted/30 font-semibold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right tabular-nums">{report.totals.ligacoes}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{report.totals.mensagens}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{report.totals.reunioes}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{report.totals.pulos}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{report.totals.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {!(report.scope === "propria" && period === "hoje") ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                Produção por dia
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Dia</th>
                      <th className="px-4 py-2 text-right">Ligações</th>
                      <th className="px-4 py-2 text-right">Mensagens</th>
                      <th className="px-4 py-2 text-right">Reuniões</th>
                      <th className="px-4 py-2 text-right">Pulos</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.days.map((day) => (
                      <tr key={day.date} className="border-t border-border/60">
                        <td className="px-4 py-2 text-foreground">{formatDay(day.date)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{day.ligacoes}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{day.mensagens}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{day.reunioes}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{day.pulos}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">
                          {day.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              Pulos registrados
            </h2>
            {report.skips.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Nenhum pulo registrado no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Dia</th>
                      <th className="px-4 py-2 text-left">Hora</th>
                      <th className="px-4 py-2 text-left">Executivo</th>
                      <th className="px-4 py-2 text-left">Investidor</th>
                      <th className="px-4 py-2 text-left">Etapa</th>
                      <th className="px-4 py-2 text-left">Motivo</th>
                      <th className="px-4 py-2 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.skips.map((skip) => {
                      const href = investorHref(skip);
                      return (
                        <tr key={skip.id} className="border-t border-border/60 align-top">
                          <td className="px-4 py-2">{formatDay(skip.date)}</td>
                          <td className="px-4 py-2">{formatTime(skip.at)}</td>
                          <td className="px-4 py-2">{skip.executiveName}</td>
                          <td className="px-4 py-2">
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                {skip.investorName ?? "Abrir ficha"}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">
                                {skip.investorName ?? "—"}
                                <span className="ml-2 text-xs">Acesso indisponível</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">{skip.step ?? "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {skip.motivo ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            {skip.recuperada === true ? (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                                Recuperada
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Em aberto</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default CentralOperacoesHome;
