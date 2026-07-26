import type { ReactNode } from "react";
import { Reveal } from "../Reveal";
import { SectionShell, Eyebrow } from "./Chrome";

/**
 * EditorialSection — bloco padrão de leitura em fundo pergaminho ou grafite.
 * Gera título grande + intro editorial + espaço para conteúdo.
 */
export function EditorialSection({
  id,
  chapter,
  eyebrow,
  title,
  lead,
  surface = "paper",
  align = "left",
  watermark,
  children,
}: {
  id: string;
  chapter?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  surface?: "paper" | "graphite" | "ink" | "blue";
  align?: "left" | "center";
  watermark?: boolean;
  children?: ReactNode;
}) {
  const dark = surface !== "paper";
  return (
    <SectionShell id={id} labelledBy={`${id}-title`} surface={surface} watermark={watermark} className="py-28 md:py-40">
      <div className="relative mx-auto max-w-6xl px-6 md:px-10">
        <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
          {chapter && (
            <Reveal>
              <div className={`font-serif text-sm italic ${dark ? "on-dark-muted" : "text-muted-foreground"} ${align === "center" ? "" : ""}`}>
                {chapter}
              </div>
            </Reveal>
          )}
          <Reveal delay={80}>
            <div className={align === "center" ? "mt-4 flex justify-center" : "mt-4"}>
              <Eyebrow tone={dark ? "dark" : "light"}>{eyebrow}</Eyebrow>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <h2
              id={`${id}-title`}
              className={`mt-8 text-balance text-4xl leading-[1.08] sm:text-5xl md:text-6xl ${dark ? "on-dark" : "text-foreground"}`}
            >
              {title}
            </h2>
          </Reveal>
          {lead && (
            <Reveal delay={240}>
              <p className={`mt-8 max-w-[62ch] text-lg leading-relaxed ${align === "center" ? "mx-auto" : ""} ${dark ? "on-dark-muted" : "text-muted-foreground"}`}>
                {lead}
              </p>
            </Reveal>
          )}
        </div>
        {children && <div className="mt-16 md:mt-20">{children}</div>}
      </div>
    </SectionShell>
  );
}

/**
 * Prose — coluna editorial com medida controlada. Recebe children arbitrários.
 */
export function Prose({
  children,
  dark = false,
  className = "",
  dropCap = false,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  dropCap?: boolean;
}) {
  return (
    <div
      className={`max-w-[62ch] space-y-6 text-lg leading-relaxed ${
        dark ? "on-dark-muted" : "text-muted-foreground"
      } ${dropCap ? "[&>p:first-of-type]:drop-cap" : ""} ${className}`}
    >
      {children}
    </div>
  );
}