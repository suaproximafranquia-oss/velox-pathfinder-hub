import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { List, X } from "lucide-react";
import { CHAPTERS, getChapterByPath, TOTAL_CHAPTERS } from "@/lib/journey-data";
import { useJourneyProgress } from "@/hooks/use-journey-progress";
import { cn } from "@/lib/utils";

export function JourneyChrome({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const chapter = getChapterByPath(pathname);
  const isConcluded = pathname === "/manual/concluido";
  const [indexOpen, setIndexOpen] = useState(false);
  const { progress, markVisited, hydrated } = useJourneyProgress();

  useEffect(() => {
    if (chapter) markVisited(chapter.slug);
    if (isConcluded) markVisited("concluido");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => setIndexOpen(false), [pathname]);

  const progressPct = useMemo(() => {
    if (isConcluded) return 100;
    if (!chapter) return 0;
    return Math.round(((chapter.index - 1) / (TOTAL_CHAPTERS - 1)) * 100);
  }, [chapter, isConcluded]);

  const label = isConcluded
    ? "Jornada concluída"
    : chapter
      ? `Capítulo ${chapter.index} de ${TOTAL_CHAPTERS} · ~${chapter.minutesLeft} min restantes`
      : "";

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] bg-grain">
      {/* Fixed premium header */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--navy-deep)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 gap-4">
          <Link
            to="/"
            className="group flex items-center gap-3 shrink-0"
            aria-label="Início do Manual do Investidor"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--gold)]/40 text-[color:var(--gold)] font-display text-sm">
              V
            </span>
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]/80">
                Velox
              </span>
              <span className="text-sm font-medium text-[color:var(--navy-foreground)]">
                Manual do Investidor
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden md:inline text-xs font-medium text-[color:var(--navy-foreground)]/85 truncate">
              {label}
            </span>
            <button
              type="button"
              onClick={() => setIndexOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--gold)]/15 px-3.5 py-1.5 text-xs font-medium text-[color:var(--gold)] hover:bg-[color:var(--gold)]/25 hover:border-[color:var(--gold)] transition-colors"
            >
              <List className="h-3.5 w-3.5" />
              Índice
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-[3px] w-full bg-[color:var(--border)]">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[color:var(--gold-soft)] to-[color:var(--gold)] transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="md:hidden mx-auto max-w-5xl px-6 pb-2 pt-1 text-[11px] font-medium text-[color:var(--navy-foreground)]/85 text-right">
          {label}
        </div>
      </header>

      {/* Main content region — Outlet swaps here */}
      <main className="pt-24 md:pt-28 pb-32">
        {children}
      </main>

      {/* Index drawer — right side sheet */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity",
          indexOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!indexOpen}
      >
        <div
          className="absolute inset-0 bg-[color:var(--navy-deep)]/70 backdrop-blur-sm"
          onClick={() => setIndexOpen(false)}
        />
        <aside
          className={cn(
            "absolute right-0 top-0 h-full w-full max-w-sm border-l border-[color:var(--border)] bg-[color:var(--navy)] shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
            indexOpen ? "translate-x-0" : "translate-x-full",
          )}
          aria-label="Índice dos capítulos"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[color:var(--border)]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--navy-foreground)]/70">
                Sua jornada
              </p>
              <p className="text-sm mt-1 text-[color:var(--navy-foreground)]">{progressPct}% concluído</p>
            </div>
            <button
              onClick={() => setIndexOpen(false)}
              aria-label="Fechar índice"
              className="rounded-full p-2 text-[color:var(--navy-foreground)]/70 hover:text-[color:var(--navy-foreground)] hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="p-2 overflow-y-auto max-h-[calc(100vh-80px)]">
            {CHAPTERS.map((c) => {
              const visited = hydrated && progress.visited.includes(c.slug);
              const current = chapter?.slug === c.slug;
              return (
                <Link
                  key={c.slug}
                  to={c.path}
                  preload="intent"
                  className={cn(
                    "block rounded-xl px-4 py-3 transition-colors border border-transparent",
                    current
                      ? "border-[color:var(--gold)]/30 bg-white/10"
                      : "hover:bg-white/5",
                  )}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "font-display text-xs w-6 shrink-0",
                        current
                          ? "text-[color:var(--gold)]"
                          : visited
                            ? "text-[color:var(--navy-foreground)]"
                            : "text-[color:var(--navy-foreground)]/60",
                      )}
                    >
                      {String(c.index).padStart(2, "0")}
                    </span>
                    <span className={cn(
                      "text-sm leading-tight",
                      current
                        ? "text-[color:var(--navy-foreground)]"
                        : visited
                          ? "text-[color:var(--navy-foreground)]/90"
                          : "text-[color:var(--navy-foreground)]/70",
                    )}>
                      {c.eyebrow.split("·")[1]?.trim() ?? c.eyebrow}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>

    </div>
  );
}
