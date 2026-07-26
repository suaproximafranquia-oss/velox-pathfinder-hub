import { Reveal } from "./Reveal";
import { VMark } from "./VMark";

export function Photo({
  src,
  alt,
  ratio = "16 / 10",
  caption,
  eager = false,
  className = "",
}: {
  src: string;
  alt: string;
  ratio?: string;
  caption?: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div
        className="group relative overflow-hidden bg-muted shadow-[var(--shadow-frame)]"
        style={{ aspectRatio: ratio }}
      >
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.02]"
        />
        <span
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute left-0 top-0 h-6 w-6 border-l border-t"
          style={{ borderColor: "var(--brand-orange)" }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute bottom-0 right-0 h-6 w-6 border-b border-r"
          style={{ borderColor: "var(--brand-orange)" }}
          aria-hidden="true"
        />
      </div>
      {caption && (
        <figcaption className="mt-4 flex items-center gap-3 font-serif text-sm italic text-muted-foreground">
          <span className="h-px w-6" style={{ background: "var(--gold)" }} aria-hidden="true" />
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function PullQuote({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <section
      className={`relative isolate overflow-hidden ${
        dark
          ? "bg-[var(--ink)] text-[var(--ink-foreground)]"
          : "bg-background text-foreground"
      }`}
      style={dark ? { background: "var(--grad-ink-hero)" } : undefined}
    >
      <div
        className={`absolute inset-0 ${dark ? "bg-dots-ink opacity-70" : "bg-dots opacity-60"}`}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-4xl px-6 py-24 text-center md:px-10 md:py-32">
        <div
          className={`pointer-events-none mx-auto mb-10 h-12 w-12 ${dark ? "text-[var(--brand-orange)]" : "text-[var(--brand-blue)]"}`}
          aria-hidden="true"
        >
          <VMark className="h-full w-full" strokeWidth={1.2} />
        </div>
        <Reveal>
          <blockquote
            className={`font-serif text-2xl italic leading-[1.35] sm:text-3xl md:text-4xl ${
              dark ? "text-[var(--ink-foreground)]" : "text-foreground"
            }`}
          >
            {children}
          </blockquote>
          <span
            className="mx-auto mt-10 block h-px w-16"
            style={{ background: "var(--gold)" }}
            aria-hidden="true"
          />
        </Reveal>
      </div>
    </section>
  );
}