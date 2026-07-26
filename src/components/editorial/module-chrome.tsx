import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { List, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleChromeSection = { id: string; label: string };

/**
 * Cabeçalho editorial oficial reutilizável — visualmente idêntico ao
 * `JourneyChrome` usado no Manual do Investidor. Todos os módulos
 * editoriais devem consumir este componente para garantir uma única
 * identidade visual (mesmo header, mesma marca V, mesma barra de
 * progresso, mesmo drawer de índice, mesmo fundo).
 */
export function ModuleChrome({
  moduleName,
  sections,
  activeId,
  progressPct = 0,
  label,
  children,
}: {
  moduleName: string;
  sections: ModuleChromeSection[];
  activeId?: string;
  progressPct?: number;
  label?: string;
  children: ReactNode;
}) {
  const [indexOpen, setIndexOpen] = useState(false);

  useEffect(() => {
    if (!indexOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIndexOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [indexOpen]);

  const go = (id: string) => {
    setIndexOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] bg-grain">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--navy-deep)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 gap-4">
          <Link
            to="/"
            className="group flex items-center gap-3 shrink-0"
            aria-label={`Início — ${moduleName}`}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--gold)]/40 text-[color:var(--gold)] font-display text-sm">
              V
            </span>
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                Velox
              </span>
              <span className="text-sm font-medium">{moduleName}</span>
            </span>
          </Link>

          <div className="flex items-center gap-3 min-w-0">
            {label && (
              <span className="hidden md:inline text-xs text-[color:var(--muted-foreground)] truncate">
                {label}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIndexOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition-colors"
            >
              <List className="h-3.5 w-3.5" />
              Índice
            </button>
          </div>
        </div>

        <div className="relative h-[3px] w-full bg-[color:var(--border)]">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[color:var(--gold-soft)] to-[color:var(--gold)] transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {label && (
          <div className="md:hidden mx-auto max-w-5xl px-6 pb-2 pt-1 text-[11px] text-[color:var(--muted-foreground)] text-right">
            {label}
          </div>
        )}
      </header>

      <main className="pt-24 md:pt-28 pb-32">{children}</main>

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
          aria-label="Índice"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-[color:var(--border)]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                {moduleName}
              </p>
              <p className="text-sm mt-1">Índice</p>
            </div>
            <button
              onClick={() => setIndexOpen(false)}
              aria-label="Fechar índice"
              className="rounded-full p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="p-2 overflow-y-auto max-h-[calc(100vh-80px)]">
            {sections.map((s, i) => {
              const current = activeId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(s.id)}
                  className={cn(
                    "w-full text-left block rounded-xl px-4 py-3 transition-colors border border-transparent",
                    current
                      ? "border-[color:var(--gold)]/30 bg-[color:var(--accent)]"
                      : "hover:bg-[color:var(--accent)]/60",
                  )}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "font-display text-xs w-6 shrink-0",
                        current
                          ? "text-[color:var(--gold)]"
                          : "text-[color:var(--muted-foreground)]",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-tight">{s.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    </div>
  );
}