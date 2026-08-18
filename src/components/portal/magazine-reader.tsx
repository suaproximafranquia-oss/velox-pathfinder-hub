/**
 * REVISTA VELOX — leitor de página dupla.
 *
 * Componente único usado tanto pelo Portal do Investidor quanto pela
 * pré-visualização da Gestão. Reproduz a sensação de uma revista aberta:
 * profundidade, dobra central, espessura das folhas e virada de página.
 *
 * Regra editorial: cada conteúdo é um PAR indivisível (texto + mídia).
 * A cada conteúdo os lados se alternam — no celular a leitura vira
 * vertical, sempre texto e depois mídia.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  daysRemaining,
  editionStatus,
  formatEditionCode,
  formatPeriod,
  mediaOnLeft,
  spreadsOf,
  type MagazineEdition,
  type MagazinePage,
} from "@/lib/magazine/edition";

export function MagazineReader({
  edition,
  onRead,
  onBack,
  backLabel = "Acervo",
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
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<"next" | "prev" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setPage(0), [edition.id]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const go = useCallback(
    (delta: number) => {
      setPage((current) => {
        const next = Math.min(Math.max(current + delta, 0), pages.length);
        if (next === current) return current;
        setTurn(delta > 0 ? "next" : "prev");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setTurn(null), 520);
        const target = next === 0 ? null : pages[next - 1];
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

  const spread = page === 0 ? null : pages[page - 1] ?? null;
  const inverted = spread ? mediaOnLeft(spread.position) : false;

  const text = (
    <div className="flex flex-col justify-center px-6 py-8 sm:px-8 md:h-full md:overflow-y-auto md:px-14 md:py-12">
      {!spread ? (
        <>
          <span className="portal-eyebrow">Revista Velox</span>
          <h2 className="portal-serif mt-4 text-4xl md:text-5xl">{edition.title}</h2>
          {edition.subtitle && (
            <p className="portal-serif mt-4 text-lg italic text-[color:var(--muted-foreground)]">
              {edition.subtitle}
            </p>
          )}
          <p className="mt-8 max-w-[46ch] text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Uma leitura de dez dias sobre o que acontece na rede Velox. Vire a página para começar.
          </p>
          <p className="mt-8 text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            {pages.length} conteúdo(s) nesta edição
          </p>
        </>
      ) : (
        <>
          {spread.eyebrow && <span className="portal-eyebrow">{spread.eyebrow}</span>}
          <h2 className="portal-serif mt-3 text-3xl md:text-4xl">{spread.title}</h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
            {spread.body
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
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
        </>
      )}
    </div>
  );

  const media = (
    <div
      className="relative flex min-h-[38vh] items-center justify-center overflow-hidden md:h-full md:min-h-0"
      style={{ background: "color-mix(in oklab, var(--ink) 92%, transparent)" }}
    >
      {!spread && edition.coverUrl && (
        <img src={edition.coverUrl} alt="" className="h-full w-full object-cover" />
      )}
      {spread?.mediaKind === "imagem" && spread.mediaUrl && (
        <img
          src={spread.mediaUrl}
          alt={spread.caption ?? ""}
          className="h-full w-full object-cover"
        />
      )}
      {spread?.mediaKind === "video" && spread.mediaUrl && (
        <video src={spread.mediaUrl} controls playsInline className="h-full w-full object-cover" />
      )}
      {spread?.caption && (
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

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--paper)" }}>
      <header
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-6 py-4 md:flex md:flex-wrap md:justify-between md:px-10"
        style={{ borderColor: "var(--paper-edge)" }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]"
              style={{ borderColor: "var(--paper-edge)" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> {backLabel}
            </button>
          )}
          <span className="portal-eyebrow shrink-0">{formatEditionCode(edition.number)}</span>
          <span className="truncate text-xs text-[color:var(--muted-foreground)]">
            {edition.pages.length === 0 ? "Sem conteúdo" : formatPeriod(edition.startsOn)}
          </span>
        </div>
        <span
          className="shrink-0 border px-2 py-1 text-[10px] uppercase tracking-[0.22em]"
          style={{ borderColor: "var(--brand-orange)", color: "var(--brand-orange)" }}
        >
          {editionStatus(edition) === "vigente"
            ? `Vigente · ${daysRemaining(edition)} dia(s)`
            : "Acervo"}
        </span>
      </header>

      <div className="magazine-stage relative flex-1 overflow-y-auto p-0 md:overflow-hidden md:p-6">
        <div
          className={
            "magazine-book relative h-full overflow-hidden " +
            (turn === "next" ? "magazine-turn-next " : turn === "prev" ? "magazine-turn-prev " : "")
          }
        >
          <div className="grid min-h-full grid-cols-1 md:h-full md:grid-cols-2">
            {inverted ? (
              <>
                <div className="order-2 md:order-1">{media}</div>
                <div className="order-1 md:order-2">{text}</div>
              </>
            ) : (
              <>
                {text}
                {media}
              </>
            )}
          </div>

          {/* Dobra central e espessura das folhas */}
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
      </div>

      <footer
        className="flex items-center justify-between border-t px-6 py-4 md:px-10"
        style={{ borderColor: "var(--paper-edge)" }}
      >
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={page === 0}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {page === 0 ? "Capa" : `Página ${page} de ${pages.length}`}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={page >= pages.length}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs uppercase tracking-[0.22em] disabled:opacity-30"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </button>
      </footer>
    </div>
  );
}