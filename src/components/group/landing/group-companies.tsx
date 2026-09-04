/**
 * Seção "Nossas Empresas" — três cards institucionais.
 *
 * Os botões apontam para as PÁGINAS INSTITUCIONAIS
 * (/financeira, /solar, /seguradora) e nunca para os Portais do
 * Investidor (/f, /s, /seg).
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { COMPANIES } from "./group-content";
import { GroupReveal } from "./group-reveal";

export function GroupCompanies() {
  return (
    <section className="relative bg-[#070d1f] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <GroupReveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Nossas <span className="text-[#e8873a]">Empresas</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/55">
            Três frentes independentes para atender diferentes necessidades.
          </p>
        </GroupReveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {COMPANIES.map((company, i) => (
            <GroupReveal key={company.key} delay={i * 90}>
              <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1226] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] transition hover:border-[#e8873a]/40">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={company.image}
                    alt={company.imageAlt}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b1226] via-[#0b1226]/50 to-transparent" />
                  <h3 className="absolute inset-x-6 bottom-4 text-lg font-semibold leading-tight text-white">
                    {company.name}
                  </h3>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="text-sm leading-relaxed text-white/65">{company.tagline}</p>
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-white/70">
                    {company.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#e8873a]" aria-hidden />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={company.href}
                    aria-label={`Saiba mais sobre ${company.name}`}
                    className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#e8873a]/40 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#e8873a] transition hover:bg-[#e8873a] hover:text-[#0b1226]"
                  >
                    Saiba mais
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            </GroupReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
