/**
 * FICHA COMPLETA DO INVESTIDOR — endereço canônico.
 *
 * Antes a ficha só existia como estado interno de outra tela: "Ver ficha
 * completa" apenas selecionava um card e, fora do Workspace, não abria
 * nada. Agora a ficha tem URL própria — pode ser aberta em nova aba,
 * recarregada e compartilhada internamente sem perder o contexto.
 *
 * A ficha é exatamente a MESMA do Workspace (mesmo componente, mesmos
 * dados). Nada é duplicado nem recriado.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { InvestorProfileView } from "@/components/executive/workspace/investor-profile-view";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { listAllInvestors } from "@/lib/executive-data";
import { pullLeads, subscribeLeads } from "@/lib/portal-leads-sync";
import { onSync } from "@/lib/sync-bus";

export const Route = createFileRoute("/f/executivo/investidores/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ficha do Investidor — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FichaPage,
});

function FichaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/f/executivo" });
    else setSession(s);
  }, [navigate]);

  // A ficha pode ser aberta direto pela URL: garantimos a base local
  // antes de dizer que o investidor não existe.
  useEffect(() => {
    let alive = true;
    void pullLeads()
      .catch(() => 0)
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => subscribeLeads(() => setTick((v) => v + 1)), []);
  useEffect(() => onSync(() => setTick((v) => v + 1)), []);

  const investor = useMemo(
    () =>
      listAllInvestors({ includeJourneyOnly: true, includeArchived: true }).find(
        (i) => i.id === id,
      ) ?? null,
    [id, tick, ready],
  );

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Ficha do Investidor">
      {investor ? (
        <InvestorProfileView
          investor={investor}
          session={session}
          onBack={() => navigate({ to: "/f/executivo/dashboard" })}
        />
      ) : (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 text-sm text-[color:var(--muted-foreground)]">
          {ready
            ? "Investidor não encontrado nesta base. Verifique se o lead ainda pertence a esta unidade."
            : "Carregando ficha do investidor…"}
        </div>
      )}
    </ExecutiveShell>
  );
}
