/**
 * CENTRAL DE HOMOLOGAÇÃO — MOTOR DE RELACIONAMENTO.
 *
 * O SIMULADOR BILATERAL ANTIGO (E0, E1, E3, E4, E12, E30) FOI REMOVIDO
 * DEFINITIVAMENTE: ele apresentava etapas que não são mais as atuais e
 * nenhum outro simulador entra no lugar agora.
 *
 * O que permanece aqui: a fotografia literal das etapas vigentes (fonte
 * única do motor) e os atalhos para as áreas de homologação que
 * continuam válidas — Biblioteca de Conteúdos e Ação do Dia em modo
 * demonstração. Nada nesta tela envia mensagem real.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Library, MessagesSquare, ShieldCheck } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { HomologationTabs } from "@/components/executive/homologation-tabs";
import { CurrentStepSnapshotCard } from "@/components/executive/current-step-snapshot-card";
import { EnvironmentClockCard } from "@/components/executive/environment-clock-card";

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
const shortcut =
  "flex items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5 transition hover:border-[color:var(--gold)]/50";

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

        <EnvironmentClockCard />

        <CurrentStepSnapshotCard />

        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/f/executivo/biblioteca" className={shortcut}>
            <Library className="mt-0.5 h-5 w-5 text-[color:var(--gold)]" />
            <span>
              <span className="block font-display text-base text-[color:var(--foreground)]">
                Biblioteca de Conteúdos
              </span>
              <span className="mt-1 block text-sm text-[color:var(--muted-foreground)]">
                Conteúdos oficiais por finalidade, versionados e reutilizados pelo motor.
              </span>
            </span>
          </Link>

          <Link to="/f/executivo/homologacao/acao-do-dia" className={shortcut}>
            <MessagesSquare className="mt-0.5 h-5 w-5 text-[color:var(--gold)]" />
            <span>
              <span className="block font-display text-base text-[color:var(--foreground)]">
                Ação do Dia — Demonstração
              </span>
              <span className="mt-1 block text-sm text-[color:var(--muted-foreground)]">
                Demonstração isolada da tela operacional, sem dados reais e sem envios.
              </span>
            </span>
          </Link>
        </div>
      </div>
    </ExecutiveShell>
  );
}
