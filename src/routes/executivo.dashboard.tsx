import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, BookOpen, Clock, CheckCircle2 } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { MOCK_INVESTORS, formatRelative } from "@/lib/executive-data";

export const Route = createFileRoute("/executivo/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Central do Executivo Velox" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  const investors = useMemo(() => {
    if (!session) return [];
    return session.role === "gestor"
      ? MOCK_INVESTORS
      : MOCK_INVESTORS.filter((i) => i.assignedToUserId === session.userId);
  }, [session]);

  if (!session) return null;

  const novos = investors.filter((i) => i.status === "novo").length;
  const emAndamento = investors.filter((i) => i.status === "em_leitura").length;
  const concluidos = investors.filter((i) => i.status === "concluido" || i.status === "conversando").length;
  const ultima = investors
    .slice()
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())[0];

  const cards = [
    { label: "Novos investidores", value: novos, icon: Users },
    { label: "Em andamento", value: emAndamento, icon: BookOpen },
    { label: "Leituras concluídas", value: concluidos, icon: CheckCircle2 },
    {
      label: "Última atividade",
      value: ultima ? formatRelative(ultima.lastActivity) : "—",
      icon: Clock,
    },
  ];

  return (
    <ExecutiveShell session={session} title="Painel geral">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {c.label}
              </p>
              <c.icon className="h-4 w-4 text-[color:var(--gold)]" />
            </div>
            <p className="font-display text-2xl">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg mb-4">Atividade recente</h2>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 divide-y divide-[color:var(--border)]">
          {investors
            .slice()
            .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
            .slice(0, 5)
            .map((i) => (
              <div key={i.id} className="flex items-center justify-between px-5 py-4 text-sm">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-[color:var(--muted-foreground)] text-xs">
                    {i.currentChapter} · {i.readingPct}%
                  </p>
                </div>
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {formatRelative(i.lastActivity)}
                </p>
              </div>
            ))}
        </div>
      </section>
    </ExecutiveShell>
  );
}