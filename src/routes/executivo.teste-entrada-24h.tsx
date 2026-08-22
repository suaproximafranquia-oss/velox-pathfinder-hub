/**
 * TESTE DE ENTRADA — 24 HORAS (exclusivo do Administrador).
 *
 * Painel de auditoria do lote controlado: reset fail-closed, criação dos
 * 9 leads fictícios distribuídos em 24 horas e o relatório de execução
 * (entrada real, janela naquele momento, E0 executada ou preservada).
 * Nenhum envio externo acontece aqui — a Meta jamais é chamada.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, PlayCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { isCrmAdministrator } from "@/lib/crm/permissions";
import { ENTRY_TYPE_LABEL, SLOT_LABEL, TEST_TIME_ZONE } from "@/lib/testing/batch24h";
import {
  createBatch24hFn,
  listBatches24hFn,
  readBatch24hReportFn,
  resetHomologationFn,
  runBatch24hTickFn,
} from "@/lib/testing/batch24h.functions";

export const Route = createFileRoute("/executivo/teste-entrada-24h")({
  head: () => ({
    meta: [
      { title: "Teste de Entrada 24 horas — Atlas Platform" },
      {
        name: "description",
        content:
          "Lote controlado de 9 leads fictícios em 24 horas para auditar entrada, janela operacional e primeiro contato.",
      },
      { property: "og:title", content: "Teste de Entrada 24 horas — Atlas Platform" },
      {
        property: "og:description",
        content: "Auditoria da entrada de leads, janelas de horário e execução da E0/A0 sem qualquer envio externo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Batch24hPage,
});

type BatchItem = {
  id: string;
  status: string;
  seed: string | null;
  startedAt: string | null;
  endsAt: string | null;
  leadCount: number;
};

type ReportRow = {
  externalId: string;
  name: string;
  entryType: keyof typeof ENTRY_TYPE_LABEL;
  slot: keyof typeof SLOT_LABEL;
  scheduledAt: string;
  createdLeadAt: string | null;
  executedAt: string | null;
  status: string;
  e0Result: string | null;
  e0Reason: string | null;
  cardId: string | null;
  windowAtEntry: "ABERTA" | "FECHADA" | null;
  cadenceState: string | null;
  cadenceFlow: string | null;
  currentStep: string | null;
  nextStep: string | null;
  nextDueAt: string | null;
  messages: number;
  error: string | null;
};

type Report = {
  batchId: string;
  status: string;
  seed: string | null;
  timeZone: string;
  startedAt: string | null;
  endsAt: string | null;
  planned: number;
  created: number;
  pending: number;
  processed: number;
  errors: number;
  e0Rule: string;
  otherStepsRule: string;
  rows: ReportRow[];
};

type ResetReport = {
  status: string;
  blockReason: string | null;
  candidatesFound: number;
  fictitiousConfirmed: number;
  totalRemoved: number;
  totalPreserved: number;
  affectedTables: string[];
  leads: { id: string; name: string; batchId: string | null }[];
};

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TEST_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_TONE: Record<string, string> = {
  EXECUTADO: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PENDENTE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  EXECUTANDO: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  ERRO: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  BLOQUEADO: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function Batch24hPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reset, setReset] = useState<ResetReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const listBatches = useServerFn(listBatches24hFn);
  const readReport = useServerFn(readBatch24hReportFn);
  const createBatch = useServerFn(createBatch24hFn);
  const runReset = useServerFn(resetHomologationFn);
  const runTick = useServerFn(runBatch24hTickFn);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  const refreshBatches = useCallback(async () => {
    const res = await listBatches();
    const list = (res.batches ?? []) as BatchItem[];
    setBatches(list);
    setSelected((prev) => prev ?? list[0]?.id ?? null);
  }, [listBatches]);

  const refreshReport = useCallback(async () => {
    if (!selected) return;
    const res = await readReport({ data: { batchId: selected } });
    setReport((res.report ?? null) as Report | null);
  }, [readReport, selected]);

  useEffect(() => {
    if (session) void refreshBatches();
  }, [session, refreshBatches]);

  useEffect(() => {
    if (!selected) return;
    void refreshReport();
    const timer = setInterval(() => void refreshReport(), 60_000);
    return () => clearInterval(timer);
  }, [selected, refreshReport]);

  if (!session) return null;
  const isAdmin = isCrmAdministrator(session.activeRole);

  async function handleReset(dryRun: boolean) {
    setBusy(true);
    setNote(null);
    try {
      const res = await runReset({ data: { dryRun } });
      setReset((res.report ?? null) as ResetReport | null);
      setNote(res.ok ? null : (res.error ?? "Operação recusada."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    setNote(null);
    try {
      const res = await createBatch({ data: { seed: null } });
      setNote(
        res.ok
          ? `Lote ${res.batchId} criado com ${res.events.length} entradas programadas (semente ${res.seed}).`
          : (res.error ?? "Lote não criado."),
      );
      await refreshBatches();
      if (res.ok) setSelected(res.batchId);
    } finally {
      setBusy(false);
    }
  }

  async function handleTick() {
    setBusy(true);
    try {
      const res = await runTick();
      setNote(
        `Worker executado: ${res.executed} entrada(s) processada(s), ${res.skipped} ignorada(s).${
          res.errors.length ? ` Erros: ${res.errors.join(" · ")}` : ""
        }`,
      );
      await refreshReport();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ExecutiveShell session={session} active="teste-entrada-24h">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300/80">Homologação controlada</p>
          <h1 className="text-3xl font-semibold text-white">Teste de Entrada — 24 horas</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            Nove leads fictícios (GreenSales, Portal e Reentrada) entram pelo caminho real do sistema em
            três faixas de horário. Nenhuma mensagem é entregue: a Meta e o WhatsApp real nunca são
            chamados, e nenhum lead real é tocado.
          </p>
        </header>

        {!isAdmin ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
            Área restrita ao Administrador.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-amber-300" aria-hidden />
                <h2 className="text-lg font-medium text-white">1. Limpeza de estado (fail-closed)</h2>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Só é removido o que tem marcação técnica de teste. Qualquer registro sem identificação
                completa bloqueia a operação inteira.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleReset(true)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  Simular limpeza
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleReset(false)}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  Executar limpeza
                </button>
              </div>
              {reset && (
                <dl className="mt-4 grid gap-3 text-sm text-slate-200 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Situação</dt>
                    <dd className="font-medium">{reset.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Candidatos</dt>
                    <dd>{reset.candidatesFound}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Removidos</dt>
                    <dd>{reset.totalRemoved}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Preservados</dt>
                    <dd>{reset.totalPreserved}</dd>
                  </div>
                  {reset.blockReason && (
                    <div className="sm:col-span-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">
                      {reset.blockReason}
                    </div>
                  )}
                </dl>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center gap-3">
                <CalendarClock className="h-5 w-5 text-amber-300" aria-hidden />
                <h2 className="text-lg font-medium text-white">2. Lote de 24 horas</h2>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                3 GreenSales, 3 Portal e 3 Reentrada — cada tipo com uma entrada na madrugada
                (01h–05h), uma na janela aberta (07h–12h) e uma no pós-fechamento (12h01–18h).
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCreate()}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  Criar lote
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleTick()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  <PlayCircle className="h-4 w-4" aria-hidden /> Rodar entradas vencidas
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refreshReport()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar
                </button>
                <select
                  value={selected ?? ""}
                  onChange={(e) => setSelected(e.target.value || null)}
                  className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  aria-label="Lote"
                >
                  {batches.length === 0 && <option value="">Nenhum lote</option>}
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} · {b.status}
                    </option>
                  ))}
                </select>
              </div>
              {note && <p className="mt-3 text-sm text-amber-200">{note}</p>}
            </section>

            {report && (
              <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-medium text-white">
                  3. Relatório administrativo — {report.batchId}
                </h2>
                <dl className="grid gap-3 text-sm text-slate-200 sm:grid-cols-5">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Programados</dt>
                    <dd>{report.planned}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Criados</dt>
                    <dd>{report.created}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Pendentes</dt>
                    <dd>{report.pending}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Erros</dt>
                    <dd>{report.errors}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Semente</dt>
                    <dd className="truncate">{report.seed ?? "—"}</dd>
                  </div>
                </dl>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Lead</th>
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Faixa</th>
                        <th className="py-2 pr-3">Programado</th>
                        <th className="py-2 pr-3">Entrada real</th>
                        <th className="py-2 pr-3">Janela</th>
                        <th className="py-2 pr-3">E0</th>
                        <th className="py-2 pr-3">Cadência</th>
                        <th className="py-2 pr-3">Próxima etapa</th>
                        <th className="py-2">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {report.rows.map((row) => (
                        <tr key={row.externalId} className="border-t border-white/5 align-top">
                          <td className="py-2 pr-3">
                            <p className="font-medium">{row.name}</p>
                            <p className="text-xs text-slate-400">{row.externalId}</p>
                            {row.e0Reason && (
                              <p className="mt-1 max-w-md text-xs text-slate-400">{row.e0Reason}</p>
                            )}
                            {row.error && <p className="mt-1 text-xs text-rose-300">{row.error}</p>}
                          </td>
                          <td className="py-2 pr-3">{ENTRY_TYPE_LABEL[row.entryType]}</td>
                          <td className="py-2 pr-3">{SLOT_LABEL[row.slot]}</td>
                          <td className="py-2 pr-3">{hhmm(row.scheduledAt)}</td>
                          <td className="py-2 pr-3">{hhmm(row.createdLeadAt)}</td>
                          <td className="py-2 pr-3">{row.windowAtEntry ?? "—"}</td>
                          <td className="py-2 pr-3">{row.e0Result ?? "—"}</td>
                          <td className="py-2 pr-3">
                            {row.cadenceState ?? "—"}
                            {row.cadenceFlow ? ` · ${row.cadenceFlow}` : ""}
                            {row.currentStep ? ` · ${row.currentStep}` : ""}
                          </td>
                          <td className="py-2 pr-3">
                            {row.nextStep ? `${row.nextStep} — ${hhmm(row.nextDueAt)}` : "—"}
                          </td>
                          <td className="py-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs ${
                                STATUS_TONE[row.status] ?? "border-white/15 text-slate-300"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1 rounded-xl border border-white/10 bg-slate-900/40 p-4 text-xs text-slate-300">
                  <p>
                    <strong className="text-slate-100">Regra da E0/A0:</strong> {report.e0Rule}
                  </p>
                  <p>
                    <strong className="text-slate-100">Demais etapas:</strong> {report.otherStepsRule}
                  </p>
                  <p>
                    Fuso de referência: {report.timeZone}. Nenhuma chamada externa é feita durante o teste.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ExecutiveShell>
  );
}
