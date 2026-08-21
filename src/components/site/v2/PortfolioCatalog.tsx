import { Reveal } from "../Reveal";

export type PortfolioItem = {
  name: string;
  description: string;
  /** Remuneração oficial já praticada pela rede (texto verbatim). */
  commission: string;
};

export type PortfolioCategory = {
  /** Ex.: "Crédito", "Consórcio", "Proteção", "Energia". */
  name: string;
  summary: string;
  items: PortfolioItem[];
};

/**
 * PortfolioCatalog — apresenta o portfólio agrupado por CATEGORIA de
 * necessidade do cliente (crédito, consórcio, proteção, energia, outras
 * soluções). Substitui a "parede de produtos": o investidor entende
 * primeiro a lógica de diversificação e depois o detalhe de cada solução.
 */
export function PortfolioCatalog({ categories }: { categories: PortfolioCategory[] }) {
  return (
    <div className="space-y-12">
      {categories.map((cat, ci) => (
        <Reveal key={cat.name} delay={ci * 60}>
          <section>
            <header
              className="flex flex-col gap-3 border-b pb-6 md:flex-row md:items-end md:justify-between"
              style={{ borderColor: "var(--on-dark-border)" }}
            >
              <div className="flex items-baseline gap-5">
                <span className="num text-xs on-dark-muted">
                  {String(ci + 1).padStart(2, "0")}
                </span>
                <h3 className="font-serif text-3xl on-dark md:text-4xl">{cat.name}</h3>
              </div>
              <p className="max-w-[52ch] text-sm leading-relaxed on-dark-muted">{cat.summary}</p>
            </header>

            <ul
              className="mt-px grid gap-px overflow-hidden md:grid-cols-2"
              style={{ background: "var(--on-dark-border)" }}
            >
              {cat.items.map((it) => (
                <li
                  key={it.name}
                  className="flex h-full flex-col p-7 md:p-8"
                  style={{ background: "var(--ink)" }}
                >
                  <div className="flex items-start justify-between gap-6">
                    <span className="font-serif text-xl leading-snug on-dark">{it.name}</span>
                    <span
                      className="shrink-0 whitespace-nowrap text-[0.65rem] uppercase tracking-[0.2em]"
                      style={{ color: "var(--brand-orange)" }}
                    >
                      {it.commission}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed on-dark-muted">{it.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      ))}
    </div>
  );
}
