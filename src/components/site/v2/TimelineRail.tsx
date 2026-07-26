import type { ReactNode } from "react";
import { Reveal } from "../Reveal";

export type RailItem = {
  marker: string;
  title: string;
  description?: string;
  meta?: string;
};

/**
 * TimelineRail — linha vertical com marcadores em cobre, numeração serifada
 * e blocos de texto editoriais. Alternativa mais elegante à Timeline horizontal.
 */
export function TimelineRail({
  items,
  dark = false,
  children,
}: {
  items: RailItem[];
  dark?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-6 top-2 w-px md:left-8"
        style={{
          background: dark
            ? "linear-gradient(180deg, transparent, var(--on-dark-border), transparent)"
            : "linear-gradient(180deg, transparent, var(--paper-edge), transparent)",
        }}
      />
      <ol className="space-y-14 md:space-y-20">
        {items.map((it, i) => (
          <Reveal key={i} as="li" delay={i * 80}>
            <div className="relative grid grid-cols-[3rem_1fr] gap-6 md:grid-cols-[4rem_1fr] md:gap-10">
              <div className="relative flex items-start">
                <span
                  aria-hidden="true"
                  className="relative z-10 grid h-12 w-12 place-items-center rounded-full md:h-16 md:w-16"
                  style={{
                    background: dark ? "var(--ink)" : "var(--paper-2)",
                    boxShadow: dark
                      ? "0 0 0 1px var(--on-dark-border)"
                      : "0 0 0 1px var(--paper-edge)",
                  }}
                >
                  <span
                    className="num text-lg md:text-xl"
                    style={{ color: "var(--brand-orange)" }}
                  >
                    {it.marker}
                  </span>
                </span>
              </div>
              <div className="pt-1">
                {it.meta && (
                  <div className={`eyebrow ${dark ? "eyebrow-on-dark" : ""}`}>{it.meta}</div>
                )}
                <h3
                  className={`mt-2 font-serif text-2xl leading-snug md:text-3xl ${
                    dark ? "on-dark" : "text-foreground"
                  }`}
                >
                  {it.title}
                </h3>
                {it.description && (
                  <p
                    className={`mt-4 max-w-[58ch] text-base leading-relaxed md:text-[1.05rem] ${
                      dark ? "on-dark-muted" : "text-muted-foreground"
                    }`}
                  >
                    {it.description}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
      {children}
    </div>
  );
}