/**
 * VELOX SEGUROS — página institucional pública (`/seg`).
 *
 * Identidade da unidade + formulário próprio de interesse. Nada aqui é
 * operacional da Financeira: não existe Gateway, simulador, cadência
 * ou entrada em `portal_leads`.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { UnitInterestForm } from "@/components/group/unit-interest-form";

type UnitSearch = { g?: string; o?: string; c?: string };
/**
 * A URL pode entregar valores já convertidos (ex.: `g=1` vira número).
 * A leitura normaliza tudo para texto — nenhum parâmetro se perde.
 */
const str = (v: unknown) => {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

const BULLETS = [
  "Proteção patrimonial para famílias e empresas",
  "Vida e previdência",
  "Seguros corporativos e frotas",
];

export const Route = createFileRoute("/seg/")({
  validateSearch: (search: Record<string, unknown>): UnitSearch => ({
    g: str(search.g),
    o: str(search.o),
    c: str(search.c),
  }),
  head: () => ({
    meta: [
      { title: "Velox Seguros — proteção patrimonial, vida e corporativo" },
      {
        name: "description",
        content:
          "Velox Seguros, unidade de seguros do Grupo Velox. Conheça a operação e registre seu interesse em ser um parceiro.",
      },
      { property: "og:title", content: "Velox Seguros — Grupo Velox" },
      {
        property: "og:description",
        content: "Unidade de seguros do Grupo Velox: conheça a operação e fale com o time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SegurosPage,
});

function SegurosPage() {
  const search = Route.useSearch();

  return (
    <main className="min-h-screen bg-[#050b1a] px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Grupo Velox
        </Link>

        <div className="mt-10 grid gap-10 md:grid-cols-2">
          <div>
            <ShieldCheck className="h-8 w-8 text-[#c9a961]" aria-hidden />
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Velox Seguros</h1>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Unidade de seguros do Grupo Velox. Operação independente da Velox Soluções
              Financeiras, com carteira, atendimento e estrutura próprios.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/70">
              {BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c9a961]" aria-hidden />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          <UnitInterestForm
            unit="seguros"
            origin={search.o ?? null}
            campaign={search.c ?? null}
            fromGroup={Boolean(search.g)}
          />
        </div>
      </div>
    </main>
  );
}
