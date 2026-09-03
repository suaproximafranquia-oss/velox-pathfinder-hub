/** Hero institucional do Grupo Velox. */
import { ArrowRight, Building2, Layers, MapPin } from "lucide-react";
import { HERO, NUMBERS } from "./group-content";

const ICONS = [Building2, Layers, MapPin];

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function GroupHero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden bg-[#050b1a]">
      <div className="absolute inset-0">
        <img
          src={HERO.image}
          alt={HERO.imageAlt}
          className="h-full w-full object-cover object-center"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050b1a] via-[#050b1a]/85 to-[#050b1a]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050b1a] via-transparent to-[#050b1a]/70" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-36 md:px-10 md:pb-24 md:pt-48">
        <span className="text-[11px] uppercase tracking-[0.42em] text-[#e8873a]">
          {HERO.eyebrow}
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-6xl">
          {HERO.titleLead}
          <br />
          <span className="text-[#e8873a]">{HERO.titleAccent}</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70">{HERO.lead}</p>

        <div className="mt-9 flex flex-wrap gap-3">
          <button
            onClick={() => go("seja-um-franqueado")}
            className="group inline-flex items-center gap-2 rounded-full bg-[#e8873a] px-7 py-3.5 text-sm font-medium text-[#0b1b33] shadow-[0_12px_40px_-12px_rgba(232,135,58,0.8)] transition hover:bg-[#f0954c]"
          >
            Seja um Franqueado
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
          <button
            onClick={() => go("sobre-o-grupo")}
            className="group inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-medium text-white transition hover:border-white/60 hover:bg-white/5"
          >
            Conheça o Grupo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </div>

        <dl className="mt-14 grid max-w-3xl grid-cols-1 gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
          {NUMBERS.map((n, i) => {
            const Icon = ICONS[i] ?? Building2;
            return (
              <div key={n.label} className="flex items-start gap-3">
                <Icon className="mt-1 h-5 w-5 shrink-0 text-[#e8873a]" aria-hidden />
                <div>
                  <dt className="text-xl font-semibold text-white md:text-2xl">{n.value}</dt>
                  <dd className="mt-0.5 text-xs leading-snug text-white/55">{n.label}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
