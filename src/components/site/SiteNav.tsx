import { useEffect, useState } from "react";
import veloxLogo from "@/assets/editorial/velox-logo.png.asset.json";

export type NavSection = { id: string; label: string };

const roman = (n: number) => {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let x = n;
  for (const [v, s] of map) while (x >= v) { out += s; x -= v; }
  return out;
};

export function SiteNav({ sections, activeId }: { sections: NavSection[]; activeId: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeIndex = Math.max(0, sections.findIndex((s) => s.id === activeId));
  const activeSection = sections[activeIndex];

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
          scrolled
            ? "border-b border-border/60 bg-background/85 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 px-6 py-5 md:px-10">
          <button
            onClick={() => go(sections[0]?.id ?? "")}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Voltar ao início"
          >
            <img
              src={veloxLogo.url}
              alt="Velox Soluções Financeiras"
              className={`h-7 w-auto object-contain transition-all duration-500 md:h-8 ${
                scrolled ? "opacity-100" : "opacity-95"
              }`}
              style={{ filter: scrolled ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,.15))" }}
            />
          </button>

          <div className="hidden min-w-0 items-center justify-center gap-4 text-center sm:flex">
            <span className="eyebrow shrink-0">
              {roman(activeIndex + 1)} · {String(activeIndex + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}
            </span>
            <span className="hidden h-px w-8 bg-border md:block" />
            <span className="hidden truncate font-serif text-sm italic text-muted-foreground md:block">
              {activeSection?.label}
            </span>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="group flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-foreground transition-colors"
            aria-label="Abrir sumário"
            aria-expanded={open}
          >
            <span className="hidden sm:inline">Sumário</span>
            <span className="flex flex-col items-end gap-[5px]">
              <span className="block h-px w-6 bg-foreground transition-all group-hover:w-8" />
              <span className="block h-px w-4 bg-foreground transition-all group-hover:w-8" />
            </span>
          </button>
        </div>
      </header>

      {/* Sumário overlay */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-500 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-background/95 backdrop-blur-xl"
          onClick={() => setOpen(false)}
        />
        <div className="relative flex h-dvh flex-col">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 md:px-10">
            <span className="eyebrow">Sumário</span>
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-foreground"
              aria-label="Fechar sumário"
            >
              <span className="hidden sm:inline">Fechar</span>
              <span className="relative block h-4 w-4">
                <span className="absolute left-0 top-1/2 block h-px w-4 -translate-y-1/2 rotate-45 bg-foreground" />
                <span className="absolute left-0 top-1/2 block h-px w-4 -translate-y-1/2 -rotate-45 bg-foreground" />
              </span>
            </button>
          </div>
          <nav className="mx-auto grid w-full max-w-7xl flex-1 content-center gap-1 overflow-y-auto px-6 py-8 md:grid-cols-2 md:px-10">
            {sections.map((s, i) => {
              const active = s.id === activeId;
              return (
                <button
                  key={s.id}
                  onClick={() => go(s.id)}
                  className={`group grid grid-cols-[3rem_1fr_auto] items-baseline gap-6 border-b border-border/60 py-4 text-left transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="font-serif text-sm italic text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-2xl md:text-3xl">{s.label}</span>
                  <span
                    className={`h-px bg-accent transition-all duration-500 ${
                      active ? "w-10" : "w-0 group-hover:w-6"
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}