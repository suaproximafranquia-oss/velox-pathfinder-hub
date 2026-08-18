/**
 * REVISTA VELOX — leitor digital editorial de páginas planas.
 *
 * Cada conteúdo é um PAR indivisível (texto + mídia). A cada par os lados
 * se alternam. A navegação é simples: o par atual é substituído pelo próximo
 * com uma transição discreta (fade + leve deslocamento), sem efeito de virada.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Trash2 } from "lucide-react";
import { setReaderFocus } from "@/lib/portal-reader-focus";
import {
  formatEditionCode,
  formatEditionMonth,
  mediaOnLeft,
  spreadsOf,
  type MagazineEdition,
  type MagazinePage,
} from "@/lib/magazine/edition";

const TRANSITION_MS = 320;

export function MagazineReader({
  edition,
  onRead,
  onBack,
  backLabel = "Edições",
  onDeletePage,
}: {
  edition: MagazineEdition;
  onRead?: (detail: string) => void;
  onBack?: () => void;
  backLabel?: string;
  /** Presente apenas na pré-visualização da Gestão. */
  onDeletePage?: (page: MagazinePage) => void;
}) {
  const pages = useMemo(() => spreadsOf(edition.pages), [edition.pages]);
  const [index, setIndex] = useState(0);
  const [transition, setTransition] = useState<{ dir: "next" | "prev"; active: boolean } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => setIndex(0), [edition.id]);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  /** Recolhe elementos externos enquanto a revista está aberta. */
  useEffect(() => {
    setReaderFocus(true);
    return () => setReaderFocus(false);
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (transition?.active) return;
      const next = index + delta;
      if (next < 0 || next > pages.length - 1) return;
      const dir = delta > 0 ? "next" : "prev";

      setTransition({ dir, active: true });
      timeoutRef.current = setTimeout(() => {
        setIndex(next);
        const target = pages[next];
        if (target && onRead) onRead(target.title);
        requestAnimationFrame(() => {
          setTransition({ dir, active: false });
          timeoutRef.current = setTimeout(() => setTransition(null), TRANSITION_MS);
        });
      }, TRANSITION_MS / 2);
    },
    [index, pages, onRead, transition],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    const node = stage.current;
    if (!node) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void node.requestFullscreen?.().catch(() => {});
  };

  const spread = pages[index] ?? null;
  const total = pages.length;

  if (!spread) {
    return (
      <div className="flex h-full flex-col" style={{ background: "radial-gradient(120% 90% at 50% -10%, #16234A 0%, #0B1330 45%, #060B1C 100%)", color: "var(--paper)" }}>
        <ReaderBar
          edition={edition}
          onBack={onBack}
          backLabel={backLabel}
          full={full}
          onToggleFullscreen={toggleFullscreen}
        />
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm opacity-70">
          Esta edição ainda não possui conteúdo publicado.
        </div>
      </div>
    );
  }

  const inverted = mediaOnLeft(spread.position);
  const leftFace = inverted ? "media" : "text";

  const transitionClass = transition?.active
    ? `magazine-page-pair--exit magazine-page-pair--${transition.dir}`
    : "";

  return (
    <div className="flex h-full flex-col" style={{ background: "radial-gradient(120% 90% at 50% -10%, #16234A 0%, #0B1330 45%, #060B1C 100%)", color: "var(--paper)" }}>
      <ReaderBar
        edition={edition}
        onBack={onBack}
        backLabel={backLabel}
        full={full}
        onToggleFullscreen={toggleFullscreen}
      />

      <div
        ref={stage}
        className="magazine-stage relative flex-1 overflow-hidden px-3 py-4 md:px-16 md:py-8"
      >
        <div className="magazine-book relative mx-auto h-full w-full max-w-6xl overflow-hidden rounded-[8px]">
          <div className={`magazine-page-pair grid h-full grid-cols-1 grid-rows-[auto_auto] overflow-y-auto md:grid-cols-2 md:grid-rows-1 md:overflow-hidden ${transitionClass}`}>
            <Side kind={leftFace} spread={spread} onDeletePage={onDeletePage} />
            <Side
              kind={leftFace === "text" ? "media" : "text"}
              spread={spread}
              onDeletePage={onDeletePage}
            />
          </div>
        </div>

        {/* Navegação flutuante — sempre acima da revista, nunca coberta. */}
        <NavArrow side="left" disabled={index === 0} onClick={() => go(-1)} />
        <NavArrow side="right" disabled={index >= total - 1} onClick={() => go(1)} />

        <span
          className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] tracking-[0.18em] opacity-60"
        >
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

