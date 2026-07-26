import type { ReactNode } from "react";

/**
 * Chrome — utilitário de escopo visual usado por várias seções V2.
 * Aplica uma "moldura editorial" com detalhes em cobre nas laterais.
 */
export function EdgeRule({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`block h-px w-16 ${className}`}
      style={{
        background:
          tone === "dark"
            ? "linear-gradient(90deg, transparent, var(--brand-orange), transparent)"
            : "var(--brand-orange)",
      }}
    />
  );
}

export function Eyebrow({
  tone = "light",
  children,
  className = "",
}: {
  tone?: "light" | "dark";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span
        aria-hidden="true"
        className="h-px w-8"
        style={{ background: "var(--brand-orange)" }}
      />
      <span className={`eyebrow ${tone === "dark" ? "eyebrow-on-dark" : ""}`}>{children}</span>
    </div>
  );
}

/**
 * SectionShell — bloco base das seções V2. Aplica superfícies, padrões,
 * marca d'água "V" e espaçamentos consistentes. Não impõe grid: o filho
 * compõe seu próprio layout.
 */
export function SectionShell({
  id,
  labelledBy,
  surface = "paper",
  pattern = "auto",
  watermark = false,
  className = "",
  children,
}: {
  id?: string;
  labelledBy?: string;
  surface?: "paper" | "graphite" | "ink" | "blue";
  pattern?: "auto" | "grid" | "dots" | "diag" | "none";
  watermark?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const surfaceClass =
    surface === "graphite"
      ? "surface-graphite"
      : surface === "ink"
        ? "surface-ink"
        : surface === "blue"
          ? "surface-blue"
          : "surface-paper";
  const dark = surface !== "paper";
  const resolved =
    pattern === "auto" ? (dark ? "grid" : "dots") : pattern;
  const patternClass =
    resolved === "grid"
      ? dark
        ? "bg-grid-ink opacity-70"
        : "bg-grid opacity-60"
      : resolved === "dots"
        ? dark
          ? "bg-dots-ink opacity-60"
          : "bg-dots opacity-45"
        : resolved === "diag"
          ? dark
            ? "bg-diag-ink opacity-70"
            : "bg-diag opacity-70"
          : "";
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`relative isolate scroll-mt-24 overflow-hidden ${surfaceClass} ${className}`}
    >
      {patternClass && (
        <div className={`pointer-events-none absolute inset-0 ${patternClass}`} aria-hidden="true" />
      )}
      {watermark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/2 hidden h-[42rem] w-[42rem] -translate-y-1/2 opacity-[0.06] md:block"
          style={{
            background:
              "radial-gradient(closest-side, currentColor 55%, transparent 60%)",
            color: "var(--brand-blue)",
          }}
        />
      )}
      {children}
    </section>
  );
}