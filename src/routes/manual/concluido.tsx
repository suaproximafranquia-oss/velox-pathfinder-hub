import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/journey-data";

export const Route = createFileRoute("/manual/concluido")({
  head: () => ({
    meta: [
      { title: "Obrigado — Manual do Investidor Velox" },
      { name: "description", content: "Sua solicitação foi registrada. Em breve um especialista Velox entra em contato." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Concluded,
});

function Concluded() {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá! Acabei de concluir o Manual do Investidor Velox.",
  )}`;
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
        Sua solicitação foi registrada. Nossa equipe entra em contato em até
        um dia útil. Se preferir, você pode iniciar a conversa agora mesmo.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--gold)] px-7 py-3.5 text-sm font-medium text-[color:var(--gold-foreground)] hover:shadow-[0_15px_50px_-15px_var(--gold)] transition-all duration-300"
        >
          Abrir conversa no WhatsApp
        </a>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full border border-[color:var(--border)] px-7 py-3.5 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </article>
  );
}
