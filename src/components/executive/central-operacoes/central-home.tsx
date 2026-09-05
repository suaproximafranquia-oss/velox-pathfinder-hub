/**
 * CENTRAL DE OPERAÇÕES — painel gerencial somente leitura.
 *
 * Nada aqui cria, executa, conclui, pula, envia ou reagenda. Todos os
 * números vêm de uma única consolidação no servidor; o drill-down
 * apenas filtra a lista já carregada e reaproveita a ficha existente
 * do Workspace.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CalendarRange,
  ExternalLink,
  Loader2,
  MessageSquare,
  Phone,
  Sparkles,
  UserRound,
} from "lucide-react";
import { relatorioOperacoes } from "@/lib/crm/operations-center.functions";
import { unitPath } from "@/lib/business-unit";

type Kind = "mensagem" | "ligacao" | "e0" | "reuniao";

type Action = {
  id: string;
  source: string;
  kind: Kind;
  step: string | null;
  status: "executada" | "pendente" | "cancelada" | "nao_realizada";
  overdue: boolean;
  /** Obrigação planejada dentro do período (visão ADERÊNCIA). */
  planned: boolean;
  /** Executada dentro do período (visão PRODUÇÃO). */
  produced: boolean;
  plannedAt: string | null;
  executedAt: string | null;
  result: string | null;
  reason: string | null;
  executiveId: string | null;
  executiveName: string | null;
  currentOwnerId: string | null;
  investorId: string | null;
  investorName: string | null;
  scope: string | null;
  snapshot: {
    libraryCode: string | null;
    libraryVersion: number | null;
    body: string | null;
    contentUrl: string | null;
    sentAt: string | null;
    origin: string | null;
    simulated: boolean | null;
  } | null;
};

type Skip = {
  id: string;
  actionKey: string | null;
  kind: string | null;
  step: string | null;
  title: string | null;
  motivo: string | null;
  executiveId: string | null;
  executiveName: string | null;
  investorId: string | null;
  investorName: string | null;
  at: string;
};

type Summary = {
  executiveId: string;
  executiveName: string;
  planejadas: number;
  executadasDoPlanejado: number;
  pendentes: number;
  /** Subconjunto de pendentes — nunca somar às demais. */
  vencidas: number;
  canceladas: number;
  producao: number;
  puladas: number;
  porTipoPlanejado: Record<Kind, number>;
  porTipoProducao: Record<Kind, number>;
  taxaAderencia: number | null;
  taxaSkip: number | null;
};

type Report = {
  from: string;
  to: string;
  generatedAt: string;
  totals: Summary;
  executives: Summary[];
  motivos: Array<{ motivo: string; total: number }>;
  actions: Action[];
  skips: Skip[];
};

const KIND_LABEL: Record<Kind, string> = {
  mensagem: "Mensagens",
  ligacao: "Ligações",
  e0: "Primeiro contato (E0)",
  reuniao: "Reuniões",
};

const KIND_ICON: Record<Kind, typeof MessageSquare> = {
  mensagem: MessageSquare,
  ligacao: Phone,
  e0: Sparkles,
  reuniao: CalendarRange,
};

const STATUS_LABEL: Record<Action["status"], string> = {
  executada: "Executada",
  pendente: "Pendente",
  cancelada: "Cancelada",
  nao_realizada: "Não realizada",
};

