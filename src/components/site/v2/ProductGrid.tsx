import { Reveal } from "../Reveal";

export type Product = { name: string; description: string; commission: string };

/**
 * ProductGrid — grade editorial das soluções financeiras.
 * Cards com numeração, filete laranja, título serifado e comissão em rodapé.
 */
export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div
      className="grid gap-px overflow-hidden"
      style={{ background: "var(--on-dark-border)" }}
    >
      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: "var(--on-dark-border)" }}>
        {items.map((p, i) => (
          <Reveal key={p.name} delay={(i % 3) * 80}>
            <article
              className="group relative flex h-full flex-col p-8 transition-colors duration-500 md:p-10"
              style={{ background: "var(--ink)" }}
            >
              <div className="flex items-center justify-between">
                <span className="num text-xs on-dark-muted">
                  {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px w-10 transition-all duration-500 group-hover:w-16"
                  style={{ background: "var(--brand-orange)" }}
                />
              </div>
              <h3 className="mt-8 font-serif text-2xl leading-snug on-dark md:text-[1.65rem]">
                {p.name}
              </h3>
              <p className="mt-5 text-[0.95rem] leading-relaxed on-dark-muted">
                {p.description}
              </p>
              <div className="mt-auto pt-8">
                <div
                  className="flex items-center gap-3 border-t pt-5 text-xs uppercase tracking-[0.24em] on-dark"
                  style={{ borderColor: "var(--on-dark-border)" }}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--brand-orange)" }}
                  />
                  {p.commission}
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}