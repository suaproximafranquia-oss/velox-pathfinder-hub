/**
 * CARTEIRA DAS UNIDADES DO GRUPO — Velox Solar e Velox Seguros.
 *
 * Carteira SEPARADA da Financeira: nada aqui entra em `portal_leads`,
 * CRM, Ação do Dia ou cadência. O primeiro contato é humano, a situação
 * é registrada manualmente e todo movimento fica no histórico com autor
 * e data/hora.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, History, ShieldCheck, Sun, UserRound } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  atribuirResponsavelUnidade,
  atualizarContatoUnidade,
  historicoInteressadoUnidade,
  listarInteressadosUnidade,
} from "@/lib/group/unit-leads.functions";

export const Route = createFileRoute("/f/executivo/unidades")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Unidades do Grupo — interessados Solar e Seguros | Velox" },
      {
        name: "description",
        content:
          "Carteira dos interessados nas unidades Velox Solar e Velox Seguros, separada da operação da Financeira.",
      },
      { property: "og:title", content: "Unidades do Grupo — Velox" },
      {
        property: "og:description",
        content: "Interessados de Velox Solar e Velox Seguros em carteira própria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitLeadsPage,
});

type UnitKey = "financeira" | "solar" | "seguros";

type UnitLead = {
  id: string;
  unit: string;
  name: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  investment_range: string;
  origin: string | null;
  campaign: string | null;
  from_group: boolean | null;
  first_contact_status: string | null;
  first_contact_at: string | null;
  first_contact_by_name: string | null;
  contact_note: string | null;
  close_reason: string | null;
  responsible_executive_name: string | null;
  assigned_by_name: string | null;
  assigned_at: string | null;
  submissions: number | null;
  last_submitted_at: string | null;
  created_at: string;
};

type UnitEvent = {
  id: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  reason: string | null;
  actor_name: string | null;
  at: string;
};

const RANGE_LABEL: Record<string, string> = {
  "10_20": "R$ 10 mil a R$ 20 mil",
  "20_30": "R$ 20 mil a R$ 30 mil",
  acima_30: "Acima de R$ 30 mil",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando primeiro contato",
  em_contato: "Em contato",
  encerrado: "Encerrado",
};

const EVENT_LABEL: Record<string, string> = {
  registrado: "Interesse registrado",
  novo_envio: "Formulário reenviado pelo mesmo contato",
  situacao: "Situação alterada",
  responsavel: "Responsável",
};

const TABS: Array<{ key: UnitKey; label: string; icon: typeof Sun }> = [
  { key: "financeira", label: "Velox Soluções Financeiras", icon: Building2 },
  { key: "solar", label: "Velox Solar", icon: Sun },
  { key: "seguros", label: "Velox Seguros", icon: ShieldCheck },
];

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function UnitLeadsPage() {
  const list = useServerFn(listarInteressadosUnidade);
  const updateStatus = useServerFn(atualizarContatoUnidade);
  const assign = useServerFn(atribuirResponsavelUnidade);
  const readHistory = useServerFn(historicoInteressadoUnidade);

  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [unit, setUnit] = useState<UnitKey>("financeira");
  const [rows, setRows] = useState<UnitLead[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [rangeFilter, setRangeFilter] = useState<string>("todos");
  const [history, setHistory] = useState<Record<string, UnitEvent[]>>({});
  const [closing, setClosing] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(
    async (target: UnitKey) => {
      try {
        const result = (await list({ data: { unit: target } })) as UnitLead[];
        setRows(result);
        setAllowed(true);
      } catch (error) {
        setAllowed(false);
        toast.error(error instanceof Error ? error.message : "Falha ao carregar a carteira.");
      }
    },
    [list],
  );

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    void load(unit);
  }, [load, unit]);

  async function changeStatus(id: string, status: string, reason?: string) {
    try {
      await updateStatus({
        data: { id, status: status as "pendente", reason: reason ?? null },
      });
      setClosing(null);
      await load(unit);
      if (history[id]) await openHistory(id, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar.");
    }
  }

  async function setResponsible(id: string, name: string) {
    try {
      await assign({
        data: {
          id,
          executiveId: name.trim() ? name.trim().toLowerCase().replace(/\s+/g, "_") : null,
          executiveName: name.trim() || null,
        },
      });
      await load(unit);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atribuir responsável.");
    }
  }

  const openHistory = useCallback(
    async (id: string, force = false) => {
      if (history[id] && !force) {
        setHistory((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      try {
        const events = (await readHistory({ data: { id } })) as UnitEvent[];
        setHistory((prev) => ({ ...prev, [id]: events }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao ler o histórico.");
      }
    },
    [history, readHistory],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return rows.filter((row) => {
      if (statusFilter !== "todos" && (row.first_contact_status ?? "pendente") !== statusFilter) {
        return false;
      }
      if (rangeFilter !== "todos" && row.investment_range !== rangeFilter) return false;
      if (!term) return true;
      return (
        row.name.toLowerCase().includes(term) ||
        (row.email ?? "").toLowerCase().includes(term) ||
        (digits.length > 0 && row.whatsapp.replace(/\D/g, "").includes(digits))
      );
    });
  }, [rows, search, statusFilter, rangeFilter]);

  const counters = useMemo(() => {
    const total = rows.length;
    const pendentes = rows.filter((r) => (r.first_contact_status ?? "pendente") === "pendente").length;
    const emContato = rows.filter((r) => r.first_contact_status === "em_contato").length;
    const encerrados = rows.filter((r) => r.first_contact_status === "encerrado").length;
    return { total, pendentes, emContato, encerrados };
  }, [rows]);

  if (!session || allowed === null) {
    return (
      <ExecutiveShell session={session!} title="Unidades do Grupo">
        <p className="text-sm text-[color:var(--muted-foreground)]">Carregando carteira…</p>
      </ExecutiveShell>
    );
  }

  if (!allowed) {
    return (
      <ExecutiveShell session={session} title="Unidades do Grupo">
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="text-sm font-semibold">Área restrita</h2>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            A carteira das unidades do Grupo depende de permissão administrativa.
          </p>
        </div>
      </ExecutiveShell>
    );
  }

  return (
    <ExecutiveShell session={session} title="Unidades do Grupo">
      <div className="space-y-5">
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" aria-hidden />
            Carteira separada da Financeira
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            Estes interessados não entram no Portal dos Leads, no CRM, na Ação do Dia nem em
            qualquer cadência automática. O primeiro contato é feito por uma pessoa.
          </p>
        </div>

        <div className="flex gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = unit === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setUnit(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                  active
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10"
                    : "border-[color:var(--border)]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: counters.total },
            { label: "Sem contato", value: counters.pendentes },
            { label: "Em contato", value: counters.emContato },
            { label: "Encerrados", value: counters.encerrados },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou e-mail"
            className="min-w-[240px] flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
          >
            <option value="todos">Todas as situações</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm"
          >
            <option value="todos">Todas as faixas</option>
            {Object.entries(RANGE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted-foreground)]">
            Nenhum interessado nesta unidade com os filtros atuais.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{row.name}</p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {row.whatsapp}
                      {row.city ? ` · ${row.city}` : ""}
                      {row.email ? ` · ${row.email}` : ""}
                    </p>
                  </div>
                  <select
                    value={row.first_contact_status ?? "pendente"}
                    onChange={(e) => {
                      if (e.target.value === "encerrado") setClosing({ id: row.id, reason: "" });
                      else void changeStatus(row.id, e.target.value);
                    }}
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs"
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {closing?.id === row.id ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-[color:var(--border)] p-3">
                    <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                      Motivo do encerramento (obrigatório)
                    </label>
                    <input
                      value={closing.reason}
                      onChange={(e) => setClosing({ id: row.id, reason: e.target.value })}
                      className="w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs"
                      placeholder="Ex.: sem interesse no momento"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void changeStatus(row.id, "encerrado", closing.reason)}
                        className="rounded border border-[color:var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]"
                      >
                        Confirmar encerramento
                      </button>
                      <button
                        type="button"
                        onClick={() => setClosing(null)}
                        className="rounded border border-[color:var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                  <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                    {RANGE_LABEL[row.investment_range] ?? row.investment_range}
                  </span>
                  {row.from_group ? (
                    <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                      Veio do Grupo Velox
                    </span>
                  ) : null}
                  {row.origin ? (
                    <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                      {row.origin}
                    </span>
                  ) : null}
                  {row.campaign ? (
                    <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                      Campanha: {row.campaign}
                    </span>
                  ) : null}
                  {(row.submissions ?? 1) > 1 ? (
                    <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                      {row.submissions} envios · último em{" "}
                      {row.last_submitted_at ? dateLabel(row.last_submitted_at) : "—"}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                    Registrado em {dateLabel(row.created_at)}
                  </span>
                </div>

                <div className="mt-3 grid gap-1 text-[11px] text-[color:var(--muted-foreground)]">
                  {row.first_contact_by_name ? (
                    <span>
                      Primeiro contato por {row.first_contact_by_name}
                      {row.first_contact_at ? ` em ${dateLabel(row.first_contact_at)}` : ""}
                    </span>
                  ) : (
                    <span>Nenhum contato registrado até aqui.</span>
                  )}
                  {row.close_reason ? <span>Motivo do encerramento: {row.close_reason}</span> : null}
                  {row.responsible_executive_name ? (
                    <span>
                      Responsável: {row.responsible_executive_name}
                      {row.assigned_by_name ? ` (atribuído por ${row.assigned_by_name})` : ""}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                    Responsável
                    <input
                      defaultValue={row.responsible_executive_name ?? ""}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== (row.responsible_executive_name ?? "")) {
                          void setResponsible(row.id, e.target.value);
                        }
                      }}
                      placeholder="Nome do responsável"
                      className="rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-[11px]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void openHistory(row.id)}
                    className="inline-flex items-center gap-1.5 rounded border border-[color:var(--border)] px-2 py-1 text-[11px]"
                  >
                    <History className="h-3.5 w-3.5" aria-hidden />
                    Histórico
                  </button>
                </div>

                {history[row.id] ? (
                  <ul className="mt-3 space-y-2">
                    {history[row.id]!.map((event) => (
                      <li
                        key={event.id}
                        className="rounded border border-[color:var(--border)] px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]"
                      >
                        <span className="text-[color:var(--foreground)]">
                          {EVENT_LABEL[event.kind] ?? event.kind}
                        </span>{" "}
                        · {dateLabel(event.at)} · {event.actor_name ?? "—"}
                        {event.from_status || event.to_status ? (
                          <span>
                            {" "}
                            · {STATUS_LABEL[event.from_status ?? ""] ?? event.from_status ?? "—"} →{" "}
                            {STATUS_LABEL[event.to_status ?? ""] ?? event.to_status ?? "—"}
                          </span>
                        ) : null}
                        {event.note ? <span className="block">{event.note}</span> : null}
                        {event.reason ? <span className="block">Motivo: {event.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ExecutiveShell>
  );
}
