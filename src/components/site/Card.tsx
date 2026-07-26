import type { ReactNode } from "react";

export function Card({
  eyebrow,
  title,
  children,
  footer,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex h-full flex-col border border-border bg-card p-8 transition-shadow duration-500 hover:shadow-[var(--shadow-soft)] md:p-10 ${className}`}
    >
      {eyebrow && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="h-px w-6" style={{ background: "var(--gold)" }} aria-hidden="true" />
          <span className="eyebrow">{eyebrow}</span>
        </div>
      )}
      {title && (
        <div className="mt-6 font-serif text-2xl leading-snug text-foreground">
          {title}
        </div>
      )}
      {children && (
        <div className="mt-6 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
      {footer && (
        <div className="mt-auto pt-8">
          <div className="flex items-center gap-3 border-t border-border pt-5 text-xs uppercase tracking-[0.24em] text-foreground">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--gold)" }}
              aria-hidden="true"
            />
            {footer}
          </div>
        </div>
      )}
    </article>
  );
}