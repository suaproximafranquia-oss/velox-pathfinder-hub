/**
 * HOMOLOGAÇÃO DO MOTOR DE RELACIONAMENTO (COMANDO 3A).
 *
 * Duas responsabilidades permanentes: manter a biblioteca de conteúdos
 * de valor e executar o simulador bilateral com leads fictícios
 * TEST-XXXX. Nada aqui envia mensagem real nem toca o Portal dos Leads.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlaskConical,
  Library,
  Loader2,
  MessagesSquare,
  Play,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  ensureCloudSession,
  getSession,
  loadUsers,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import {
  contentLibraryGaps,
  contentLibraryStats,
  type ValueContent,
} from "@/lib/relationship/content";
import {
  HomologationCrm,
  type HomologationConversation,
} from "@/components/executive/homologation-crm";
import { SCENARIOS } from "@/lib/relationship/simulation";
import {
  listRelationshipContents,
  listRelationshipRuns,
  readRelationshipRun,
  runRelationshipHomologation,
  resetHomologationWorkspace,
} from "@/lib/relationship-homologation.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/homologacao")({
  head: () => ({
    meta: [
      { title: "Homologação do Motor de Relacionamento — Atlas Platform" },
      {
        name: "description",
        content:
          "Biblioteca de conteúdos de valor e simulador bilateral com leads fictícios para validar o motor antes da produção.",
      },
      { property: "og:title", content: "Homologação do Motor — Atlas Platform" },
      {
        property: "og:description",
        content: "Rodadas de simulação auditáveis do motor de relacionamento, sem disparos reais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomologacaoPage,
});

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";
const gold =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-2 text-xs text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40";
const ghost =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition disabled:opacity-40";
const field =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50";

type RunSummary = Awaited<ReturnType<typeof listRelationshipRuns>>[number];

/** COMANDO 3C §3/§5 — execução real da rodada (não a data simulada). */
type RunExecution = {
  runId?: string;
  timezone?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  seed?: number;
  contentsSent?: number;
};

/** COMANDO 3C §12 — conteúdo selecionado por lead e etapa. */
type RunSelection = {
  leadId: string;
  step: string | null;
  contentId: string | null;
  contentName: string;
  contentUrl: string | null;
  contentGroup: string | null;
  simulatedAt: string;
};

const TZ = "America/Sao_Paulo";

