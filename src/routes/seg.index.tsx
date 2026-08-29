/**
 * VELOX SEGUROS — página institucional (`/seg`).
 *
 * Primeira versão SEM captação operacional: não existe formulário,
 * Gateway, simulador ou entrada em `portal_leads`/CRM/cadência da
 * Financeira. A estrutura fica pronta para receber o conteúdo oficial.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/seg/")({
  head: () => ({
    meta: [
      { title: "Velox Seguros — proteção patrimonial, vida e corporativo" },
      {
        name: "description",
        content:
          "Velox Seguros: unidade de seguros do Grupo Velox. Conteúdo institucional em preparação.",
      },
      { property: "og:title", content: "Velox Seguros — Grupo Velox" },
      { property: "og:description", content: "Unidade de seguros do Grupo Velox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SegurosPage,
});

function SegurosPage() {
  return (
    <main className="min-h-screen bg-[#050b1a] px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Grupo Velox
        </Link>
        <ShieldCheck className="mt-10 h-8 w-8 text-[#c9a961]" aria-hidden />
        <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Velox Seguros</h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Unidade de seguros do Grupo Velox.
        </p>
        <p className="mt-10 rounded-2xl border border-[#c9a961]/30 bg-[#c9a961]/5 p-5 text-sm text-[#c9a961]">
          Conteúdo oficial ainda não cadastrado. Esta unidade é institucional nesta versão: não há
          captação, formulário ou cadência — leads de Seguros não entram na operação da Financeira.
        </p>
      </div>
    </main>
  );
}
