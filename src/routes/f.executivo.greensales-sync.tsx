/**
 * GreenSales Sync (POC) — exclusivo do Administrador.
 *
 * Executa uma importação pontual, somente leitura na origem, dos leads
 * criados hoje no GreenSales. Nenhum token ou credencial é exibido.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, ShieldCheck, RefreshCw } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { isCrmAdministrator } from "@/lib/crm/permissions";
import {
  importGreenSalesTodayLeads,
  type GreenSalesImportResult,
} from "@/lib/greensales-sync.functions";

export const Route = createFileRoute("/f/executivo/greensales-sync")({
  head: () => ({
    meta: [
      { title: "GreenSales Sync — Atlas Platform" },
      {
        name: "description",
        content:
          "Importação pontual e somente leitura dos leads criados hoje no GreenSales para o Portal Atlas.",
      },
      { property: "og:title", content: "GreenSales Sync — Atlas Platform" },
      {
        property: "og:description",
        content: "Prova de conceito de importação de leads do GreenSales para o Atlas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GreenSalesSyncPage,
});

function GreenSalesSyncPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GreenSalesImportResult | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const runImport = useServerFn(importGreenSalesTodayLeads);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  if (!session) return null;
  const isAdmin = isCrmAdministrator(session.activeRole);

  async function handleRun() {
    setRunning(true);
    setFatal(null);
    setResult(null);
    try {
      setResult(await runImport());
    } catch (error) {
      setFatal(error instanceof Error ? error.message : "Falha inesperada na importação.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <ExecutiveShell session={session} title="GreenSales Sync">
      <div className="mb-6 flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
          <Download className="h-4 w-4" />
        </span>
        <div>
          <h1 className="font-display text-xl">GreenSales Sync</h1>
          <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
            Prova de conceito: consulta server-side dos leads criados hoje no GreenSales e criação
            dos respectivos Leads no Atlas. A origem permanece intocada — nenhuma alteração,
            mensagem ou movimentação é enviada ao GreenSales.
          </p>
        </div>
      </div>

      {!isAdmin ? (
        <div className="rounded-2xl border border-[color:var(--border)] p-6 text-sm text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mb-2 h-4 w-4" />
          Área restrita ao Administrador.
        </div>
      ) : (
        <div className="space-y-5">
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/50 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Importando…" : "Importar leads de hoje"}
          </button>

          {fatal && (
            <p className="rounded-xl border border-red-500/40 p-4 text-sm text-red-400">{fatal}</p>
          )}

          {result && (
            <div className="space-y-4 rounded-2xl border border-[color:var(--border)] p-5">
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Dia da operação: <strong>{result.day ?? "—"}</strong> · Janela considerada:{" "}
                {result.windowStart} → {result.windowEnd}
              </p>
              {result.message && (
                <p className="text-sm text-amber-400">
                  Etapa com falha: {result.stage} — {result.message}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["Encontrados", result.found],
                  ["Importados", result.imported],
                  ["Já existentes", result.duplicated],
                  ["Com erro", result.failed],
                  ["Processados", result.processed],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[color:var(--border)] p-3"
                  >
                    <p className="text-[11px] text-[color:var(--muted-foreground)]">{label}</p>
                    <p className="font-display text-lg">{value}</p>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <ul className="space-y-1 text-xs text-red-400">
                  {result.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}

              {result.sample && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[color:var(--border)] p-3">
                    <p className="mb-2 text-[11px] text-[color:var(--muted-foreground)]">
                      GreenSales (origem)
                    </p>
                    <pre className="overflow-x-auto text-[11px]">
                      {JSON.stringify(result.sample.greensales, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-[color:var(--border)] p-3">
                    <p className="mb-2 text-[11px] text-[color:var(--muted-foreground)]">
                      Lead Atlas (resultado)
                    </p>
                    <pre className="overflow-x-auto text-[11px]">
                      {JSON.stringify(result.sample.atlas, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ExecutiveShell>
  );
}
