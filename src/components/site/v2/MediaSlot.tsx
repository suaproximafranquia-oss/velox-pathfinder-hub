import { Camera, Film } from "lucide-react";

/**
 * MediaSlot — espaço PLANEJADO para mídia real (foto ou vídeo) que ainda
 * não foi fornecida. Nunca preenche com imagem genérica: exibe um
 * placeholder editorial claramente identificado, fácil de substituir.
 *
 * Para substituir: troque <MediaSlot .../> pela <figure> com a mídia real,
 * mantendo o mesmo `ratio` para preservar o ritmo da página.
 */
export function MediaSlot({
  kind = "foto",
  label,
  note,
  ratio = "16 / 9",
  tone = "dark",
}: {
  kind?: "foto" | "video";
  label: string;
  note?: string;
  ratio?: string;
  tone?: "dark" | "light";
}) {
  const Icon = kind === "video" ? Film : Camera;
  const dark = tone === "dark";
  return (
    <div
      className="relative overflow-hidden border"
      style={{
        aspectRatio: ratio,
        borderColor: dark ? "var(--on-dark-border)" : "var(--paper-edge)",
        background: dark
          ? "color-mix(in oklab, var(--ink) 88%, transparent)"
          : "var(--paper-2)",
      }}
      data-media-slot={kind}
      aria-label={`Espaço reservado para ${kind === "video" ? "vídeo" : "foto"}: ${label}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${dark ? "bg-diag-ink opacity-40" : "bg-diag opacity-50"}`}
      />
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full border"
          style={{
            borderColor: "var(--brand-orange)",
            color: "var(--brand-orange)",
          }}
        >
          <Icon className="h-6 w-6" strokeWidth={1.25} />
        </span>
        <span
          className={`text-[0.68rem] uppercase tracking-[0.3em] ${dark ? "on-dark-muted" : "text-muted-foreground"}`}
        >
          {kind === "video" ? "Espaço para vídeo" : "Espaço para foto"}
        </span>
        <span
          className={`max-w-[38ch] font-serif text-lg italic leading-snug ${dark ? "on-dark" : "text-foreground"}`}
        >
          {label}
        </span>
        {note && (
          <span
            className={`max-w-[46ch] text-xs leading-relaxed ${dark ? "on-dark-muted" : "text-muted-foreground"}`}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}
