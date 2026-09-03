/**
 * Seção "Sobre o Grupo" (#sobre-o-grupo).
 *
 * Missão e visão NÃO possuem texto institucional oficial no projeto —
 * por isso não são exibidas. Valores, frentes e linha do tempo usam
 * conteúdo já existente em `/universo` e no material institucional.
 */
import { ABOUT, FRONTS, TIMELINE, VALUES } from "./group-content";
import { GroupReveal } from "./group-reveal";

export function GroupAbout() {
  return (
    <section id="sobre-o-grupo" className="relative scroll-mt-20 bg-[#070d1f] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <GroupReveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Sobre o <span className="text-[#e8873a]">Grupo Velox</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/55">{ABOUT.subtitle}</p>
        </GroupReveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-2">
          <GroupReveal className="space-y-6">
            {ABOUT.paragraphs.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-white/70 md:text-base">
                {p}
              </p>
            ))}
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <img
                src={ABOUT.image}
                alt={ABOUT.imageAlt}
                className="h-64 w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {FRONTS.map((front) => (
                <article
                  key={front.name}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[#e8873a]">
                    {front.eyebrow}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-white">{front.name}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">{front.highlight}</p>
                </article>
              ))}
            </div>
          </GroupReveal>

          <GroupReveal delay={120}>
            <ol className="relative space-y-8 border-l border-white/10 pl-8">
              {TIMELINE.map((step) => (
                <li key={step.marker} className="relative">
                  <span className="absolute -left-[41px] flex h-5 w-5 items-center justify-center rounded-full border border-[#e8873a]/50 bg-[#070d1f]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#e8873a]" />
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.28em] text-[#e8873a]">
                    {step.marker}
                  </span>
                  <h3 className="mt-1.5 text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{step.text}</p>
                </li>
              ))}
            </ol>
          </GroupReveal>
        </div>

        <div className="mt-16">
          <GroupReveal>
            <h3 className="text-center text-xs uppercase tracking-[0.32em] text-white/40">
              Nossos Valores
            </h3>
          </GroupReveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((value, i) => (
              <GroupReveal key={value.title} delay={i * 60} className="h-full">
                <article className="h-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
                  <h4 className="text-sm font-semibold text-white">{value.title}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">{value.body}</p>
                </article>
              </GroupReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
