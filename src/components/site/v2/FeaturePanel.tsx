import type { ReactNode } from "react";
import { Reveal } from "../Reveal";
import { SectionShell, Eyebrow } from "./Chrome";

/**
 * FeaturePanel — 2 colunas com imagem editorial + coluna de texto.
 * Alterna orientação (reverse), suporta superfícies claras e escuras.
 */
export function FeaturePanel({
  id,
  chapter,
  eyebrow,
  title,
  image,
  imageAlt,
  imageCaption,
  imageRatio = "4 / 5",
  reverse = false,
  surface = "paper",
  children,
}: {
  id?: string;
  chapter?: string;
  eyebrow: string;
  title: string;
  image: string;
  imageAlt: string;
  imageCaption?: string;
  imageRatio?: string;
  reverse?: boolean;
  surface?: "paper" | "graphite" | "ink" | "blue";
  children: ReactNode;
}) {
  const dark = surface !== "paper";
  return (
    <SectionShell id={id} labelledBy={id ? `${id}-title` : undefined} surface={surface} className="py-28 md:py-40" watermark={dark}>
      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 md:grid-cols-12 md:gap-20 md:px-10">
        <Reveal className={`md:col-span-6 ${reverse ? "md:order-2" : ""}`}>
          <figure className="relative">
            <div
              className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]"
              style={{ aspectRatio: imageRatio }}
            >
              <img
                src={image}
                alt={imageAlt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-out hover:scale-[1.03]"
              />
              <span
                className="pointer-events-none absolute inset-0 ring-1 ring-inset"
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
                aria-hidden="true"
              />
            </div>
            {imageCaption && (
              <figcaption
                className={`mt-5 flex items-center gap-3 font-serif text-sm italic ${
                  dark ? "on-dark-muted" : "text-muted-foreground"
                }`}
              >
                <span className="h-px w-6" style={{ background: "var(--brand-orange)" }} aria-hidden="true" />
                {imageCaption}
              </figcaption>
            )}
          </figure>
        </Reveal>

        <Reveal delay={120} className="md:col-span-6">
          <div className="flex h-full flex-col justify-center">
            {chapter && (
              <div className={`mb-4 font-serif text-sm italic ${dark ? "on-dark-muted" : "text-muted-foreground"}`}>
                {chapter}
              </div>
            )}
            <Eyebrow tone={dark ? "dark" : "light"}>{eyebrow}</Eyebrow>
            {id && (
              <h2
                id={`${id}-title`}
                className={`mt-6 text-balance text-3xl leading-[1.1] sm:text-4xl md:text-5xl ${
                  dark ? "on-dark" : "text-foreground"
                }`}
              >
                {title}
              </h2>
            )}
            {!id && (
              <h3
                className={`mt-6 text-balance text-3xl leading-[1.1] sm:text-4xl md:text-5xl ${
                  dark ? "on-dark" : "text-foreground"
                }`}
              >
                {title}
              </h3>
            )}
            <div
              className={`mt-8 space-y-5 text-lg leading-relaxed ${
                dark ? "on-dark-muted" : "text-muted-foreground"
              }`}
            >
              {children}
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}