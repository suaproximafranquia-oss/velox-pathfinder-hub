/**
 * MÓDULO INTERNO "SOL + SEG" DO WORKSPACE `/f`.
 *
 * Área interna do Workspace do Executivo com DUAS frentes SEPARADAS —
 * Solar e Seguros — apresentadas como cards independentes. Não é
 * carteira de Leads da Financeira: nenhum lead é criado, nenhuma
 * cadência é iniciada e nada aqui altera a página institucional
 * pública `/solar-seguros`, que permanece intacta.
 */
import { ArrowUpRight } from "lucide-react";
import { BRANDS } from "@/components/group/brand/brand-content";

const UNITS = [
  {
    brand: BRANDS.solar,
    href: "/solar",
    resumo:
      "Projetos fotovoltaicos para residências, comércio, indústria, agronegócio e usinas, com engenharia e acompanhamento próprios.",
  },
  {
    brand: BRANDS.seguros,
    href: "/seguradora",
    resumo:
      "Proteção patrimonial, vida, frota, empresarial, agro e benefícios, com curadoria de seguradoras e atendimento consultivo.",
  },
] as const;

export function SolSegPanel() {
  return (
    <section aria-label="Sol + Seg" className="grid gap-5 md:grid-cols-2">
      {UNITS.map(({ brand, href, resumo }) => (
        <article
          key={brand.key}
          className="flex flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-6"
        >
          <span
            className="inline-block h-1.5 w-10 rounded-full"
            style={{ backgroundColor: brand.accent }}
          />
          <h3 className="mt-4 text-lg text-[color:var(--foreground)]">{brand.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            {resumo}
          </p>

          <ul className="mt-5 grid gap-1.5">
            {brand.solutions.items.slice(0, 4).map((item) => (
              <li
                key={item.name}
                className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]"
              >
                {item.name}
              </li>
            ))}
          </ul>

          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--gold)]/45 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--foreground)] transition hover:bg-[color:var(--accent)]"
          >
            Abrir {brand.shortName}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </article>
      ))}

      <p className="md:col-span-2 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
        Solar e Seguros mantêm carteira, atendimento e operação próprios.
        Esta área é apenas o ponto de entrada interno das duas frentes — não
        cria Leads da Financeira nem inicia relacionamento.
      </p>
    </section>
  );
}
