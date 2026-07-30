/**
 * Painel de Campanhas — módulo exclusivo dos indicadores de campanhas
 * comerciais. Todos os indicadores de campanha saíram do KPI Manager,
 * que passa a responder apenas pelos indicadores operacionais.
 *
 * A fonte de dados continua sendo o KPI Manager (loadDataset/summarize).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { visibleCollaborators } from "@/lib/teams";
import {
  AVAILABLE_MONTHS,
  DEFAULT_MONTH_KEY,
  loadDataset,
  summarize,
} from "@/lib/kpi-manager";
import { CampanhaVeloxCard } from "@/components/executive/kpi/campanha-velox";
import { PainelCampanhas } from "@/components/executive/kpi/painel-campanhas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/campanhas")({
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
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  const collaborators = useMemo(
    () => (session ? visibleCollaborators(session) : []),
    [session],
  );

  const personalSales = useMemo(() => {
    if (!session) return 0;
    return summarize(loadDataset(session.userId, monthKey)).salesValue;
  }, [session, monthKey]);

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

      <CampanhaVeloxCard salesValue={personalSales} />

      <div className="mt-8">
        <PainelCampanhas
          users={collaborators}
          monthKey={monthKey}
          onDownload={(userId) => {
            const user = collaborators.find((c) => c.id === userId);
            if (!user) return;
            // Motor de PDF carregado apenas no clique.
            void import("@/lib/kpi-report").then(({ generateKpiIndividualReport }) =>
              generateKpiIndividualReport(user, monthKey),
            );
          }}
        />
      </div>
    </ExecutiveShell>
  );
}
