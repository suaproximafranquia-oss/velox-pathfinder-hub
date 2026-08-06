import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronDown, Sparkles, UserSquare2 } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { buildOperationalSnapshot } from "@/lib/brain-data";
import { buildBrainAnalytics } from "@/lib/brain-analytics";
import {
  availableScopes,
  defaultScope,
  SCOPE_LABEL,
  type ScopeMode,
  type ScopeSelection,
} from "@/lib/brain/scopes";
import { AVAILABLE_MONTHS, DEFAULT_MONTH_KEY } from "@/lib/kpi-manager";
import { visibleCollaborators } from "@/lib/teams";
import { KpiCard } from "@/components/executive/brain/kpi-card";
import { FunnelCard } from "@/components/executive/brain/funnel-card";
import { ExecutiveAiDialog } from "@/components/executive/brain/executive-ai-dialog";
import {
  BlockTitle,
  ClosingSummary,
  ComparisonTable,
  ConversionGrid,
  ExecutiveIntro,
  InsightList,
} from "@/components/executive/brain/analytics-blocks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/brain")({
  head: () => ({
    meta: [
      { title: "Brain Analytics — Atlas Platform" },
      {
        name: "description",
        content:
          "Painel executivo com indicadores principais, funil operacional e alertas do KPI Manager.",
      },
      { property: "og:title", content: "Brain Analytics — Atlas Platform" },
      {
        property: "og:description",
        content:
          "Painel executivo com indicadores principais, funil operacional e alertas do KPI Manager.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrainPage,
});

function BrainPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [monthKey, setMonthKey] = useState(DEFAULT_MONTH_KEY);
  const [scope, setScope] = useState<ScopeSelection | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
    setScope(defaultScope(s.activeRole, s.userId));
  }, [navigate]);

  const snapshot = useMemo(
    () => (session && scope ? buildOperationalSnapshot(session, scope, monthKey) : null),
    [session, scope, monthKey],
  );

  const analytics = useMemo(
    () => (session && scope ? buildBrainAnalytics(session, scope, monthKey) : null),
    [session, scope, monthKey],
  );

  if (!session || !scope || !snapshot || !analytics) return null;

  const scopes = availableScopes(session.activeRole);
  const executives = visibleCollaborators(session);
  // IA Executiva: exclusiva de Administrador e Gestora.
  const canUseExecutiveAi =
    session.activeRole === "super_admin" || session.activeRole === "diretora";

  function chooseScope(mode: ScopeMode) {
    if (!session) return;
    if (mode === "executive") {
      setScope({ mode, executiveId: executives[0]?.id ?? session.userId });
      return;
    }
    setScope({ mode });
  }

  return (
    <ExecutiveShell session={session} title="Brain Analytics">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {scopes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => chooseScope(m)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                scope.mode === m
                  ? "border-[color:var(--gold)]/40 bg-[color:var(--accent)] text-[color:var(--foreground)]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              )}
            >
              {SCOPE_LABEL[m]}
            </button>
          ))}
          {scope.mode === "executive" && (
            <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-1.5 text-xs">
              <UserSquare2 className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
              <select
                value={scope.executiveId ?? session.userId}
                onChange={(e) => setScope({ mode: "executive", executiveId: e.target.value })}
                className="bg-transparent outline-none text-[color:var(--foreground)]"
              >
                {executives.map((e) => (
                  <option key={e.id} value={e.id} className="bg-[color:var(--navy)]">
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUseExecutiveAi ? (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--accent)] px-3 py-1.5 text-xs text-[color:var(--foreground)] transition hover:border-[color:var(--gold)]/70"
            >
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              IA Executiva
            </button>
          ) : null}
          <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-1.5 text-xs">
          <CalendarRange className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          <select
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="bg-transparent outline-none text-[color:var(--foreground)]"
          >
            {AVAILABLE_MONTHS.map((m) => (
              <option key={m.key} value={m.key} className="bg-[color:var(--navy)]">
                {m.label}
              </option>
            ))}
          </select>
          </label>
        </div>
      </div>

      {canUseExecutiveAi ? (
        <ExecutiveAiDialog
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          analytics={analytics}
          snapshot={snapshot}
          actorName={session.name}
        />
      ) : null}

      <ScopeBreadcrumb mode={scope.mode} />

      <div className="space-y-10">
        <ExecutiveIntro
          subject={analytics.subjectLabel}
          monthLabel={analytics.monthLabel}
          headline={analytics.headline}
        />

        <section>
          <BlockTitle
            eyebrow="Indicadores consolidados"
            title="Principais indicadores do período"
            description="Números oficiais do KPI Manager para o escopo e a competência selecionados."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 items-start">
            {snapshot.kpis.map((k) => (
              <KpiCard key={k.id} kpi={k} />
            ))}
          </div>
        </section>

        <section>
          <BlockTitle
            eyebrow="Funil e conversões"
            title="Esteira comercial ponta a ponta"
            description="Funil visual do Lead ao faturamento, com a conversão real entre cada estágio."
          />
          <div className="space-y-4">
            <FunnelCard stages={snapshot.funnel} />
            <ConversionGrid items={analytics.conversions} />
          </div>
        </section>

        <section>
          <BlockTitle
            eyebrow="Comparativos e tendências"
            title="Competência atual frente à referência"
            description="Cada indicador lido em três referências: competência atual, mês anterior e média anual."
          />
          <ComparisonTable report={analytics.comparison} />
        </section>

        <section>
          <BlockTitle
            eyebrow="Insights automáticos"
            title="Análises geradas a partir dos dados"
            description="Leituras objetivas sobre eficiência, conversão e acompanhamento da carteira."
          />
          <InsightList insights={analytics.insights} />
        </section>

        <ClosingSummary text={analytics.closing} />

        <p className="text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
          O Brain Analytics é o painel executivo definitivo: leitura estratégica sobre os
          dados oficiais do KPI Manager, sem repetição de indicadores. Os alertas
          operacionais ficam concentrados na Central de Alertas, disponível em qualquer
          tela do workspace.
        </p>
      </div>
    </ExecutiveShell>
  );
}

function ScopeBreadcrumb({ mode }: { mode: ScopeMode }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
      <span>Escopo</span>
      <ChevronDown className="h-3 w-3 -rotate-90" />
      <span className="text-[color:var(--gold)]">{SCOPE_LABEL[mode]}</span>
    </div>
  );
}
