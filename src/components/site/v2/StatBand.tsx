import { Reveal } from "../Reveal";

/**
 * StatBand — faixa institucional com números-chave. Fundo azul profundo com
 * detalhes em cobre e marca d'água. Usada como transição entre capítulos.
 */
export function StatBand({
  items,
  eyebrow,
  title,
}: {
  items: { value: string; label: string; note?: string }[];
  eyebrow?: string;
  title?: string;
}) {
  return (
    <section
      aria-label={title ?? "Indicadores da rede"}
      className="relative isolate overflow-hidden surface-ink"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-orange), transparent)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-orange), transparent)" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        {(eyebrow || title) && (
          <Reveal>
            <div className="mb-14 max-w-3xl">
              {eyebrow && (
                <div className="eyebrow eyebrow-on-dark">
                  <span className="mr-4 inline-block h-px w-8 align-middle" style={{ background: "var(--brand-orange)" }} />
                  {eyebrow}
                </div>
              )}
              {title && (
                <h2 className="mt-6 font-serif text-3xl leading-tight on-dark sm:text-4xl md:text-5xl">
                  {title}
                </h2>
              )}
            </div>
          </Reveal>
        )}
        <div className="grid gap-px overflow-hidden" style={{ background: "var(--on-dark-border)", gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="surface-ink flex h-full flex-col p-6 md:p-8">
                <span className="num text-4xl leading-none on-dark md:text-6xl" style={{ color: "var(--brand-orange)" }}>
                  {it.value}
                </span>
                <span className="mt-6 font-serif text-lg leading-snug on-dark md:text-xl">
                  {it.label}
                </span>
                {it.note && (
                  <span className="mt-3 text-xs uppercase tracking-[0.24em] on-dark-muted">
                    {it.note}
                  </span>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}