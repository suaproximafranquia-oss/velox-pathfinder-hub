/**
 * CARTEIRA DAS UNIDADES DO GRUPO — Velox Solar e Velox Seguros.
 *
 * Carteira SEPARADA da Financeira: nada aqui entra em `portal_leads`,
 * CRM, Ação do Dia ou cadência. O primeiro contato é humano e a
 * situação é registrada manualmente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, ShieldCheck, Sun } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  atualizarContatoUnidade,
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

type UnitKey = "solar" | "seguros";

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
  created_at: string;
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

const TABS: Array<{ key: UnitKey; label: string; icon: typeof Sun }> = [
  { key: "solar", label: "Velox Solar", icon: Sun },
  { key: "seguros", label: "Velox Seguros", icon: ShieldCheck },
];

function UnitLeadsPage() {
  const list = useServerFn(listarInteressadosUnidade);
  const updateStatus = useServerFn(atualizarContatoUnidade);
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [unit, setUnit] = useState<UnitKey>("solar");
  const [rows, setRows] = useState<UnitLead[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);

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

  async function changeStatus(id: string, status: string) {
    try {
      await updateStatus({ data: { id, status: status as "pendente" } });
      await load(unit);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar.");
    }
  }

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

        {rows.length === 0 ? (
          <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted-foreground)]">
            Nenhum interessado registrado nesta unidade.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
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
                    onChange={(e) => void changeStatus(row.id, e.target.value)}
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs"
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <span className="rounded-full border border-[color:var(--border)] px-2 py-1">
                    Registrado em {new Date(row.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ExecutiveShell>
  );
}
