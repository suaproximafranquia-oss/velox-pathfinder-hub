import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronRight,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  canManageUsers,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import {
  AUDIT_MODULE_LABEL,
  AUDIT_SEVERITY_LABEL,
  distinctActors,
  formatAuditTime,
  listAudit,
  seedAuditIfEmpty,
  type AuditEntry,
  type AuditModule,
  type AuditSeverity,
} from "@/lib/audit-log";
import { cn } from "@/lib/utils";
import { onSync } from "@/lib/sync-bus";

export const Route = createFileRoute("/executivo/auditoria")({
  head: () => ({
    meta: [
      { title: "Central de Auditoria — Atlas Platform" },
      {
        name: "description",
        content:
          "Registro completo de ações administrativas da Atlas Platform, com filtros, pesquisa e retenção permanente.",
      },
      { property: "og:title", content: "Central de Auditoria — Atlas Platform" },
      {
        property: "og:description",
        content:
          "Registro completo de ações administrativas da Atlas Platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

const MODULES: (AuditModule | "all")[] = [
  "all",
  "usuarios",
  "kpi",
  "investidores",
  "conhecimento",
  "sistema",
];
const SEVERITIES: (AuditSeverity | "all")[] = ["all", "info", "success", "warning", "critical"];

function SeverityBadge({ level }: { level: AuditSeverity }) {
  const map: Record<AuditSeverity, { className: string; icon: typeof Info }> = {
    info: { className: "bg-sky-400/10 text-sky-300 border-sky-400/20", icon: Info },
    success: { className: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20", icon: CheckCircle2 },
    warning: { className: "bg-amber-400/10 text-amber-300 border-amber-400/20", icon: AlertTriangle },
    critical: { className: "bg-rose-400/10 text-rose-300 border-rose-400/20", icon: AlertTriangle },
  };
  const { className, icon: Icon } = map[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
        className,
      )}
    >
      <Icon className="h-3 w-3" /> {AUDIT_SEVERITY_LABEL[level]}
    </span>
  );
}

function AuditPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState<AuditModule | "all">("all");
  const [actor, setActor] = useState<string>("all");
  const [severity, setSeverity] = useState<AuditSeverity | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (!s || !canManageUsers(s.activeRole)) {
      navigate({ to: "/executivo" });
      return;
    }
    seedAuditIfEmpty();
    setSession(s);
  }, [navigate]);

  // Log permanente: novas entradas aparecem sem recarregar a página.
  useEffect(() => onSync(() => setRefresh((v) => v + 1), ["audit"]), []);

  const actors = useMemo(() => distinctActors(), [refresh]);
  const entries = useMemo<AuditEntry[]>(
    () => listAudit({ query, module, actorId: actor, severity }),
    [query, module, actor, severity, refresh],
  );

  if (!session) return null;

  const total = entries.length;
  const bySeverity = entries.reduce<Record<AuditSeverity, number>>(
    (acc, e) => {
      acc[e.severity] = (acc[e.severity] ?? 0) + 1;
      return acc;
    },
    { info: 0, success: 0, warning: 0, critical: 0 },
  );

  return (
    <ExecutiveShell session={session} title="Central de Auditoria">
      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Eventos exibidos" value={total.toString()} icon={ShieldCheck} highlight />
        <StatCard label="Concluídos" value={bySeverity.success.toString()} icon={CheckCircle2} />
        <StatCard label="Atenção" value={bySeverity.warning.toString()} icon={AlertTriangle} />
        <StatCard label="Críticos" value={bySeverity.critical.toString()} icon={AlertTriangle} />
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-4 mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-1.5 text-xs w-full lg:w-80">
          <Search className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por ação, alvo ou detalhe…"
            className="flex-1 bg-transparent outline-none text-[color:var(--foreground)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            icon={Filter}
            value={module}
            onChange={(v) => setModule(v as AuditModule | "all")}
            options={MODULES.map((m) => ({
              value: m,
              label: m === "all" ? "Todos os módulos" : AUDIT_MODULE_LABEL[m],
            }))}
          />
          <FilterSelect
            icon={UserIcon}
            value={actor}
            onChange={setActor}
            options={[{ value: "all", label: "Todos os autores" }, ...actors.map((a) => ({ value: a.id, label: a.name }))]}
          />
          <FilterSelect
            icon={AlertTriangle}
            value={severity}
            onChange={(v) => setSeverity(v as AuditSeverity | "all")}
            options={SEVERITIES.map((s) => ({
              value: s,
              label: s === "all" ? "Todas as severidades" : AUDIT_SEVERITY_LABEL[s],
            }))}
          />
          <button
            type="button"
            onClick={() => setRefresh((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
          >
            <Clock className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 overflow-hidden">
        <div>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "3%" }} />
            </colgroup>
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                <th className="text-left px-3 py-3 font-normal">Quando</th>
                <th className="text-left px-3 py-3 font-normal">Autor</th>
                <th className="text-left px-3 py-3 font-normal">Módulo</th>
                <th className="text-left px-3 py-3 font-normal">Ação</th>
                <th className="text-left px-3 py-3 font-normal">Alvo</th>
                <th className="text-left px-3 py-3 font-normal">Severidade</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-[color:var(--muted-foreground)]">
                    Nenhum registro corresponde aos filtros aplicados.
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const open = expanded === e.id;
                  return (
                    <Fragment key={e.id}>
                      <tr
                        onClick={() => setExpanded(open ? null : e.id)}
                        className="border-t border-[color:var(--border)]/60 hover:bg-[color:var(--accent)]/30 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-3 text-[color:var(--muted-foreground)] tabular-nums align-top">
                          {formatAuditTime(e.timestamp)}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col leading-tight">
                            <span className="text-[color:var(--foreground)]">{e.actorName}</span>
                            <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                              {e.actorRole}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                            {AUDIT_MODULE_LABEL[e.module]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[color:var(--foreground)] align-top break-words">{e.action}</td>
                        <td className="px-3 py-3 text-[color:var(--muted-foreground)] align-top break-words">{e.target ?? "—"}</td>
                        <td className="px-3 py-3 align-top"><SeverityBadge level={e.severity} /></td>
                        <td className="px-2 py-3 text-[color:var(--muted-foreground)] align-top">
                          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-[color:var(--background)]/40">
                          <td colSpan={7} className="px-5 py-4 text-xs text-[color:var(--muted-foreground)] leading-relaxed">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em]">Identificador</p>
                                <p className="font-mono text-[color:var(--foreground)]/80 text-[11px] mt-1">{e.id}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em]">Detalhes</p>
                                <p className="text-[color:var(--foreground)]/90 mt-1">{e.details ?? "Sem detalhes adicionais."}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy-deep)]/40 p-5 flex items-start gap-3">
        <Info className="h-4 w-4 text-[color:var(--gold)] mt-0.5 flex-shrink-0" />
        <div className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
          Os registros de auditoria têm <strong className="text-[color:var(--foreground)]">retenção permanente</strong> e são
          append-only. Ações automáticas são atribuídas ao usuário <strong className="text-[color:var(--foreground)]">Sistema</strong>.
          A arquitetura está preparada para exportações e dashboards em Sprints futuros.
        </div>
      </div>
    </ExecutiveShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        highlight
          ? "border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--accent)] to-transparent"
          : "border-[color:var(--border)] bg-[color:var(--card)]/30",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">{label}</p>
        <Icon className="h-4 w-4 text-[color:var(--gold)]" strokeWidth={1.6} />
      </div>
      <p className="font-display text-2xl mt-3 tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: typeof Filter;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none text-[color:var(--foreground)] pr-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[color:var(--navy)]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}