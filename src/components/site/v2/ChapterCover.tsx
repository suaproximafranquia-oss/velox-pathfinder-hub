import { Reveal } from "../Reveal";
import { VMark } from "../VMark";
import { EdgeRule } from "./Chrome";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/**
 * ChapterCover — abertura cinematográfica de capítulo.
 * Fundo escuro/institucional, numeração romana gigante, título serifado
 * imenso, kicker com filete e frase de transição.
 */
export function ChapterCover({
  id,
  number,
  kicker,
  title,
  lead,
  image,
  imageAlt,
  surface = "ink",
}: {
  id?: string;
  number: number;
  kicker: string;
  title: string;
  lead: string;
  image?: string;
  imageAlt?: string;
  surface?: "ink" | "graphite" | "blue";
}) {
  const surfaceClass =
    surface === "graphite"
      ? "surface-graphite"
      : surface === "blue"
        ? "surface-blue"
        : "surface-ink";
  return (
    <section
      id={id}
      aria-label={`Capítulo ${ROMAN[number - 1]} — ${title}`}
      className={`relative isolate overflow-hidden ${surfaceClass}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-60" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-25 mix-blend-overlay" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-20 h-[36rem] w-[36rem] rounded-full opacity-30 blur-3xl animate-drift"
        style={{ background: "color-mix(in oklab, var(--brand-blue) 60%, transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 h-[32rem] w-[32rem] rounded-full opacity-30 blur-3xl animate-drift"
        style={{ background: "color-mix(in oklab, var(--brand-orange) 45%, transparent)", animationDelay: "8s" }}
      />

      {image && (
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <img
            src={image}
            alt={imageAlt ?? ""}
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in oklab, var(--ink) 55%, transparent), var(--ink) 90%)",
            }}
          />
        </div>
      )}

      <div className="relative mx-auto grid max-w-7xl gap-16 px-6 py-32 md:grid-cols-12 md:gap-20 md:px-10 md:py-48">
        <div className="md:col-span-4">
          <Reveal>
            <div className="relative">
              <span
                className="num block text-[10rem] leading-none opacity-[0.14] md:text-[16rem]"
                aria-hidden="true"
              >
                {String(number).padStart(2, "0")}
              </span>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-40 w-40 md:h-52 md:w-52" style={{ color: "var(--brand-orange)" }}>
                  <VMark className="h-full w-full animate-vfloat" strokeWidth={1.1} />
                  <span className="absolute inset-0 flex items-center justify-center font-serif text-5xl italic on-dark md:text-6xl">
                    {ROMAN[number - 1]}
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="md:col-span-8">
          <Reveal delay={80}>
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="h-px w-10"
                style={{ background: "var(--brand-orange)" }}
              />
              <span className="eyebrow eyebrow-on-dark">
                Capítulo {ROMAN[number - 1]} · {kicker}
              </span>
            </div>
          </Reveal>
          <Reveal delay={180}>
            <h2 className="mt-8 text-balance font-serif text-4xl leading-[1.05] on-dark sm:text-5xl md:text-6xl">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-10 max-w-[54ch] font-serif text-xl italic leading-relaxed on-dark-muted md:text-2xl">
              “{lead}”
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="mt-12">
              <EdgeRule tone="dark" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}