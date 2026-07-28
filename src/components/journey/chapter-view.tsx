import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Chapter } from "@/lib/journey-data";
import { TOTAL_CHAPTERS } from "@/lib/journey-data";
import { VideoSlot } from "./video-slot";
import { emitEvent } from "@/lib/events/bus";
import { getCurrentInvestorId } from "@/lib/portal-session";

export function ChapterView({
  chapter,
  children,
  hideContinue,
  completionOverride,
}: {
  chapter: Chapter;
  children?: ReactNode;
  hideContinue?: boolean;
  completionOverride?: ReactNode;
}) {
  useEffect(() => {
    const investorId = getCurrentInvestorId();
    if (!investorId) return;
    if (chapter.index === 1) {
      emitEvent({
        type: "manual.started",
        investorId,
        payload: { chapterSlug: chapter.slug, chapterTitle: chapter.title },
      });
    }
    emitEvent({
      type: "manual.chapter.completed",
      investorId,
      payload: {
        chapterSlug: chapter.slug,
        chapterTitle: chapter.title,
        index: chapter.index,
        total: TOTAL_CHAPTERS,
      },
    });
    if (chapter.isFinal) {
      emitEvent({
        type: "manual.completed",
        investorId,
        payload: { total: TOTAL_CHAPTERS },
      });
    }
  }, [chapter.index, chapter.isFinal, chapter.slug, chapter.title]);

  return (
    <article
      key={chapter.slug}
      className="animate-chapter-enter mx-auto max-w-3xl px-6"
    >
      {chapter.transitionFromPrev && (
        <p className="text-center text-sm italic text-[color:var(--muted-foreground)]/80 mb-8">
          {chapter.transitionFromPrev}
        </p>
      )}

      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)] mb-4">
          {chapter.eyebrow}
        </p>
        <h1 className="font-display text-3xl md:text-5xl leading-[1.08] text-balance">
          {chapter.title}
        </h1>
        <p className="mt-5 text-base md:text-lg text-[color:var(--muted-foreground)] leading-relaxed max-w-2xl text-balance">
          {chapter.subtitle}
        </p>
      </header>

      {chapter.hasVideo && (
        <div className="mb-12">
          <VideoSlot />
        </div>
      )}

      <div className="prose-invert space-y-8">{children}</div>

      {completionOverride ??
        (chapter.completionLine && (
          <div className="mt-16 rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--card)]/50 px-6 py-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[color:var(--gold)] shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <p className="font-medium">Capítulo {chapter.index} concluído.</p>
                <p className="text-[color:var(--muted-foreground)]">{chapter.completionLine}</p>
                {chapter.nextTeaser && (
                  <p className="text-[color:var(--muted-foreground)]/80 mt-1 italic">
                    {chapter.nextTeaser}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

      {!hideContinue && chapter.nextPath && (
        <div className="mt-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
          {chapter.prevPath ? (
            <Link
              to={chapter.prevPath}
              preload="intent"
              className="inline-flex items-center gap-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors self-start"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao capítulo anterior
            </Link>
          ) : (
            <span />
          )}

          <Link
            to={chapter.nextPath}
            preload="intent"
            className="group inline-flex items-center justify-center gap-3 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-7 py-3.5 text-sm font-medium text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition-all duration-300 hover:shadow-[0_10px_40px_-10px_var(--gold)] animate-soft-pulse"
          >
            {chapter.continueLabel ?? "Continuar"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </article>
  );
}
