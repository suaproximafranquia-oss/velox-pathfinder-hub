/**
 * AMBIENTE DE TESTE REAL-TIME DA CADÊNCIA — exclusivo do Administrador.
 *
 * Cria lotes de leads FICTÍCIOS que entram pelo fluxo real do sistema e
 * são conduzidos pelo motor real, em tempo real. Nenhuma mensagem sai
 * do ambiente: todo lead marcado é forçado a simulação no despachante.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { isCrmAdministrator } from "@/lib/crm/permissions";
import { TEST_SCENARIOS, scenarioLabel, type TestScenarioKey } from "@/lib/testing/test-lab";
import {
  listarDiretorioExecutivos,
  type ExecutiveDirectoryEntry,
} from "@/lib/executive-directory.functions";
import {
  applyBatchActionFn,
  createTestBatchFn,
  listTestBatchesFn,
  purgeTestBatchFn,
  readBatchLeadsFn,
} from "@/lib/testing/test-lab.functions";

export const Route = createFileRoute("/f/executivo/teste-cadencia")({
  head: () => ({
    meta: [
      { title: "Teste de Cadência em Tempo Real — Atlas Platform" },
      {
        name: "description",
        content:
          "Lotes de leads fictícios percorrendo o fluxo real do motor de cadência, em tempo real e sem qualquer envio externo.",
      },
      { property: "og:title", content: "Teste de Cadência em Tempo Real — Atlas Platform" },
      {
        property: "og:description",
        content: "Ambiente controlado de validação do motor de relacionamento com leads fictícios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TestLabPage,
});

type Batch = { id: string; status: string; scenarios: string[]; leadCount: number; createdAt: string };
type LeadState = {
  externalId: string;
  name: string;
  scenario: string;
  stageKey: string | null;
  cadenceState: string | null;
  currentStep: string | null;
  messages: number;
  nextStep: string | null;
  nextDueAt: string | null;
};

const ACTIONS: { key: "avancar_etapa" | "responder" | "agendar" | "interromper"; label: string }[] = [
  { key: "avancar_etapa", label: "Sair de NOVOS" },
  { key: "responder", label: "Responder" },
  { key: "agendar", label: "Agendar" },
  { key: "interromper", label: "Interromper" },
];

function TestLabPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadState[]>([]);
  const [scenarios, setScenarios] = useState<TestScenarioKey[]>(["silencio_total", "sem_acao_humana"]);
  const [perScenario, setPerScenario] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [directory, setDirectory] = useState<ExecutiveDirectoryEntry[]>([]);
  const [responsible, setResponsible] = useState<string>("");

  const listDirectory = useServerFn(listarDiretorioExecutivos);
  const listBatches = useServerFn(listTestBatchesFn);
  const readLeads = useServerFn(readBatchLeadsFn);
  const createBatch = useServerFn(createTestBatchFn);
  const applyAction = useServerFn(applyBatchActionFn);
  const purgeBatch = useServerFn(purgeTestBatchFn);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/f/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  const refreshBatches = useCallback(async () => {
    const res = await listBatches();
    setBatches(res.batches as Batch[]);
    if (!selected && res.batches.length > 0) setSelected((res.batches as Batch[])[0].id);
  }, [listBatches, selected]);

  const refreshLeads = useCallback(async () => {
    if (!selected) return;
    const res = await readLeads({ data: { batchId: selected } });
    setLeads(res.leads as LeadState[]);
  }, [readLeads, selected]);

  useEffect(() => {
    if (session) void refreshBatches();
  }, [session, refreshBatches]);

  useEffect(() => {
    if (!selected) return;
    void refreshLeads();
    const timer = setInterval(() => void refreshLeads(), 30000);
    return () => clearInterval(timer);
  }, [selected, refreshLeads]);

  if (!session) return null;
  const isAdmin = isCrmAdministrator(session.activeRole);

  function toggleScenario(key: TestScenarioKey) {
    setScenarios((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleCreate() {
    setBusy(true);
    setNote(null);
    try {
      const res = await createBatch({ data: { scenarios, perScenario } });
      setNote(
        res.ok
          ? `Lote ${res.batchId} criado com ${res.leads.length} leads fictícios.`
          : `Lote ${res.batchId}: ${res.errors.join(" · ")}`,
      );
      await refreshBatches();
      if (res.batchId) setSelected(res.batchId);
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(externalId: string, action: (typeof ACTIONS)[number]["key"]) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await applyAction({ data: { batchId: selected, externalId, action } });
      setNote(res.message);
      await refreshLeads();
    } finally {
      setBusy(false);
    }
  }

  async function handlePurge() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await purgeBatch({ data: { batchId: selected } });
      setNote(`Lote ${selected} limpo: ${res.removed} registros removidos.`);
      setLeads([]);
      await refreshBatches();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ExecutiveShell session={session} title="Teste de Cadência">
      <div className="mb-6 flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
          <FlaskConical className="h-4 w-4" />
        </span>
        <div>
          <h1 className="font-display text-xl">Teste de cadência em tempo real</h1>
          <p className="mt-1 max-w-3xl text-xs text-[color:var(--muted-foreground)]">
            Leads fictícios entram pelo mesmo caminho de um lead real e são conduzidos pelo motor
            real, com relógio e agendador reais — sem aceleração de tempo. Nenhuma mensagem sai do
            ambiente: todo lead de lote é forçado a simulação antes de qualquer envio. Leads reais
            nunca são marcados, movidos ou apagados por esta tela.
          </p>
        </div>
      </div>

      {!isAdmin ? (
        <div className="rounded-2xl border border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mb-2 h-4 w-4" />
          Área restrita ao Administrador.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[color:var(--border)] p-5">
            <h2 className="font-display text-sm">Novo lote</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TEST_SCENARIOS.map((s) => (
                <label
                  key={s.key}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-[color:var(--border)] p-3 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={scenarios.includes(s.key)}
                    onChange={() => toggleScenario(s.key)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>{s.label}</strong>
                    <span className="block text-[color:var(--muted-foreground)]">{s.expectation}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-xs text-[color:var(--muted-foreground)]">
                Leads por cenário
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={perScenario}
                  onChange={(e) => setPerScenario(Number(e.target.value))}
                  className="ml-2 w-16 rounded-lg border border-[color:var(--border)] bg-transparent px-2 py-1"
                />
              </label>
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy || scenarios.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/10 disabled:opacity-50"
              >
                <FlaskConical className="h-4 w-4" />
                {busy ? "Processando…" : "Criar lote e injetar no fluxo real"}
              </button>
            </div>
          </section>

          {note && (
            <p className="rounded-xl border border-[color:var(--gold)]/40 p-3 text-xs text-[color:var(--gold)]">
              {note}
            </p>
          )}

          <section className="rounded-2xl border border-[color:var(--border)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-sm">Lotes</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void refreshLeads()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                </button>
                <button
                  type="button"
                  onClick={handlePurge}
                  disabled={!selected || busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Limpar lote
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b.id)}
                  className={`rounded-xl border px-3 py-1.5 text-xs ${
                    selected === b.id
                      ? "border-[color:var(--gold)]/60 text-[color:var(--gold)]"
                      : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
                  }`}
                >
                  {b.id} · {b.leadCount} leads · {b.status}
                </button>
              ))}
              {batches.length === 0 && (
                <p className="text-xs text-[color:var(--muted-foreground)]">Nenhum lote criado.</p>
              )}
            </div>

            {leads.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[color:var(--muted-foreground)]">
                    <tr>
                      <th className="py-2">Lead</th>
                      <th>Cenário</th>
                      <th>Coluna</th>
                      <th>Estado</th>
                      <th>Etapa</th>
                      <th>Mensagens</th>
                      <th>Próxima</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.externalId} className="border-t border-[color:var(--border)]">
                        <td className="py-2">{l.name}</td>
                        <td>{scenarioLabel(l.scenario)}</td>
                        <td>{l.stageKey ?? "—"}</td>
                        <td>{l.cadenceState ?? "—"}</td>
                        <td>{l.currentStep ?? "—"}</td>
                        <td>{l.messages}</td>
                        <td>
                          {l.nextStep
                            ? `${l.nextStep} · ${new Date(l.nextDueAt ?? "").toLocaleString("pt-BR")}`
                            : "—"}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1 py-1">
                            {ACTIONS.map((a) => (
                              <button
                                key={a.key}
                                type="button"
                                disabled={busy}
                                onClick={() => handleAction(l.externalId, a.key)}
                                className="rounded-lg border border-[color:var(--border)] px-2 py-1 text-[11px] disabled:opacity-50"
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </ExecutiveShell>
  );
}
