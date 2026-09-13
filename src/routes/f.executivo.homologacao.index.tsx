/**
 * CENTRAL DE HOMOLOGAÇÃO — MOTOR DE RELACIONAMENTO.
 *
 * O SIMULADOR BILATERAL ANTIGO (E0, E1, E3, E4, E12, E30) FOI REMOVIDO
 * DEFINITIVAMENTE: ele apresentava etapas que não são mais as atuais e
 * nenhum outro simulador entra no lugar agora.
 *
 * O que permanece aqui é a fotografia literal das etapas vigentes
 * (fonte única do motor). Nada nesta tela envia mensagem real.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { HomologationTabs } from "@/components/executive/homologation-tabs";
import { CurrentStepSnapshotCard } from "@/components/executive/current-step-snapshot-card";

export const Route = createFileRoute("/f/executivo/homologacao/")({
  head: () => ({
    meta: [
      { title: "Central de Homologação — Atlas Platform" },
      {
        name: "description",
        content:
          "Etapas vigentes do motor de relacionamento e áreas de homologação, sem disparos reais.",
      },
      { property: "og:title", content: "Central de Homologação — Atlas Platform" },
      {
        property: "og:description",
        content: "Fotografia das etapas atuais e acessos de homologação do motor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomologacaoPage,
});

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";

function HomologacaoPage() {
  const [session, setSession] = useState<ExecutiveSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Homologação">
      <div className="space-y-6">
        <HomologationTabs />

        <section className={card}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-[color:var(--gold)]" />
            <div>
              <h2 className="font-display text-lg text-[color:var(--foreground)]">
                Motor de Relacionamento
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-[color:var(--muted-foreground)]">
                O simulador antigo foi removido por apresentar etapas que não
                correspondem mais ao motor atual. As etapas vigentes abaixo são a
                fonte única de verdade. Nenhum envio real é feito nesta área.
              </p>
            </div>
          </div>
        </section>


        <CurrentStepSnapshotCard />

      </div>
    </ExecutiveShell>
  );
}
