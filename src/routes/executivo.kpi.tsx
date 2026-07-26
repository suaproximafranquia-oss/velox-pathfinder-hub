import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Database,
  Gauge,
  LineChart,
  Sparkles,
  Users,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  buildMonthHistory,
  monthKey,
  useKpiContext,
  type KpiMonth,
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
  const months = useMemo(() => buildMonthHistory(6), []);
  const collaborators = useMemo(
    () => visibleCollaborators(session),
    [session],
  );
  const defaults = useMemo(
    () => ({
      monthKey: monthKey(months[0]),
      collaboratorId: collaborators[0]?.id ?? session.userId,
    }),
    [months, collaborators, session],
  );
  const { ctx, update } = useKpiContext(session, defaults);

  const activeMonth: KpiMonth = months.find((m) => monthKey(m) === ctx.monthKey) ?? months[0];
  const activeCollab =
    collaborators.find((c) => c.id === ctx.collaboratorId) ??
    collaborators[0];

  return (
    <ExecutiveShell session={session} title="KPI Manager">
      <div className="mb-4 flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
        <Gauge className="h-3.5 w-3.5 text-[color:var(--gold)]" />
        <span className="uppercase tracking-[0.22em]">
          Fonte oficial de indicadores · em preparacao
        </span>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="h-4 w-4 text-[color:var(--gold)]" />
          <h2 className="font-display text-lg">Periodo de referencia</h2>
        </div>
        <p className="text-xs text-[color:var(--muted-foreground)] mb-4">
          Cada mes possui contexto proprio e persistente. A selecao permanece
          ativa entre sessoes.
        </p>
        <div className="flex flex-wrap gap-2">
          {months.map((m) => {
            const key = monthKey(m);
            const active = key === ctx.monthKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => update({ monthKey: key })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  active
                    ? "border-[color:var(--gold)]/40 bg-[color:var(--accent)] text-[color:var(--foreground)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="font-display text-lg">Colaboradores</h2>
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            Visualizacao restrita ao escopo do perfil ativo. Cada colaborador
            tera seu proprio painel de indicadores.
          </p>
        </div>
        <div className="border-t border-[color:var(--border)] overflow-x-auto">
          <div className="flex min-w-max">
            {collaborators.map((c) => {
              const active = c.id === ctx.collaboratorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update({ collaboratorId: c.id })}
                  className={cn(
                    "px-5 py-3 text-sm border-r border-[color:var(--border)] transition whitespace-nowrap",
                    active
                      ? "bg-[color:var(--accent)] text-[color:var(--foreground)] border-b-2 border-b-[color:var(--gold)]"
                      : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] border-b-2 border-b-transparent",
                  )}
                >
                  {c.name}
                </button>
              );
            })}
            {collaborators.length === 0 && (
              <div className="px-5 py-3 text-sm text-[color:var(--muted-foreground)]">
                Nenhum colaborador visivel no escopo atual.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <PreparationCard
          icon={Database}
          title="Entrada oficial"
          description="Registro diario de atividades comerciais que alimentara o Brain, dashboards e relatorios."
        />
        <PreparationCard
          icon={LineChart}
          title="Comparacao consistente"
          description="Verificacao entre valores lancados e origens externas (CRM/Portal), destacando divergencias."
        />
        <PreparationCard
          icon={Sparkles}
          title="IA multi-fonte"
          description="Base para analises assistidas cruzando KPI, Brain e Base Oficial de Conhecimento."
        />
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/20 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Contexto ativo
        </p>
        <p className="font-display text-xl mt-2">
          {activeMonth.label}
          {activeCollab ? ` · ${activeCollab.name}` : ""}
        </p>
        <p className="mt-3 text-sm text-[color:var(--muted-foreground)] max-w-md mx-auto">
          Nesta etapa da fundacao o modulo permanece em preparacao. Os
          componentes de captura e consolidacao serao habilitados em breve.
        </p>
        <div className="mt-4 inline-flex items-center gap-1 text-[11px] text-[color:var(--gold)]">
          Aguarde a proxima sprint <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </ExecutiveShell>
  );
}

function PreparationCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Gauge;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </span>
      <h3 className="font-display text-base mt-3">{title}</h3>
      <p className="text-xs text-[color:var(--muted-foreground)] mt-1.5 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
