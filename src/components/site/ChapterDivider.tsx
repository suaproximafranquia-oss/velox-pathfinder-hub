import { Reveal } from "./Reveal";
import { VMark } from "./VMark";

const roman = (n: number) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n - 1] ?? String(n);

export function ChapterDivider({
  number,
  chapter,
  title,
  quote,
}: {
  number: number;
  chapter: string;
  title: string;
  quote: string;
}) {
  return (
    <section
      aria-label={`${chapter} — ${title}`}
      className="relative isolate overflow-hidden text-[var(--ink-foreground)]"
      style={{ background: "var(--grad-ink-hero)" }}
    >
      <div className="bg-grid-ink absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="bg-noise absolute inset-0 opacity-30 mix-blend-overlay" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -right-40 top-1/2 -z-0 h-[36rem] w-[36rem] -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "color-mix(in oklab, var(--brand-orange) 22%, transparent)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-14 px-6 py-28 md:flex-row md:items-center md:gap-20 md:px-10 md:py-40">
        <Reveal className="relative shrink-0">
          <div className="relative h-44 w-44 text-[var(--brand-orange)] md:h-56 md:w-56">
            <VMark className="absolute inset-0 animate-vfloat" strokeWidth={1.2} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-6xl italic text-[var(--ink-foreground)] md:text-7xl">
                {roman(number)}
              </span>
            </div>
          </div>
        </Reveal>

        <div className="min-w-0 flex-1">
          <Reveal delay={80}>
            <div className="flex items-center gap-4">
              <span
                className="h-px w-10"
                style={{ background: "var(--brand-orange)" }}
                aria-hidden="true"
              />
              <span className="text-[0.7rem] uppercase tracking-[0.34em] text-[var(--ink-muted)]">
                {chapter} · Capítulo {String(number).padStart(2, "0")}
              </span>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <h2 className="mt-8 text-balance font-serif text-4xl leading-[1.08] text-[var(--ink-foreground)] sm:text-5xl md:text-6xl">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={260}>
            <p className="mt-8 max-w-[52ch] font-serif text-xl italic leading-relaxed text-[var(--ink-muted)] md:text-2xl">
              “{quote}”
            </p>
          </Reveal>
        </div>
      </div>

      <div
        className="h-px w-full"
        style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--brand-orange) 60%, transparent), transparent)" }}
        aria-hidden="true"
      />
    </section>
  );
}