function formatRunMoment(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

function HomologacaoPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [contents, setContents] = useState<ValueContent[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [conversations, setConversations] = useState<HomologationConversation[]>([]);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [execution, setExecution] = useState<RunExecution | null>(null);
  const [selections, setSelections] = useState<RunSelection[]>([]);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executiveName, setExecutiveName] = useState("Thiago Rodrigues");
  const [portalLink, setPortalLink] = useState(
    "https://portal.velox.com.br/f/thiago-rodrigues",
  );

  useEffect(() => {
    setSession(getSession());
  }, []);

  const load = useCallback(async () => {
    try {
      await ensureCloudSession();
      const [list, history] = await Promise.all([
        listRelationshipContents(),
        listRelationshipRuns(),
      ]);
      setContents(list);
      setRuns(history);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a homologação.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gaps = contentLibraryGaps(contents);
  const stats = contentLibraryStats(contents);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      await ensureCloudSession();
      await runRelationshipHomologation({
        data: {
          executiveName,
          portalLink,
          totalLeads: 300,
          userName: session?.name ?? "Gestão",
        },
      });
      setRuns(await listRelationshipRuns());
    } catch (e) {
      setError(e instanceof Error ? e.message : "A rodada não pôde ser concluída.");
    } finally {
      setRunning(false);
    }
  }

  async function handleOpenRun(runId: string) {
    setLoadingRun(true);
    try {
      await ensureCloudSession();
      const row = (await readRelationshipRun({ data: { runId } })) as
        | {
            report?: {
              conversations?: HomologationConversation[];
              totals?: Record<string, number>;
              execution?: RunExecution;
              selections?: RunSelection[];
            };
          }
        | null;
      setConversations(row?.report?.conversations ?? []);
      setTotals(row?.report?.totals ?? null);
      setExecution(row?.report?.execution ?? null);
      setSelections(row?.report?.selections ?? []);
      setOpenRun(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a rodada.");
    } finally {
      setLoadingRun(false);
    }
  }

  const last = runs[0] ?? null;

  /* RESET CONTROLADO DO WORKSPACE (COMANDO 3D §1–§5, §29–§31). */
  type ResetReport = {
    executed: boolean;
    blocked: boolean;
    blockReason: string | null;
    totalDeleted?: number;
    candidates: {
      leads: { id: string; name: string }[];
      protectedLeads: number;
      messages: number;
      timelineNoise: number;
      journeyEvents: number;
      engagement: number;
      homologationRows: number;
    };
  };
  const [resetReport, setResetReport] = useState<ResetReport | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  async function handleReset(dryRun: boolean) {
    setResetBusy(true);
    setError(null);
    try {
      await ensureCloudSession();
      const report = (await resetHomologationWorkspace({ data: { dryRun } })) as ResetReport;
      setResetReport(report);
      if (report.executed) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "O reset não pôde ser concluído.");
    } finally {
      setResetBusy(false);
    }
  }

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Homologação do Motor">
      <div className="space-y-6">
        <header className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg text-[color:var(--foreground)]">
                Homologação do Motor de Relacionamento
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted-foreground)]">
                Ambiente isolado com leads fictícios TEST-XXXX e relógio virtual. Nenhuma
                mensagem real é enviada e nenhum dado do Portal dos Leads é alterado.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Disparo real bloqueado
            </span>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="whitespace-pre-line">{error}</p>
          </div>
        ) : null}

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Library className="h-4 w-4 text-[color:var(--gold)]" />
              <h2 className="text-sm text-[color:var(--foreground)]">
                Biblioteca de Conteúdos
              </h2>
            </div>
            <Link to="/executivo/biblioteca" className={ghost}>
              Gerenciar biblioteca
            </Link>
          </div>

          <p className="mb-3 text-xs text-[color:var(--muted-foreground)]">
            A biblioteca é permanente e única: a homologação usa exatamente o mesmo acervo da
            operação real. Cadastros e alterações acontecem na tela Biblioteca de Conteúdos.
          </p>

          {gaps.length > 0 ? (
            <ul className="mb-4 space-y-1 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 p-3 text-[11px] text-[color:var(--gold)]">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.byGroup.map((g) => (
              <div
                key={g.group}
                className="rounded-xl border border-[color:var(--border)] px-3 py-2 text-xs"
              >
                <p className="text-[color:var(--foreground)]">
                  {g.group}
                  {g.required ? " · obrigatório" : ""}
                </p>
                <p className="mt-1 text-[color:var(--muted-foreground)]">
                  {g.active} ativo(s) de {g.total} cadastrado(s)
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm text-[color:var(--foreground)]">
                Reset controlado do Workspace de homologação
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
                Remove apenas leads, conversas e eventos fictícios de teste. Portal dos Leads,
                GreenSales, usuários, templates e a Biblioteca de Conteúdos permanecem intocados.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={ghost}
                onClick={() => void handleReset(true)}
                disabled={resetBusy}
              >
                Validar escopo
              </button>
              <button
                className={gold}
                onClick={() => void handleReset(false)}
                disabled={resetBusy || !resetReport || resetReport.blocked}
                title={
                  resetReport ? "Executa a limpeza validada" : "Valide o escopo antes de executar"
                }
              >
                Executar reset
              </button>
            </div>
          </div>
          {resetReport ? (
            <div className="space-y-2 rounded-xl border border-[color:var(--border)] p-3 text-xs text-[color:var(--muted-foreground)]">
              {resetReport.blocked ? (
                <p className="text-red-400">{resetReport.blockReason}</p>
              ) : null}
              <p className="text-[color:var(--foreground)]">
                {resetReport.executed
                  ? `Reset concluído — ${resetReport.totalDeleted ?? 0} registro(s) removido(s).`
                  : "Pré-visualização (nada foi apagado)."}
              </p>
              <p>
                Leads fictícios: {resetReport.candidates.leads.length} · Preservados:{" "}
                {resetReport.candidates.protectedLeads} · Mensagens:{" "}
                {resetReport.candidates.messages} · Ruído de auditoria:{" "}
                {resetReport.candidates.timelineNoise} · Jornada:{" "}
                {resetReport.candidates.journeyEvents} · Engajamento:{" "}
                {resetReport.candidates.engagement} · Motor (homologação):{" "}
                {resetReport.candidates.homologationRows}
              </p>
              <p className="text-emerald-400">
                Portal dos Leads e GreenSales elegíveis: 0 (proteção absoluta).
              </p>
            </div>
          ) : null}
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm text-[color:var(--foreground)]">Simulador bilateral</h2>
            <button className={gold} onClick={() => void handleRun()} disabled={running}>
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Executando rodada…" : "Executar rodada com 300 leads"}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className={field}
              value={executiveName}
              onChange={(e) => setExecutiveName(e.target.value)}
              placeholder="Nome do Executivo simulado"
            />
            <input
              className={field}
              value={portalLink}
              onChange={(e) => setPortalLink(e.target.value)}
              placeholder="Link do Portal do Investidor"
            />
          </div>

          {last ? (
            <div className="mt-5 space-y-3">
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  { label: "Leads simulados", value: last.totalLeads },
                  { label: "Conformes", value: last.passed },
                  { label: "Divergentes", value: last.failed },
                  { label: "Mensagens", value: last.messages },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl border border-[color:var(--border)] p-3"
                  >
                    <p className="text-[11px] text-[color:var(--muted-foreground)]">{k.label}</p>
                    <p className="text-lg text-[color:var(--foreground)]">{k.value}</p>
                  </div>
                ))}
              </div>
              <table className="w-full text-left text-xs">
                <thead className="text-[color:var(--muted-foreground)]">
                  <tr>
                    <th className="py-1">Cenário</th>
                    <th>Comportamento</th>
                    <th>Esperado</th>
                    <th className="text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {last.scenarios.map((s) => (
                    <tr key={s.scenario} className="border-t border-[color:var(--border)]/60">
                      <td className="py-1.5 text-[color:var(--gold)]">{s.scenario}</td>
                      <td className="text-[color:var(--foreground)]">{s.label}</td>
                      <td className="text-[color:var(--muted-foreground)]">
                        {s.expectedSteps.join(" → ") || "—"}
                      </td>
                      <td
                        className={cn(
                          "text-right",
                          s.failed === 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {s.passed}/{s.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">
              Nenhuma rodada executada ainda. Os {Object.keys(SCENARIOS).length} cenários
              previstos serão validados na primeira execução.
            </p>
          )}
        </section>

        {runs.length > 0 ? (
          <section className={card}>
            <h2 className="mb-3 text-sm text-[color:var(--foreground)]">Histórico de rodadas</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="text-[color:var(--muted-foreground)]">
                  <tr>
                    <th className="py-1">Rodada</th>
                    <th>Data e hora da execução</th>
                    <th>Duração</th>
                    <th className="text-right">Leads</th>
                    <th className="text-right">Mensagens</th>
                    <th className="text-right">Conteúdos</th>
                    <th>Status</th>
                    <th className="text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.runId} className="border-t border-[color:var(--border)]/60">
                      <td className="py-2 text-[color:var(--gold)]">{r.runId}</td>
                      <td className="text-[color:var(--foreground)]">
                        {formatRunMoment(r.finishedAt ?? r.createdAt)}{" "}
                        <span className="text-[10px] text-[color:var(--muted-foreground)]">
                          {r.timezone}
                        </span>
                      </td>
                      <td className="text-[color:var(--muted-foreground)]">
                        {formatDuration(r.durationMs)}
                      </td>
                      <td className="text-right">{r.totalLeads}</td>
                      <td className="text-right">{r.messages}</td>
                      <td className="text-right">{r.contents}</td>
                      <td className={cn(r.failed === 0 ? "text-emerald-400" : "text-red-400")}>
                        {r.failed === 0 ? "Concluída" : `Divergências (${r.failed})`}
                      </td>
                      <td className="text-right">
                        <button
                          className={ghost}
                          disabled={loadingRun}
                          onClick={() => void handleOpenRun(r.runId)}
                        >
                          <MessagesSquare className="h-3.5 w-3.5" /> Ver detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {openRun ? (
          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm text-[color:var(--foreground)]">
                CRM de homologação — {openRun}
              </h2>
              <span className="text-[11px] text-emerald-400">
                Chamadas à Meta nesta rodada: {totals?.["metaCalls"] ?? 0}
              </span>
            </div>
            {execution ? (
              <p className="mb-3 rounded-xl border border-[color:var(--border)] px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]">
                Execução real: início {formatRunMoment(execution.startedAt)} · conclusão{" "}
                {formatRunMoment(execution.finishedAt)} · duração{" "}
                {formatDuration(execution.durationMs)} ·{" "}
                {execution.timezone ?? TZ} · semente {execution.seed ?? "—"}. As datas exibidas
                dentro das conversas são <strong>datas simuladas</strong> do cenário.
              </p>
            ) : null}
            {totals ? (
              <div className="mb-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {[
                  ["Leads", totals["leads"]],
                  ["Mensagens", totals["messages"]],
                  ["Conteúdos", totals["contents"]],
                  ["Visualizações", totals["reads"]],
                  ["Respostas", totals["responses"]],
                  ["Agendamentos", totals["scheduled"]],
                  ["Bloqueios", totals["blocked"]],
                  ["Divergências", totals["divergences"]],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[color:var(--border)] p-2"
                  >
                    <p className="text-[10px] text-[color:var(--muted-foreground)]">{label}</p>
                    <p className="text-sm text-[color:var(--foreground)]">{value ?? 0}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <HomologationCrm
              conversations={conversations}
              executive={{ name: session.name, photoUrl: loadUsers().find((u) => u.id === session.userId)?.photoUrl ?? null }}
            />

            {selections.length > 0 ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm text-[color:var(--foreground)]">
                  Conteúdo selecionado por lead e etapa
                </h3>
                <p className="mb-2 text-[11px] text-[color:var(--muted-foreground)]">
                  {selections.length} seleção(ões) nesta rodada. Exibindo as 200 primeiras —
                  permite conferir a alternância real de E1, E3, R1 e R2.
                </p>
                <div className="max-h-[420px] overflow-auto rounded-xl border border-[color:var(--border)]">
                  <table className="w-full min-w-[860px] text-left text-[11px]">
                    <thead className="sticky top-0 bg-[color:var(--card)] text-[color:var(--muted-foreground)]">
                      <tr>
                        <th className="px-2 py-1.5">Lead</th>
                        <th>Etapa</th>
                        <th>Conteúdo</th>
                        <th>ID</th>
                        <th>Grupo</th>
                        <th>URL</th>
                        <th>Data simulada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selections.slice(0, 200).map((s, i) => (
                        <tr
                          key={`${s.leadId}-${s.step}-${i}`}
                          className="border-t border-[color:var(--border)]/60"
                        >
                          <td className="px-2 py-1.5 text-[color:var(--foreground)]">
                            {s.leadId}
                          </td>
                          <td className="text-[color:var(--gold)]">{s.step ?? "—"}</td>
                          <td className="text-[color:var(--foreground)]">{s.contentName}</td>
                          <td className="text-[color:var(--muted-foreground)]">
                            {s.contentId ?? "—"}
                          </td>
                          <td className="text-[color:var(--muted-foreground)]">
                            {s.contentGroup ?? "—"}
                          </td>
                          <td className="max-w-[220px] truncate">
                            {s.contentUrl ? (
                              <a
                                href={s.contentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[color:var(--gold)] underline-offset-2 hover:underline"
                              >
                                Abrir
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-[color:var(--muted-foreground)]">
                            {formatRunMoment(s.simulatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </ExecutiveShell>
  );
}