function ReaderBar({
  edition,
  onBack,
  backLabel,
  full,
  onToggleFullscreen,
}: {
  edition: MagazineEdition;
  onBack?: () => void;
  backLabel: string;
  full: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <header
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 md:px-8"
      style={{ borderColor: "color-mix(in oklab, #F4F1EA 22%, transparent)" }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] transition hover:opacity-80"
          style={{ borderColor: "color-mix(in oklab, #F4F1EA 22%, transparent)" }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {backLabel}
        </button>
      ) : (
        <span />
      )}
      <span className="truncate text-center text-xs opacity-65">
        Revista Velox — {formatEditionCode(edition.number)} | {formatEditionMonth(edition.startsOn)}
      </span>
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={full ? "Sair da tela cheia" : "Tela cheia"}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition hover:opacity-80"
        style={{ borderColor: "color-mix(in oklab, #F4F1EA 22%, transparent)" }}
      >
        {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
    </header>
  );
}

function NavArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Página anterior" : "Próxima página"}
      className={
        "absolute top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition hover:scale-105 disabled:opacity-25 " +
        (side === "left" ? "left-1 md:left-4" : "right-1 md:right-4")
      }
      style={{
        borderColor: "color-mix(in oklab, #F4F1EA 28%, transparent)",
        background: "color-mix(in oklab, #0B1330 70%, transparent)",
        color: "#F4F1EA",
      }}
    >
      {side === "left" ? (
        <ChevronLeft className="h-5 w-5" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

/** Uma página: lado de texto ou lado de mídia. */
function Side({
  kind,
  spread,
  onDeletePage,
}: {
  kind: "text" | "media";
  spread: MagazinePage;
  onDeletePage?: (page: MagazinePage) => void;
}) {
  if (kind === "media") {
    return (
      <div
        className="magazine-media-side relative flex min-h-[34vh] items-center justify-center overflow-hidden md:h-full md:min-h-0"
        style={{ background: "#ffffff" }}
      >
        {spread.mediaKind === "imagem" && spread.mediaUrl && (
          <img
            src={spread.mediaUrl}
            alt={spread.caption ?? spread.title}
            className="h-full w-full object-cover"
          />
        )}
        {spread.mediaKind === "video" && spread.mediaUrl && (
          <video src={spread.mediaUrl} controls playsInline className="h-full w-full object-cover" />
        )}
        {spread.caption && (
          <span
            className="absolute inset-x-0 bottom-0 px-6 py-4 text-xs"
            style={{
              color: "var(--paper)",
              background:
                "linear-gradient(180deg, transparent, color-mix(in oklab, var(--ink) 80%, transparent))",
            }}
          >
            {spread.caption}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col justify-center px-6 py-8 sm:px-8 md:h-full md:overflow-y-auto md:px-12 md:py-10"
      style={{ background: "#ffffff", color: "#101A33" }}
    >
      {spread.eyebrow && <span className="portal-eyebrow">{spread.eyebrow}</span>}
      <h2 className="portal-serif mt-3 text-3xl md:text-4xl" style={{ color: "#101A33" }}>
        {spread.title}
      </h2>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
        {spread.body
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
      </div>
      {onDeletePage && (
        <button
          type="button"
          onClick={() => onDeletePage(spread)}
          className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.18em]"
          style={{ borderColor: "var(--paper-edge)" }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir este conteúdo
        </button>
      )}
    </div>
  );
}
