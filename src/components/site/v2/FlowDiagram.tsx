import { Reveal } from "../Reveal";

export type FlowStep = {
  /** Marcador numérico (01, 02, …). */
  marker: string;
  title: string;
  description: string;
};

/**
 * FlowDiagram — diagrama horizontal simples usado para explicar, em
 * poucos blocos, como uma operação acontece na prática. No mobile os
 * blocos empilham; nenhuma informação depende de hover.
 */
export function FlowDiagram({
  steps,
  dark = false,
}: {
  steps: FlowStep[];
  dark?: boolean;
}) {
  return (
    <ol
      className="grid gap-px overflow-hidden border sm:grid-cols-2 lg:grid-cols-4"
      style={{
        background: dark ? "var(--on-dark-border)" : "var(--paper-edge)",
        borderColor: dark ? "var(--on-dark-border)" : "var(--paper-edge)",
      }}
    >
      {steps.map((s, i) => (
        <Reveal key={s.marker} delay={i * 80}>
          <li
            className="flex h-full flex-col p-8 md:p-10"
            style={{ background: dark ? "var(--ink)" : "var(--paper-2)" }}
          >
            <div className="flex items-center gap-4">
              <span
                className="num text-4xl leading-none"
                style={{ color: "var(--brand-orange)" }}
              >
                {s.marker}
              </span>
              <span
                aria-hidden="true"
                className="h-px flex-1"
                style={{ background: "var(--brand-orange)", opacity: 0.5 }}
              />
            </div>
            <h3
              className={`mt-7 font-serif text-2xl leading-snug ${dark ? "on-dark" : "text-foreground"}`}
            >
              {s.title}
            </h3>
            <p
              className={`mt-4 text-sm leading-relaxed ${dark ? "on-dark-muted" : "text-muted-foreground"}`}
            >
              {s.description}
            </p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}