type PeriodKey = "hoje" | "ontem" | "7d" | "30d" | "custom";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function periodRange(key: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = 24 * 3600 * 1000;
  switch (key) {
    case "hoje":
      return { from: startOfToday.toISOString(), to: new Date(startOfToday.getTime() + day).toISOString() };
    case "ontem":
      return {
        from: new Date(startOfToday.getTime() - day).toISOString(),
        to: startOfToday.toISOString(),
      };
    case "7d":
      return {
        from: new Date(startOfToday.getTime() - 6 * day).toISOString(),
        to: new Date(startOfToday.getTime() + day).toISOString(),
      };
    case "30d":
      return {
        from: new Date(startOfToday.getTime() - 29 * day).toISOString(),
        to: new Date(startOfToday.getTime() + day).toISOString(),
      };
    case "custom":
    default:
      return {
        from: `${customFrom}T00:00:00.000Z`,
        to: new Date(new Date(`${customTo}T00:00:00.000Z`).getTime() + day).toISOString(),
      };
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Drill = {
  title: string;
  executiveId: string | null;
  filter: (a: Action) => boolean;
  skipsOnly?: boolean;
  skipFilter?: (s: Skip) => boolean;
};

export function CentralOperacoesHome() {
  const fetchReport = useServerFn(relatorioOperacoes);
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [customFrom, setCustomFrom] = useState(isoDay(new Date(Date.now() - 6 * 86400000)));
  const [customTo, setCustomTo] = useState(isoDay(new Date()));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [detail, setDetail] = useState<Action | null>(null);

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
        const result = (await fetchReport({ data: { from: range.from, to: range.to } })) as Report;
        if (!cancelled) setReport(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível carregar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReport, range.from, range.to]);

  const drillActions = useMemo(() => {
    if (!report || !drill || drill.skipsOnly) return [];
    return report.actions.filter(drill.filter);
  }, [report, drill]);

  const drillSkips = useMemo(() => {
    if (!report || !drill?.skipsOnly) return [];
    return report.skips.filter(drill.skipFilter ?? (() => true));
  }, [report, drill]);

  type Metric =
    | "planejadas"
    | "producao"
    | "executadasDoPlanejado"
    | "pendentes"
    | "vencidas"
    | "canceladas"
    | "puladas";

  /**
   * O drill-down usa exatamente o mesmo predicado que gerou o número:
   * não existe consulta paralela com outra regra.
   */
  function openExecutive(summary: Summary, metric: Metric, label: string) {
    const isUnassigned = summary.executiveId === "__sem_responsavel_historico__";
    const matchExec = (a: Action) =>
      summary.executiveId === "__totais__"
        ? true
        : isUnassigned
          ? a.executiveId === null
          : a.executiveId === summary.executiveId;
    if (metric === "puladas") {
      setDrill({
        title: `${summary.executiveName} — ${label}`,
        executiveId: summary.executiveId,
        filter: () => false,
        skipsOnly: true,
        skipFilter: (s) =>
          summary.executiveId === "__totais__"
            ? true
            : isUnassigned
              ? s.executiveId === null
              : s.executiveId === summary.executiveId,
      });
      return;
    }
    setDrill({
      title: `${summary.executiveName} — ${label}`,
      executiveId: summary.executiveId,
      filter: (a) => {
        if (!matchExec(a)) return false;
        if (metric === "producao") return a.produced;
        if (!a.planned) return false;
        if (metric === "executadasDoPlanejado") return a.status === "executada";
        if (metric === "pendentes") return a.status === "pendente";
        if (metric === "canceladas") return a.status === "cancelada";
        if (metric === "vencidas") return a.status === "pendente" && a.overdue;
        return true;
      },
    });
  }

  function openKind(kind: Kind, view: "planejado" | "producao") {
    setDrill({
      title: `${KIND_LABEL[kind]} — ${view === "producao" ? "produção do período" : "planejadas no período"}`,
      executiveId: null,
      filter: (a) => a.kind === kind && (view === "producao" ? a.produced : a.planned),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[color:var(--gold)]" />
          <div>
            <h1 className="text-lg font-medium">Central de Operações</h1>
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Consolidação somente leitura das ações da Financeira. Nenhuma ação é criada,
              executada ou alterada aqui.
            </p>
          </div>
        </div>
        <PeriodPicker
          period={period}
          onPeriod={setPeriod}
          from={customFrom}
          to={customTo}
          onFrom={setCustomFrom}
          onTo={setCustomTo}
        />
      </header>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 py-8 text-sm text-[color:var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Consolidando o período…
        </div>
      ) : error ? (
        <p className="rounded-xl border border-[color:var(--border)] px-4 py-8 text-sm text-[color:var(--muted-foreground)]">
          {error}
        </p>
      ) : report ? (
        <>
          {/* PRODUÇÃO DO PERÍODO — o que foi efetivamente executado,
              pela data de execução. Não é somável com a aderência. */}
          <section className="rounded-xl border border-[color:var(--border)] p-4">
            <header className="mb-3">
              <h2 className="text-sm font-medium">Produção do período</h2>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                Ações efetivamente executadas dentro do período, pela data da execução.
                Inclui ações planejadas em outros dias. Não somar com a aderência abaixo.
              </p>
            </header>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <MetricCard
                label="Executadas — produção"
                value={report.totals.producao}
                onClick={() => openExecutive(report.totals, "producao", "Produção do período")}
              />
              {(Object.keys(KIND_LABEL) as Kind[]).map((kind) => {
                const Icon = KIND_ICON[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => openKind(kind, "producao")}
                    className="rounded-xl border border-[color:var(--border)] px-4 py-3 text-left transition hover:border-[color:var(--gold)]"
                  >
                    <span className="flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                      <Icon className="h-3.5 w-3.5" /> {KIND_LABEL[kind]}
                    </span>
                    <strong className="mt-1 block text-xl">
                      {report.totals.porTipoProducao[kind]}
                    </strong>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ADERÊNCIA AO PLANEJAMENTO — obrigações cuja data planejada
              caiu no período. Overdue é subconjunto de pendentes. */}
          <section className="rounded-xl border border-[color:var(--border)] p-4">
            <header className="mb-3">
              <h2 className="text-sm font-medium">Aderência ao planejamento</h2>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                Obrigações cujo vencimento caiu no período: quantas foram cumpridas, quantas
                seguem em aberto. Taxa = executadas do planejado ÷ planejadas.
              </p>
            </header>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <MetricCard label="Planejadas" value={report.totals.planejadas} onClick={() => openExecutive(report.totals, "planejadas", "Planejadas")} />
              <MetricCard label="Executadas — do planejado" value={report.totals.executadasDoPlanejado} onClick={() => openExecutive(report.totals, "executadasDoPlanejado", "Executadas do planejado")} />
              <MetricCard
                label="Pendentes"
                value={report.totals.pendentes}
                hint={`inclui ${report.totals.vencidas} vencida(s)`}
                onClick={() => openExecutive(report.totals, "pendentes", "Pendentes")}
              />
              <MetricCard label="Puladas" value={report.totals.puladas} onClick={() => openExecutive(report.totals, "puladas", "Puladas")} />
              <MetricCard label="Canceladas" value={report.totals.canceladas} onClick={() => openExecutive(report.totals, "canceladas", "Canceladas")} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {(Object.keys(KIND_LABEL) as Kind[]).map((kind) => {
                const Icon = KIND_ICON[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => openKind(kind, "planejado")}
                    className="rounded-xl border border-[color:var(--border)] px-4 py-3 text-left transition hover:border-[color:var(--gold)]"
                  >
                    <span className="flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                      <Icon className="h-3.5 w-3.5" /> {KIND_LABEL[kind]}
                    </span>
                    <strong className="mt-1 block text-xl">
                      {report.totals.porTipoPlanejado[kind]}
                    </strong>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--border)]">
            <header className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
              <h2 className="text-sm font-medium">Por executivo</h2>
              <span className="text-[11px] text-[color:var(--muted-foreground)]">
                Responsável histórico da ação, nunca o dono atual do lead. “Vencidas” está
                dentro de “Pendentes”.
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[color:var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-2 font-normal">Executivo</th>
                    <th className="px-3 py-2 font-normal">Produção</th>
                    <th className="px-3 py-2 font-normal">Planejadas</th>
                    <th className="px-3 py-2 font-normal">Exec. do planejado</th>
                    <th className="px-3 py-2 font-normal">Pendentes (vencidas)</th>
                    <th className="px-3 py-2 font-normal">Puladas</th>
                    <th className="px-3 py-2 font-normal">Canceladas</th>
                    <th className="px-3 py-2 font-normal">Aderência</th>
                    <th className="px-3 py-2 font-normal">Pulo</th>
                  </tr>
                </thead>
                <tbody>
                  {report.executives.map((exec) => (
                    <tr key={exec.executiveId} className="border-t border-[color:var(--border)]">
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <UserRound className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
                          {exec.executiveName}
                        </span>
                      </td>
                      <NumberCell value={exec.producao} onClick={() => openExecutive(exec, "producao", "Produção do período")} />
                      <NumberCell value={exec.planejadas} onClick={() => openExecutive(exec, "planejadas", "Planejadas")} />
                      <NumberCell value={exec.executadasDoPlanejado} onClick={() => openExecutive(exec, "executadasDoPlanejado", "Executadas do planejado")} />
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openExecutive(exec, "pendentes", "Pendentes")}
                          className="underline decoration-dotted"
                        >
                          {exec.pendentes}
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() => openExecutive(exec, "vencidas", "Vencidas (dentro de pendentes)")}
                          className="text-[color:var(--muted-foreground)] underline decoration-dotted"
                        >
                          ({exec.vencidas} venc.)
                        </button>
                      </td>
                      <NumberCell value={exec.puladas} onClick={() => openExecutive(exec, "puladas", "Puladas")} />
                      <NumberCell value={exec.canceladas} onClick={() => openExecutive(exec, "canceladas", "Canceladas")} />
                      <td className="px-3 py-2">{exec.taxaAderencia === null ? "—" : `${exec.taxaAderencia}%`}</td>
                      <td className="px-3 py-2">{exec.taxaSkip === null ? "—" : `${exec.taxaSkip}%`}</td>
                    </tr>
                  ))}
                  {report.executives.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-[color:var(--muted-foreground)]">
                        Nenhuma ação no período.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {report.motivos.length > 0 ? (
            <section className="rounded-xl border border-[color:var(--border)] px-4 py-3">
              <h2 className="text-sm font-medium">Motivos de pulo</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {report.motivos.map((m) => (
                  <li key={m.motivo}>
                    <button
                      type="button"
                      onClick={() =>
                        setDrill({
                          title: `Puladas — ${m.motivo}`,
                          executiveId: null,
                          filter: () => false,
                          skipsOnly: true,
                          skipFilter: (s) => (s.motivo?.trim() || "Sem motivo informado") === m.motivo,
                        })
                      }
                      className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] transition hover:border-[color:var(--gold)]"
                    >
                      {m.motivo} · {m.total}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {drill ? (
            <section className="rounded-xl border border-[color:var(--border)]">
              <header className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
                <h2 className="text-sm font-medium">{drill.title}</h2>
                <button
                  type="button"
                  onClick={() => setDrill(null)}
                  className="text-[11px] text-[color:var(--muted-foreground)] underline"
                >
                  fechar
                </button>
              </header>
              {drill.skipsOnly ? (
                <SkipList skips={drillSkips} />
              ) : (
                <ActionList actions={drillActions} onDetail={setDetail} />
              )}
            </section>
          ) : null}

          {detail ? <ActionDetail action={detail} onClose={() => setDetail(null)} /> : null}
        </>
      ) : null}
    </div>
  );
}

function PeriodPicker(props: {
  period: PeriodKey;
  onPeriod: (p: PeriodKey) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const options: Array<[PeriodKey, string]> = [
    ["hoje", "Hoje"],
    ["ontem", "Ontem"],
    ["7d", "7 dias"],
    ["30d", "30 dias"],
    ["custom", "Personalizado"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => props.onPeriod(key)}
          className={`rounded-full border px-3 py-1 text-[11px] transition ${
            props.period === key
              ? "border-[color:var(--gold)] text-[color:var(--gold)]"
              : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
          }`}
        >
          {label}
        </button>
      ))}
      {props.period === "custom" ? (
        <span className="flex items-center gap-1 text-[11px]">
          <input
            type="date"
            value={props.from}
            onChange={(e) => props.onFrom(e.target.value)}
            className="rounded border border-[color:var(--border)] bg-transparent px-2 py-1"
          />
          <span className="text-[color:var(--muted-foreground)]">até</span>
          <input
            type="date"
            value={props.to}
            onChange={(e) => props.onTo(e.target.value)}
            className="rounded border border-[color:var(--border)] bg-transparent px-2 py-1"
          />
        </span>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[color:var(--border)] px-4 py-3 text-left transition hover:border-[color:var(--gold)]"
    >
      <span className="text-[11px] text-[color:var(--muted-foreground)]">{label}</span>
      <strong className="mt-1 block text-2xl">{value}</strong>
    </button>
  );
}

function NumberCell({ value, onClick }: { value: number; onClick: () => void }) {
  return (
    <td className="px-3 py-2">
      {value > 0 ? (
        <button type="button" onClick={onClick} className="underline underline-offset-2">
          {value}
        </button>
      ) : (
        <span className="text-[color:var(--muted-foreground)]">0</span>
      )}
    </td>
  );
}

function investorHref(action: { investorId: string | null; scope: string | null }): string | null {
  if (!action.investorId) return null;
  const scope = action.scope ?? "";
  return `${unitPath("/executivo/dashboard")}?perfil=${encodeURIComponent(action.investorId)}${
    scope ? `&escopo=${encodeURIComponent(scope)}` : ""
  }`;
}

function ActionList({ actions, onDetail }: { actions: Action[]; onDetail: (a: Action) => void }) {
  if (actions.length === 0) {
    return <p className="px-4 py-6 text-xs text-[color:var(--muted-foreground)]">Nenhuma ação nesta seleção.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[color:var(--muted-foreground)]">
          <tr>
            <th className="px-4 py-2 font-normal">Tipo</th>
            <th className="px-3 py-2 font-normal">Etapa</th>
            <th className="px-3 py-2 font-normal">Investidor</th>
            <th className="px-3 py-2 font-normal">Planejada</th>
            <th className="px-3 py-2 font-normal">Executada</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 font-normal">Executivo</th>
            <th className="px-3 py-2 font-normal">Resultado / motivo</th>
            <th className="px-3 py-2 font-normal">Ficha</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => {
            const href = investorHref(a);
            return (
              <tr key={`${a.source}:${a.id}`} className="border-t border-[color:var(--border)] align-top">
                <td className="px-4 py-2">{KIND_LABEL[a.kind]}</td>
                <td className="px-3 py-2">{a.step ?? "—"}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onDetail(a)} className="underline underline-offset-2">
                    {a.investorName ?? "Investidor"}
                  </button>
                </td>
                <td className="px-3 py-2">{formatDate(a.plannedAt)}</td>
                <td className="px-3 py-2">{formatDate(a.executedAt)}</td>
                <td className="px-3 py-2">
                  {STATUS_LABEL[a.status]}
                  {a.overdue ? <span className="ml-1 text-[color:var(--gold)]">· vencida</span> : null}
                </td>
                <td className="px-3 py-2">
                  {a.executiveName ?? (
                    <span className="text-[color:var(--muted-foreground)]">
                      Responsável histórico não registrado
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{a.result ?? a.reason ?? "—"}</td>
                <td className="px-3 py-2">
                  {href ? (
                    <a href={href} className="inline-flex items-center gap-1 underline underline-offset-2">
                      abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkipList({ skips }: { skips: Skip[] }) {
  if (skips.length === 0) {
    return <p className="px-4 py-6 text-xs text-[color:var(--muted-foreground)]">Nenhum pulo nesta seleção.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[color:var(--muted-foreground)]">
          <tr>
            <th className="px-4 py-2 font-normal">Quando</th>
            <th className="px-3 py-2 font-normal">Ação</th>
            <th className="px-3 py-2 font-normal">Etapa</th>
            <th className="px-3 py-2 font-normal">Investidor</th>
            <th className="px-3 py-2 font-normal">Motivo</th>
            <th className="px-3 py-2 font-normal">Executivo</th>
            <th className="px-3 py-2 font-normal">Identificador</th>
          </tr>
        </thead>
        <tbody>
          {skips.map((s) => (
            <tr key={s.id} className="border-t border-[color:var(--border)] align-top">
              <td className="px-4 py-2">{formatDate(s.at)}</td>
              <td className="px-3 py-2">{s.title ?? s.kind ?? "—"}</td>
              <td className="px-3 py-2">{s.step ?? "—"}</td>
              <td className="px-3 py-2">
                {s.investorId ? (
                  <a
                    href={investorHref({ investorId: s.investorId, scope: null }) ?? "#"}
                    className="underline underline-offset-2"
                  >
                    {s.investorName ?? "Investidor"}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">{s.motivo ?? "—"}</td>
              <td className="px-3 py-2">{s.executiveName ?? "—"}</td>
              <td className="px-3 py-2 text-[10px] text-[color:var(--muted-foreground)]">{s.actionKey ?? s.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionDetail({ action, onClose }: { action: Action; onClose: () => void }) {
  const href = investorHref(action);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-5 text-sm">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">{action.investorName}</h3>
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              {KIND_LABEL[action.kind]} · {action.step ?? "—"} · {STATUS_LABEL[action.status]}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[11px] underline">
            fechar
          </button>
        </header>

        <dl className="mt-4 space-y-1 text-xs">
          <Row label="Identificador">{`${action.source}:${action.id}`}</Row>
          <Row label="Planejada">{formatDate(action.plannedAt)}</Row>
          <Row label="Executada">{formatDate(action.executedAt)}</Row>
          <Row label="Responsável histórico">
            {action.executiveName ?? "não registrado"}
          </Row>
          <Row label="Dono atual do lead">{action.currentOwnerId ?? "—"}</Row>
          <Row label="Resultado">{action.result ?? "—"}</Row>
          <Row label="Motivo">{action.reason ?? "—"}</Row>
        </dl>

        {action.snapshot ? (
          <div className="mt-4 rounded-xl border border-[color:var(--border)] p-3 text-xs">
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Mensagem oficial utilizada (snapshot — não conta como ação)
            </p>
            <p className="mt-1">
              {action.snapshot.libraryCode ?? "—"}
              {action.snapshot.libraryVersion ? ` · v${action.snapshot.libraryVersion}` : ""}
              {action.snapshot.simulated ? " · simulada" : ""}
            </p>
            {action.snapshot.body ? (
              <pre className="mt-2 whitespace-pre-wrap text-[11px]">{action.snapshot.body}</pre>
            ) : null}
            {action.snapshot.contentUrl ? (
              <a href={action.snapshot.contentUrl} className="mt-2 inline-block underline" target="_blank" rel="noreferrer">
                conteúdo vinculado
              </a>
            ) : null}
          </div>
        ) : null}

        {href ? (
          <a
            href={href}
            className="mt-4 inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px]"
          >
            Abrir ficha do investidor <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[color:var(--muted-foreground)]">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
