/**
 * Chrome padrão de todos os overlays do Portal Velox.
 *
 * Centraliza abertura, fechamento, animação, bloqueio de scroll, tecla
 * Escape e botão de fechar — garantindo que Manual, Material
 * Institucional, Simulador, Agenda e Gateway se comportem como uma
 * única aplicação.
 */
import { useEffect } from "react";
import { X } from "lucide-react";

export function PortalOverlayShell({
  open,
  title,
  onClose,
  size = "full",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** `full` para módulos de leitura, `dialog` para fluxos curtos. */
  size?: "full" | "dialog";
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const frame =
    size === "full"
      ? "absolute inset-x-[3vw] top-[3vh] bottom-[3vh] rounded-2xl"
      : "absolute inset-x-4 top-[4vh] bottom-[4vh] mx-auto w-auto max-w-2xl rounded-3xl md:inset-x-0";

  return (
    <div
      className={
        "fixed inset-0 z-[70] transition-opacity duration-500 " +
        (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
      }
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label={`Fechar ${title}`}
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: "color-mix(in oklab, var(--ink) 55%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          frame +
          " overflow-hidden border shadow-2xl transition-all duration-500 " +
          (open ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.98] opacity-0")
        }
        style={{
          borderColor: "color-mix(in oklab, var(--paper) 25%, transparent)",
          background: "var(--paper)",
          boxShadow: "0 60px 120px -30px color-mix(in oklab, var(--ink) 70%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition hover:scale-105"
          style={{
            borderColor: "color-mix(in oklab, var(--paper) 40%, transparent)",
            background: "color-mix(in oklab, var(--ink) 55%, transparent)",
            color: "var(--paper)",
          }}
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
