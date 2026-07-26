import type { ReactNode } from "react";

export function Section({
  id,
  chapter,
  eyebrow,
  title,
  intro,
  children,
  tone = "light",
  pattern,
}: {
  id: string;
  chapter?: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  children?: ReactNode;
  tone?: "light" | "muted" | "dark";
  pattern?: "none" | "grid" | "dots" | "paper";
}) {
  const toneClass =
    tone === "muted"
      ? "bg-secondary text-foreground"
      : tone === "dark"
        ? "text-[var(--ink-foreground)]"
        : "bg-background text-foreground";
  const toneStyle =
    tone === "dark" ? { background: "var(--grad-ink-hero)" } : undefined;
  const resolvedPattern =
    pattern ?? (tone === "dark" ? "grid" : tone === "muted" ? "dots" : "paper");
  const patternClass =
    resolvedPattern === "grid"
      ? tone === "dark"
        ? "bg-grid-ink opacity-60"
        : "bg-grid opacity-70"
      : resolvedPattern === "dots"
        ? tone === "dark"
          ? "bg-dots-ink opacity-70"
          : "bg-dots opacity-50"
        : resolvedPattern === "paper"
          ? ""
          : "";
  const paperStyle =
    resolvedPattern === "paper" && tone !== "dark"
      ? { background: "var(--grad-paper)" }
      : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? `${id}-title` : undefined}
      data-tone={tone}
      className={`relative isolate scroll-mt-24 overflow-hidden py-24 md:py-36 lg:py-40 ${toneClass}`}
      style={toneStyle}
    >
      {resolvedPattern === "paper" && (
        <div className="absolute inset-0 -z-10" style={paperStyle} aria-hidden="true" />
      )}
      {patternClass && (
        <div className={`absolute inset-0 -z-10 ${patternClass}`} aria-hidden="true" />
      )}
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid gap-10 md:grid-cols-12 md:gap-16">
          <aside className="md:col-span-3">
            <div className="space-y-2 md:sticky md:top-28">
              {chapter && (
                <div className={`font-serif text-sm italic ${tone === "dark" ? "text-[var(--ink-muted)]" : "text-muted-foreground"}`}>
                  {chapter}
                </div>
              )}
              {eyebrow && (
                <div className={`eyebrow ${tone === "dark" ? "text-[var(--ink-muted)]" : ""}`}>
                  {eyebrow}
                </div>
              )}
              <div
                className="mt-4 h-px w-10"
                style={{ background: "var(--brand-orange)" }}
                aria-hidden="true"
              />
            </div>
          </aside>

          <div className="md:col-span-9">
            {title && (
              <h2
                id={`${id}-title`}
                className={`max-w-3xl text-balance text-3xl leading-[1.15] sm:text-4xl md:text-5xl ${tone === "dark" ? "text-[var(--ink-foreground)]" : ""}`}
              >
                {title}
              </h2>
            )}
            {intro && (
              <p className={`mt-8 max-w-[62ch] text-lg leading-relaxed ${tone === "dark" ? "text-[var(--ink-muted)]" : "text-muted-foreground"}`}>
                {intro}
              </p>
            )}
            {children && <div className="mt-12 md:mt-16">{children}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Placeholder({
  label,
  ratio = "16 / 10",
  className = "",
}: {
  label: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex items-center justify-center border border-dashed border-border bg-muted/50 text-center ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <span className="eyebrow px-4">{label}</span>
    </div>
  );
}

export function TextPlaceholder({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-2.5 rounded-full bg-muted"
          style={{ width: `${92 - i * 7}%` }}
        />
      ))}
    </div>
  );
}