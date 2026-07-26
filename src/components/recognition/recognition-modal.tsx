/**
 * RecognitionModal — modal universal do Achievement & Recognition Engine.
 * Elegante, centralizado, com fundo desfocado e confetes leves. Não fecha
 * automaticamente: só sai quando o usuário confirma o CTA.
 */
import type { RecognitionEvent } from "@/lib/recognition/engine";
import { templateFor } from "@/lib/recognition/templates";
import { Confetti } from "./confetti";

export function RecognitionModal({
  event,
  onContinue,
}: {
  event: RecognitionEvent;
  onContinue: () => void;
}) {
  const tpl = templateFor(event);
  const message = tpl.message.split("\n\n");
  const quiet = tpl.variant === "quiet";

  if (quiet) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recognition-title"
        className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      >
        <div className="absolute inset-0 bg-[color:var(--navy-deep)]/60 backdrop-blur-sm animate-[fade-in_0.25s_ease-out]" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/95 p-7 text-left shadow-xl animate-[fade-in_0.3s_ease-out]">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/60 text-lg"
              aria-hidden
            >
              {tpl.emoji}
            </span>
            <h2
              id="recognition-title"
              className="font-display text-lg text-[color:var(--foreground)]"
            >
              {tpl.title}
            </h2>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            {message.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
            >
              Depois
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--gold)] px-5 py-1.5 text-xs font-medium text-[color:var(--navy-deep)] hover:bg-[color:var(--gold)]/90 transition"
            >
              {tpl.ctaLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recognition-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-[color:var(--navy-deep)]/70 backdrop-blur-md animate-[fade-in_0.4s_ease-out]" />
      <Confetti active />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-[color:var(--gold)]/30 bg-gradient-to-b from-[color:var(--navy)] to-[color:var(--navy-deep)] p-8 text-center shadow-2xl animate-[scale-in_0.35s_ease-out]"
        style={{ boxShadow: "0 20px 60px -20px rgba(212,175,55,0.25), 0 0 0 1px rgba(212,175,55,0.15) inset" }}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(212,175,55,0.25), rgba(212,175,55,0.05))",
            border: "1px solid rgba(212,175,55,0.35)",
          }}
          aria-hidden
        >
          {tpl.emoji}
        </div>
        <h2
          id="recognition-title"
          className="font-display text-2xl mt-5 text-[color:var(--foreground)]"
        >
          {tpl.title}
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          {message.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="mt-7 inline-flex items-center justify-center rounded-full bg-[color:var(--gold)] px-8 py-2.5 text-sm font-medium text-[color:var(--navy-deep)] hover:bg-[color:var(--gold)]/90 transition"
        >
          {tpl.ctaLabel}
        </button>
      </div>
    </div>
  );
}