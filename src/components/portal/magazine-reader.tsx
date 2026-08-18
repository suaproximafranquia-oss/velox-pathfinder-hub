/**
 * REVISTA VELOX — leitor de página dupla.
 *
 * Componente único usado tanto pelo Portal do Investidor quanto pela
 * pré-visualização da Gestão. Reproduz a sensação de uma revista física
 * aberta: perspectiva, profundidade, vinco central, espessura das folhas
 * e uma FOLHA que realmente atravessa o eixo e completa a virada.
 *
 * Regra editorial: cada conteúdo é um PAR indivisível (texto + mídia).
 * A cada conteúdo os lados se alternam. Não existe página "Capa": a capa
 * é o card da edição na banca — aqui a leitura começa no conteúdo real.
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

/** Duração da virada — leve o bastante para não pesar em mobile. */
const TURN_MS = 720;

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
  /** Folha em movimento: direção + conteúdo das faces. */
  const [leaf, setLeaf] = useState<{ dir: "next" | "prev"; from: MagazinePage } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => setIndex(0), [edition.id]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  /** Recolhe elementos externos enquanto a revista está aberta. */
  useEffect(() => {
    setReaderFocus(true);
    return () => setReaderFocus(false);
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (timer.current) return; // uma virada por vez: nunca volta ao estado anterior
      setIndex((current) => {
        const next = current + delta;
        if (next < 0 || next > pages.length - 1) return current;
        const from = pages[current];
        if (from) setLeaf({ dir: delta > 0 ? "next" : "prev", from });
        timer.current = setTimeout(() => {
          timer.current = null;
          setLeaf(null);
        }, TURN_MS);
        const target = pages[next];
        if (target && onRead) onRead(target.title);
        return next;
      });
    },
    [pages, onRead],
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
          <div className="grid h-full grid-cols-1 grid-rows-[auto_auto] overflow-y-auto md:grid-cols-2 md:grid-rows-1 md:overflow-hidden">
            <Side kind={leftFace} spread={spread} edition={edition} onDeletePage={onDeletePage} />
            <Side
              kind={leftFace === "text" ? "media" : "text"}
              spread={spread}
              edition={edition}
              onDeletePage={onDeletePage}
            />
          </div>

          {/* Folha em virada — atravessa o eixo central e conclui o giro. */}
          {leaf && (
            <div
              aria-hidden
              className={
                "magazine-leaf pointer-events-none absolute inset-y-0 hidden md:block " +
                (leaf.dir === "next" ? "magazine-leaf--next right-0" : "magazine-leaf--prev left-0")
              }
            >
              <div className="magazine-leaf-face magazine-leaf-front">
                <Side
                  kind={
                    leaf.dir === "next"
                      ? mediaOnLeft(leaf.from.position)
                        ? "text"
                        : "media"
                      : mediaOnLeft(leaf.from.position)
                        ? "media"
                        : "text"
                  }
                  spread={leaf.from}
                  edition={edition}
                />
              </div>
              <div className="magazine-leaf-face magazine-leaf-back">
                <Side
                  kind={leaf.dir === "next" ? leftFace : leftFace === "text" ? "media" : "text"}
                  spread={spread}
                  edition={edition}
                />
              </div>
              <div className="magazine-leaf-shade" />
            </div>
          )}

          {/* Vinco central e espessura do bloco de folhas. */}
          <div
            aria-hidden
            className="magazine-fold pointer-events-none absolute inset-y-0 left-1/2 hidden w-16 -translate-x-1/2 md:block"
          />
          <div
            aria-hidden
            className="magazine-edge-left pointer-events-none absolute inset-y-0 left-0 hidden w-3 md:block"
          />
          <div
            aria-hidden
            className="magazine-edge-right pointer-events-none absolute inset-y-0 right-0 hidden w-3 md:block"
          />
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

/** Uma página física: lado de texto ou lado de mídia. */
function Side({
  kind,
  spread,
  edition,
  onDeletePage,
}: {
  kind: "text" | "media";
  spread: MagazinePage;
  edition: MagazineEdition;
  onDeletePage?: (page: MagazinePage) => void;
}) {
  if (kind === "media") {
    return (
      <div
        className="relative flex min-h-[34vh] items-center justify-center overflow-hidden md:h-full md:min-h-0"
        style={{ background: "color-mix(in oklab, var(--ink) 92%, transparent)" }}
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
        {spread.mediaKind === "none" && edition.coverUrl && (
          <img src={edition.coverUrl} alt="" className="h-full w-full object-cover opacity-70" />
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
    <div className="flex flex-col justify-center px-6 py-8 sm:px-8 md:h-full md:overflow-y-auto md:px-12 md:py-10">
      {spread.eyebrow && <span className="portal-eyebrow">{spread.eyebrow}</span>}
      <h2 className="portal-serif mt-3 text-3xl md:text-4xl">{spread.title}</h2>
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
