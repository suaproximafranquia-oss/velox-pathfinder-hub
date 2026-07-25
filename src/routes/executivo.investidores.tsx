import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  MOCK_INVESTORS,
  STATUS_LABEL,
  formatRelative,
} from "@/lib/executive-data";

export const Route = createFileRoute("/executivo/investidores")({
  head: () => ({
    meta: [
      { title: "Investidores — Central do Executivo Velox" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvestidoresPage,
});

function InvestidoresPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  const investors = useMemo(() => {
    if (!session) return [];
    const base =
      session.role === "gestor"
        ? MOCK_INVESTORS
        : MOCK_INVESTORS.filter((i) => i.assignedToUserId === session.userId);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.phone.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q),
    );
  }, [session, query]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Investidores">
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
        <Search className="h-4 w-4 text-[color:var(--muted-foreground)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-foreground)]/60"
        />
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="text-left px-4 py-3 font-normal">Nome</th>
              <th className="text-left px-4 py-3 font-normal">Cidade</th>
              <th className="text-left px-4 py-3 font-normal">Telefone</th>
              <th className="text-left px-4 py-3 font-normal">Status</th>
              <th className="text-left px-4 py-3 font-normal">Leitura</th>
              <th className="text-left px-4 py-3 font-normal">Capítulo atual</th>
              <th className="text-left px-4 py-3 font-normal">Última atividade</th>
              <th className="text-left px-4 py-3 font-normal">IA</th>
              <th className="text-left px-4 py-3 font-normal">Diagnóstico</th>
              <th className="text-left px-4 py-3 font-normal">Relatório</th>
            </tr>
          </thead>
          <tbody>
            {investors.map((i) => (
              <tr key={i.id} className="border-b border-[color:var(--border)]/60 last:border-0">
                <td className="px-4 py-3">{i.name}</td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{i.city}</td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{i.phone}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 px-2.5 py-0.5 text-xs text-[color:var(--gold)]">
                    {STATUS_LABEL[i.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-[color:var(--border)] overflow-hidden">
                      <div
                        className="h-full bg-[color:var(--gold)]"
                        style={{ width: `${i.readingPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[color:var(--muted-foreground)]">
                      {i.readingPct}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{i.currentChapter}</td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                  {formatRelative(i.lastActivity)}
                </td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)]">{i.aiInteractions}</td>
                <td className="px-4 py-3 text-[color:var(--muted-foreground)] capitalize">{i.diagnostic}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-[color:var(--gold)] hover:underline"
                    onClick={() => alert("Geração de relatório será implementada em etapa futura.")}
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </button>
                </td>
              </tr>
            ))}
            {investors.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[color:var(--muted-foreground)]">
                  Nenhum investidor encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ExecutiveShell>
  );
}