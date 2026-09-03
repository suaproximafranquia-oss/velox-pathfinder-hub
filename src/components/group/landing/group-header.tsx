/**
 * Cabeçalho fixo da landing institucional do Grupo Velox.
 * Navegação exclusivamente por âncoras da própria página — sem link
 * para Portal do Investidor e sem "Fale Conosco".
 */
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { assetUrl } from "@/lib/assets/registry";
import { GROUP_SECTIONS } from "./group-content";

const logo = assetUrl("logo-velox");

export function GroupHeader({ activeId }: { activeId: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/10 bg-[#050b1a]/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 md:px-10">
        <button onClick={() => go("inicio")} className="flex items-center" aria-label="Início">
          <img src={logo} alt="Grupo Velox" className="h-8 w-auto object-contain md:h-9" />
        </button>

        <nav className="hidden items-center gap-9 md:flex">
          {GROUP_SECTIONS.map((s) => {
            const active = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={`relative py-1 text-sm transition-colors ${
                  active ? "text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {s.label}
                <span
                  className={`absolute -bottom-0.5 left-0 h-px bg-[#e8873a] transition-all duration-300 ${
                    active ? "w-full" : "w-0"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <button
          className="text-white/80 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <nav className="border-t border-white/10 bg-[#050b1a]/95 px-6 py-4 md:hidden">
          {GROUP_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className="block w-full border-b border-white/5 py-3 text-left text-sm text-white/80 last:border-0"
            >
              {s.label}
            </button>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
