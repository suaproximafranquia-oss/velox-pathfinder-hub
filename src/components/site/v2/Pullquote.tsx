import type { ReactNode } from "react";
import { Reveal } from "../Reveal";
import { VMark } from "../VMark";

/**
 * Pullquote — citação em painel institucional.
 */
export function Pullquote({
  children,
  attribution,
  surface = "graphite",
}: {
  children: ReactNode;
  attribution?: string;
  surface?: "graphite" | "ink" | "blue" | "paper";
}) {
  const surfaceClass =
    surface === "ink"
      ? "surface-ink"
      : surface === "blue"
        ? "surface-blue"
        : surface === "paper"
          ? "surface-paper"
          : "surface-graphite";
  const dark = surface !== "paper";
  return (
    <section
      className={`relative isolate overflow-hidden ${surfaceClass}`}
      aria-label={typeof children === "string" ? children : "Citação institucional"}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${dark ? "bg-grid-ink opacity-50" : "bg-dots opacity-40"}`}
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-24 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "color-mix(in oklab, var(--brand-orange) 45%, transparent)" }}
      />
      <div className="relative mx-auto max-w-4xl px-6 py-28 text-center md:px-10 md:py-40">
        <div
          aria-hidden="true"
          className={`mx-auto mb-10 h-14 w-14 ${dark ? "text-[var(--brand-orange)]" : "text-[var(--brand-blue)]"}`}
        >
          <VMark className="h-full w-full" strokeWidth={1.3} />
        </div>
        <Reveal>
          <blockquote
            className={`font-serif text-3xl italic leading-[1.25] sm:text-4xl md:text-[3rem] md:leading-[1.15] ${
              dark ? "on-dark" : "text-foreground"
            }`}
          >
            {children}
          </blockquote>
          {attribution && (
            <div className={`mt-8 eyebrow ${dark ? "eyebrow-on-dark" : ""}`}>{attribution}</div>
          )}
          <span
            aria-hidden="true"
            className="mx-auto mt-10 block h-px w-16"
            style={{ background: "var(--brand-orange)" }}
          />
        </Reveal>
      </div>
    </section>
  );
}