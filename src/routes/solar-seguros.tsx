/**
 * PÁGINA INSTITUCIONAL CONJUNTA "SOLAR + SEGUROS" (`/solar-seguros`).
 *
 * Camada pública de ENTRADA CONJUNTA das duas frentes. Solar e Seguros
 * permanecem logicamente separadas em origem, dados e operação: aqui há
 * apenas apresentação e encaminhamento para cada unidade. Nenhuma rota
 * operacional (`/s`, `/seg`) é alterada.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRANDS } from "@/components/group/brand/brand-content";

const solar = BRANDS.solar;
const seguros = BRANDS.seguros;

const TITLE = "Solar + Seguros — Grupo Velox";
const DESCRIPTION =
  "Entrada conjunta das frentes de energia solar e seguros do Grupo Velox: projetos fotovoltaicos e proteção patrimonial com estrutura e atendimento próprios.";

export const Route = createFileRoute("/solar-seguros")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SolarSegurosPage,
});

function SolarSegurosPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Grupo Velox · Entrada conjunta
      </p>
      <h1 className="mt-3 font-display text-3xl leading-tight text-foreground sm:text-4xl">
        Solar + Seguros
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground">{DESCRIPTION}</p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {[solar, seguros].map((brand) => (
          <section
            key={brand.key}
            className="rounded-2xl border border-border bg-card/40 p-6"
          >
            <span
              className="inline-block h-1.5 w-10 rounded-full"
              style={{ backgroundColor: brand.accent }}
            />
            <h2 className="mt-4 font-display text-xl text-foreground">{brand.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{brand.seo.description}</p>
            <Link
              to={brand.path === "/solar" ? "/solar" : "/seguradora"}
              className="mt-5 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-foreground transition hover:border-foreground/40"
            >
              Conhecer {brand.shortName}
            </Link>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        As duas unidades mantêm carteira, atendimento e operação próprios. Esta
        página é apenas o ponto de entrada comum.
      </p>
    </main>
  );
}
