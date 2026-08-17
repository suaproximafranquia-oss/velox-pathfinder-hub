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
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
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

function HomologacaoPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [contents, setContents] = useState<ValueContent[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [conversations, setConversations] = useState<HomologationConversation[]>([]);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
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
        | { report?: { conversations?: HomologationConversation[]; totals?: Record<string, number> } }
        | null;
      setConversations(row?.report?.conversations ?? []);
      setTotals(row?.report?.totals ?? null);
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
            <ul className="space-y-1 text-xs">
              {runs.map((r) => (
                <li
                  key={r.runId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] px-3 py-2"
                >
                  <span className="text-[color:var(--foreground)]">{r.label}</span>
                  <span className="flex items-center gap-3">
                    <span className={cn(r.failed === 0 ? "text-emerald-400" : "text-red-400")}>
                      {r.failed === 0 ? "TESTE FINALIZADO · " : ""}
                      {r.passed}/{r.totalLeads} conformes
                    </span>
                    <button
                      className={ghost}
                      disabled={loadingRun}
                      onClick={() => void handleOpenRun(r.runId)}
                    >
                      <MessagesSquare className="h-3.5 w-3.5" /> Abrir conversas
                    </button>
                  </span>
                </li>
              ))}
            </ul>
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
            <HomologationCrm conversations={conversations} />
          </section>
        ) : null}
      </div>
    </ExecutiveShell>
  );
}
