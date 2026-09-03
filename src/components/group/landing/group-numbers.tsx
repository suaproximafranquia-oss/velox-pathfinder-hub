/**
 * Faixa "O Grupo Velox em números".
 * Somente números confirmados no projeto (ver group-content.ts).
 */
import { Building2, Layers, MapPin } from "lucide-react";
import { NUMBERS } from "./group-content";
import { GroupReveal } from "./group-reveal";

const ICONS = [Building2, Layers, MapPin];

export function GroupNumbers() {
  return (
    <section className="bg-[#050b1a] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <GroupReveal>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1226] to-[#050b1a] p-10 shadow-[0_30px_80px_-40px_rgba(0,0,0,1)]">
            <h2 className="text-center text-2xl font-semibold text-white md:text-3xl">
              O Grupo Velox <span className="text-[#e8873a]">em números</span>
            </h2>
            <dl className="mt-10 grid gap-8 sm:grid-cols-3">
              {NUMBERS.map((n, i) => {
                const Icon = ICONS[i] ?? Building2;
                return (
                  <div key={n.label} className="flex items-start justify-center gap-3 text-left">
                    <Icon className="mt-1 h-6 w-6 shrink-0 text-[#e8873a]" aria-hidden />
                    <div>
                      <dt className="text-2xl font-semibold text-[#e8873a] md:text-3xl">{n.value}</dt>
                      <dd className="mt-1 text-xs leading-snug text-white/60">{n.label}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </div>
        </GroupReveal>
      </div>
    </section>
  );
}
