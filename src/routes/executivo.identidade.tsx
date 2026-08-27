/**
 * BLOCO 2 §7 — FILA DE PENDÊNCIAS DE IDENTIDADE.
 *
 * Conflitos de identidade (mesmo telefone com outro e-mail, e-mail de um
 * investidor com telefone de outro) NUNCA são resolvidos automaticamente:
 * o servidor apenas registra a divergência e a gestão decide aqui.
 * Esta tela é somente leitura sobre o acervo — nada é mesclado ou apagado.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2, TriangleAlert } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { listIdentityConflicts } from "@/lib/portal-identity.functions";

export const Route = createFileRoute("/executivo/identidade")({
  head: () => ({
    meta: [
      { title: "Pendências de Identidade — Atlas Platform" },
      {
        name: "description",
        content:
          "Revisão manual dos conflitos de identidade detectados na entrada de investidores no Portal Velox.",
      },
      { property: "og:title", content: "Pendências de Identidade — Atlas Platform" },
      {
        property: "og:description",
        content: "Fila de divergências de telefone e e-mail para decisão da gestão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IdentidadePage,
});

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";

type ConflictRow = {
  id: string;
  name: string | null;
  email: string | null;
  whatsapp: string | null;
  identity_conflict: unknown;
  identity_alternates: unknown;
  updated_at: string | null;
};

function describeConflict(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.map(([key, detail]) => {
    if (detail && typeof detail === "object") {
      const record = detail as Record<string, unknown>;
      const parts = Object.entries(record)
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => `${k}: ${String(v)}`);
      return `${key} — ${parts.join(" · ")}`;
    }
    return `${key} — ${String(detail)}`;
  });
}

function IdentidadePage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [rows, setRows] = useState<ConflictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await listIdentityConflicts()) as ConflictRow[];
      setRows(data ?? []);
      setError("");
    } catch {
      setError("Não foi possível carregar a fila de pendências agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void ensureCloudSession().then(() => setSession(getSession()));
    void load();
  }, [load]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Pendências de Identidade">
      <div className="space-y-5">
        <header className={card}>
          <div className="flex items-center gap-3">
            <Fingerprint className="size-5 text-[color:var(--gold)]" aria-hidden />
            <div>
              <h1 className="text-lg font-medium">Pendências de Identidade</h1>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Divergências detectadas na entrada do investidor. Nenhum cadastro é mesclado
                automaticamente — a decisão é sempre da gestão.
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className={`${card} flex items-center gap-2 text-sm`}>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando pendências...
          </div>
        ) : error ? (
          <div className={`${card} flex items-center gap-2 text-sm text-[color:var(--gold)]`}>
            <TriangleAlert className="size-4" aria-hidden /> {error}
          </div>
        ) : rows.length === 0 ? (
          <div className={`${card} text-sm text-[color:var(--muted-foreground)]`}>
            Nenhuma pendência de identidade registrada.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{row.name ?? "Sem nome"}</span>
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">
                    {row.updated_at ? new Date(row.updated_at).toLocaleString("pt-BR") : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {row.email ?? "sem e-mail"} · {row.whatsapp ?? "sem telefone"}
                </p>
                <div className="mt-3 space-y-1">
                  {describeConflict(row.identity_conflict).map((line) => (
                    <p key={line} className="text-xs text-[color:var(--gold)]">
                      {line}
                    </p>
                  ))}
                  {describeConflict(row.identity_alternates).map((line) => (
                    <p key={line} className="text-xs text-[color:var(--muted-foreground)]">
                      Dado alternativo · {line}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ExecutiveShell>
  );
}
