/**
 * REVISTA VELOX — leitor de página dupla.
 *
 * A revista abre como overlay sobre a Home do Portal: capa, sumário e
 * páginas duplas (texto à esquerda, imagem ou vídeo à direita). A edição
 * vigente dura 10 dias corridos; as anteriores permanecem no acervo.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, BookMarked } from "lucide-react";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { fetchPortalMagazine } from "@/lib/magazine.functions";
import {
  archivedEditions,
  currentEdition,
  daysRemaining,
  editionStatus,
  formatEditionCode,
  formatPeriod,
  spreadsOf,
  type MagazineEdition,
} from "@/lib/magazine/edition";

export function MagazineOverlay({
  open,
  onClose,
  onRead,
}: {
  open: boolean;
  onClose: () => void;
  /** Sinaliza a leitura real de uma página (jornada/engajamento). */
  onRead?: (detail: string) => void;
}) {
  const [editions, setEditions] = useState<MagazineEdition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!open || editions) return;
    let alive = true;
    void fetchPortalMagazine()
      .then((rows) => {
        if (!alive) return;
        setEditions(rows);
        setSelectedId(currentEdition(rows)?.id ?? null);
      })
      .catch(() => alive && setError("Não foi possível carregar a Revista agora."));
    return () => {
      alive = false;
    };
  }, [open, editions]);

  const edition = useMemo(
    () => editions?.find((e) => e.id === selectedId) ?? null,
    [editions, selectedId],
  );
  const pages = useMemo(() => (edition ? spreadsOf(edition.pages) : []), [edition]);
  const archive = useMemo(() => (editions ? archivedEditions(editions) : []), [editions]);

  const go = useCallback(
    (delta: number) => {
      setPage((current) => {
        const next = Math.min(Math.max(current + delta, 0), pages.length);
        const target = next === 0 ? null : pages[next - 1];
        if (target && onRead) onRead(target.title);
        return next;
      });
    },
    [pages, onRead],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  useEffect(() => {
    setPage(0);
  }, [selectedId]);

  const spread = page === 0 ? null : pages[page - 1] ?? null;

  return (
    <PortalOverlayShell open={open} title="Revista Velox" onClose={onClose}>
      <div className="flex h-full flex-col" style={{ background: "var(--paper)" }}>
        {!editions && !error && (
          <div className="flex h-full items-center justify-center gap-3 text-sm text-[color:var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a Revista Velox...
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[color:var(--muted-foreground)]">
            {error}
          </div>
        )}
        {editions && !error && !edition && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
            <BookMarked className="h-8 w-8" style={{ color: "var(--brand-orange)" }} />
            <h2 className="portal-serif text-3xl">A primeira edição está sendo preparada.</h2>
            <p className="max-w-md text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              A Revista Velox reúne bastidores, comunicados e histórias da rede. Assim que a edição
              for publicada, ela aparece aqui.
            </p>
          </div>
        )}

        {edition && (
          <>
            <header
              className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4 md:px-10"
              style={{ borderColor: "var(--paper-edge)" }}
            >
              <div className="flex items-center gap-4">
                <span className="portal-eyebrow">{formatEditionCode(edition.number)}</span>
                <span className="text-xs text-[color:var(--muted-foreground)]">
                  {formatPeriod(edition.startsOn)}
                </span>
                <span
                  className="border px-2 py-1 text-[10px] uppercase tracking-[0.22em]"
                  style={{
                    borderColor: "var(--brand-orange)",
                    color: "var(--brand-orange)",
                  }}
                >
                  {editionStatus(edition) === "vigente"
                    ? `Vigente · ${daysRemaining(edition)} dia(s) restante(s)`
                    : "Acervo"}
                </span>
              </div>
              {archive.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                  Edições anteriores
                  <select
                    value={selectedId ?? ""}
                    onChange={(event) => setSelectedId(event.target.value)}
                    className="rounded-full border px-3 py-1.5 text-xs"
                    style={{ borderColor: "var(--paper-edge)", background: "transparent" }}
                  >
                    {editions?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatEditionCode(item.number)} — {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </header>

            {/* No celular a página dupla vira leitura vertical: texto e depois mídia. */}
            <div className="relative flex-1 overflow-y-auto md:overflow-hidden">
              <div className="grid min-h-full grid-cols-1 md:h-full md:grid-cols-2">
                {/* Página esquerda — texto */}
                <div className="flex flex-col justify-center px-6 py-8 sm:px-8 md:h-full md:overflow-y-auto md:px-14 md:py-10">
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
                        Uma leitura de dez dias sobre o que acontece na rede Velox. Vire a página
                        para começar.
                      </p>
                      <p className="mt-8 text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                        {pages.length} página(s) nesta edição
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
                    </>
                  )}
                </div>

                {/* Página direita — imagem ou vídeo */}
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
                    <video
                      src={spread.mediaUrl}
                      controls
                      playsInline
                      className="h-full w-full object-cover"
                    />
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
              </div>

              {/* Vinco central da revista */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-10 -translate-x-1/2 md:block"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, color-mix(in oklab, var(--ink) 14%, transparent), transparent)",
                }}
              />
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
          </>
        )}
      </div>
    </PortalOverlayShell>
  );
}
