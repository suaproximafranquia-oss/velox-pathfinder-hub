/** Rodapé institucional — camada de marca, sem navegação operacional. */
import { assetUrl } from "@/lib/assets/registry";
import { FOOTER, GROUP_SECTIONS } from "./group-content";

const logo = assetUrl("logo-velox");

export function GroupFooter() {
  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <footer className="border-t border-white/10 bg-[#04091500] bg-[#040915] py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 text-center md:flex-row md:justify-between md:px-10 md:text-left">
        <img src={logo} alt="Grupo Velox" className="h-8 w-auto object-contain" />
        <nav className="flex flex-wrap items-center justify-center gap-6">
          {GROUP_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className="text-xs uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="text-xs text-white/40">
          <p>{FOOTER.line}</p>
          <p className="mt-1">{FOOTER.address}</p>
        </div>
      </div>
    </footer>
  );
}
