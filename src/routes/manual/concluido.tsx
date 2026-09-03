import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { homePathOrRoot } from "@/lib/navigation-environment";
import { CheckCircle2 } from "lucide-react";
import { PortalFinalCta } from "@/components/portal/portal-final-cta";

export const Route = createFileRoute("/manual/concluido")({
  head: () => ({
    meta: [
      { title: "Obrigado — Manual do Investidor Velox" },
      { name: "description", content: "Sua leitura foi concluída. Continue a conversa com a Velox quando fizer sentido para você." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Concluded,
});

function Concluded() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <article className="animate-chapter-enter mx-auto max-w-2xl px-6 text-center">
      <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10">
        <CheckCircle2 className="h-6 w-6 text-[color:var(--gold)]" />
      </div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)] mb-4">
        Jornada concluída
      </p>
      <h1 className="font-display text-3xl md:text-4xl leading-tight text-balance">
        Obrigado por dedicar seu tempo.
      </h1>
      <p className="mt-5 text-base text-[color:var(--muted-foreground)] leading-relaxed text-balance">
        Este manual reuniu a essência de quem somos. A partir daqui, o próximo passo acontece
        no seu ritmo.
      </p>

      <div className="mt-10">
        <PortalFinalCta context="Manual do Investidor" />
      </div>

      <Link
        to={homePathOrRoot(pathname)}
        className="mt-8 inline-flex items-center justify-center rounded-full border border-[color:var(--border)] px-7 py-3.5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition-colors"
      >
        Voltar ao início
      </Link>
    </article>
  );
}
