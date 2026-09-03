/** Seção "Por que o Grupo Velox?" — seis diferenciais já existentes no projeto. */
import { Award, GraduationCap, Handshake, LineChart, ShieldCheck, Users2 } from "lucide-react";
import { WHY } from "./group-content";
import { GroupReveal } from "./group-reveal";

const ICON_MAP = {
  handshake: Handshake,
  users: Users2,
  chart: LineChart,
  graduation: GraduationCap,
  shield: ShieldCheck,
  award: Award,
} as const;

export function GroupWhy() {
  return (
    <section className="relative bg-[#050b1a] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <GroupReveal className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Por que o <span className="text-[#e8873a]">Grupo Velox?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/55">
            Um modelo sólido, construído para gerar oportunidades reais.
          </p>
        </GroupReveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {WHY.map((item, i) => {
            const Icon = ICON_MAP[item.icon];
            return (
              <GroupReveal key={item.title} delay={i * 60} className="h-full">
                <article className="flex h-full flex-col items-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 text-center transition hover:border-[#e8873a]/40">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e8873a]/30 bg-[#e8873a]/10">
                    <Icon className="h-5 w-5 text-[#e8873a]" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">{item.text}</p>
                </article>
              </GroupReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
