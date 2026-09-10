/**
 * Painel de Campanhas — módulo exclusivo dos indicadores de campanhas
 * comerciais. Todos os indicadores de campanha saíram do KPI Manager,
 * que passa a responder apenas pelos indicadores operacionais.
 *
 * A fonte de dados continua sendo o KPI Manager (kpi_entries/summarize).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import type { ExecutiveUser } from "@/lib/executive-auth";
import { lerVendasCampanhas, lerKpiMes } from "@/lib/kpi-data.functions";
import { datasetFromCells } from "@/lib/kpi-dataset";
import { toast } from "sonner";
import {
  AVAILABLE_MONTHS,
  DEFAULT_MONTH_KEY,
  type KpiDataset,
  summarize,
} from "@/lib/kpi-manager";
import { CampanhaVeloxCard } from "@/components/executive/kpi/campanha-velox";
import { PainelCampanhas } from "@/components/executive/kpi/painel-campanhas";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/f/executivo/campanhas")({
  head: () => ({
    meta: [
      { title: "Painel de Campanhas — Atlas Platform" },
      {
        name: "description",
        content:
          "Indicadores exclusivos das campanhas comerciais: progresso individual e ranking oficial da Campanha Velox.",
      },
      { property: "og:title", content: "Painel de Campanhas — Atlas Platform" },
      {
        property: "og:description",
        content: "Progresso e ranking das campanhas comerciais da equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [monthKey, setMonthKey] = useState(DEFAULT_MONTH_KEY);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/f/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  // DEF 2.4.9 §6 — o Painel de Campanhas é corporativo: Colaborador,
  // Gestor e Administrador enxergam exatamente o mesmo ranking. Nenhum
  // dado financeiro privado é exibido, apenas a posição na campanha.
  //
  // A situação ativo/inativo vem SEMPRE do servidor (diretório oficial),
  // nunca do cadastro guardado no navegador — assim todos os perfis veem
  // exatamente os mesmos integrantes ativos.
  const readSales = useServerFn(lerVendasCampanhas);
  const readMonth = useServerFn(lerKpiMes);
  const [official, setOfficial] = useState<{
    monthKey: string; team: ExecutiveUser[]; datasets: Record<string, KpiDataset>; readableReportIds: string[];
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoadError(false);
    void readSales({ data: { monthKey } }).then((payload) => {
      if (!alive) return;
      setOfficial({ monthKey, team: payload.team as ExecutiveUser[],
        datasets: Object.fromEntries(Object.entries(payload.datasets).map(([id, cells]) =>
          [id, datasetFromCells(id, monthKey, cells)])), readableReportIds: payload.readableReportIds });
    }).catch(() => { if (alive) { setOfficial(null); setLoadError(true); } });
    return () => { alive = false; };
  }, [readSales, monthKey, session]);
  const ready = official?.monthKey === monthKey;
  const collaborators = ready ? official.team : [];
  const personalSales = useMemo(() => {
    const ds = session && ready ? official.datasets[session.userId] : null;
    return ds ? summarize(ds).salesValue : 0;
  }, [session, official, ready]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Painel de Campanhas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-xl">Campanhas comerciais</h1>
            <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
              Indicadores exclusivos de campanha, alimentados automaticamente pelos
              lançamentos do KPI Manager.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 p-0.5">
          {AVAILABLE_MONTHS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMonthKey(m.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] transition",
                m.key === monthKey
                  ? "bg-[color:var(--gold)] text-[color:var(--navy-deep)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!ready ? <p role="status">{loadError ? "Não foi possível carregar os lançamentos oficiais." : "Carregando lançamentos oficiais…"}</p> : <>
      <CampanhaVeloxCard salesValue={personalSales} />

      <div className="mt-8">
        <PainelCampanhas
          users={collaborators}
          monthKey={monthKey}
          datasets={official.datasets}
          onDownload={(userId) => {
            const user = collaborators.find((c) => c.id === userId);
            if (!user) return;
            if (!official.readableReportIds.includes(userId)) {
              toast.error("Relatório individual fora do seu escopo autorizado.");
              return;
            }
            void Promise.all([import("@/lib/kpi-report"), readMonth({ data: { executiveId: userId, monthKey } })])
              .then(([{ generateKpiIndividualReport }, payload]) =>
                generateKpiIndividualReport(user, monthKey, datasetFromCells(userId, monthKey, payload)))
              .catch(() => toast.error("Não foi possível carregar o relatório oficial."));
          }}
        />
      </div>
      </>}
    </ExecutiveShell>
  );
}
