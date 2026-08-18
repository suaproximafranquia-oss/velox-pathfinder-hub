/**
 * REVISTA VELOX — banca de edições + leitura.
 *
 * A revista abre como overlay sobre a Home do Portal e NÃO cai direto na
 * leitura: primeiro o investidor vê a edição vigente em destaque e as
 * edições anteriores no acervo. Ao escolher uma, entra no leitor de
 * página dupla.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, BookMarked } from "lucide-react";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { MagazineReader } from "@/components/portal/magazine-reader";
import { fetchPortalMagazine } from "@/lib/magazine.functions";
import {
  archivedEditions,
  currentEdition,
  daysRemaining,
  editionStatus,
  formatEditionCode,
  formatPeriod,
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
  const [readingId, setReadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || editions) return;
    let alive = true;
    void fetchPortalMagazine()
      .then((rows) => {
        if (!alive) return;
        setEditions(rows);
      })
      .catch(() => alive && setError("Não foi possível carregar a Revista agora."));
    return () => {
      alive = false;
    };
  }, [open, editions]);

  const reading = useMemo(
    () => editions?.find((e) => e.id === readingId) ?? null,
    [editions, readingId],
  );
  const featured = useMemo(() => (editions ? currentEdition(editions) : null), [editions]);
  const archive = useMemo(() => (editions ? archivedEditions(editions) : []), [editions]);
  const shelf = useMemo(
    () => archive.filter((item) => item.id !== featured?.id),
    [archive, featured],
  );

  return (
    <PortalOverlayShell open={open} title="Revista Velox" onClose={onClose}>
      {reading ? (
        <MagazineReader
          edition={reading}
          onRead={onRead}
          onBack={() => setReadingId(null)}
          backLabel="Edições"
        />
      ) : (
        <div
          className="flex h-full flex-col overflow-y-auto"
          style={{ background: "var(--paper)" }}
        >
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
        {editions && !error && !featured && shelf.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
            <BookMarked className="h-8 w-8" style={{ color: "var(--brand-orange)" }} />
            <h2 className="portal-serif text-3xl">A primeira edição está sendo preparada.</h2>
            <p className="max-w-md text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              A Revista Velox reúne bastidores, comunicados e histórias da rede. Assim que a edição
              for publicada, ela aparece aqui.
            </p>
          </div>
        )}

          {editions && !error && (featured || shelf.length > 0) && (
            <div className="px-6 py-10 md:px-14 md:py-14">
              <span className="portal-eyebrow">Revista Velox</span>
              <h2 className="portal-serif mt-3 text-4xl md:text-5xl">Edições</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                A edição vigente fica disponível por dez dias. As anteriores permanecem no acervo e
                podem ser lidas a qualquer momento.
              </p>

              {featured && (
                <button
                  type="button"
                  onClick={() => setReadingId(featured.id)}
                  className="mt-8 grid w-full grid-cols-1 overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 md:grid-cols-[1.1fr_1fr]"
                  style={{
                    borderColor: "var(--paper-edge)",
                    boxShadow: "0 30px 60px -40px color-mix(in oklab, var(--ink) 60%, transparent)",
                  }}
                >
                  <span
                    className="relative block min-h-[34vh]"
                    style={{ background: "color-mix(in oklab, var(--ink) 92%, transparent)" }}
                  >
                    {featured.coverUrl && (
                      <img
                        src={featured.coverUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="flex flex-col justify-center gap-3 px-7 py-8">
                    <span
                      className="w-fit border px-2 py-1 text-[10px] uppercase tracking-[0.22em]"
                      style={{ borderColor: "var(--brand-orange)", color: "var(--brand-orange)" }}
                    >
                      {editionStatus(featured) === "vigente"
                        ? `Vigente · ${daysRemaining(featured)} dia(s)`
                        : "Última edição"}
                    </span>
                    <span className="portal-eyebrow">{formatEditionCode(featured.number)}</span>
                    <span className="portal-serif text-3xl">{featured.title}</span>
                    {featured.subtitle && (
                      <span className="text-sm text-[color:var(--muted-foreground)]">
                        {featured.subtitle}
                      </span>
                    )}
                    <span className="text-xs text-[color:var(--muted-foreground)]">
                      {formatPeriod(featured.startsOn)} · {featured.pages.length} conteúdo(s)
                    </span>
                    <span
                      className="mt-2 w-fit rounded-full px-5 py-2 text-xs uppercase tracking-[0.22em]"
                      style={{ background: "var(--brand-orange)", color: "#fff" }}
                    >
                      Ler edição
                    </span>
                  </span>
                </button>
              )}

              {shelf.length > 0 && (
                <>
                  <h3 className="portal-serif mt-12 text-2xl">Acervo</h3>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shelf.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setReadingId(item.id)}
                        className="overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5"
                        style={{ borderColor: "var(--paper-edge)" }}
                      >
                        <span
                          className="relative block h-36"
                          style={{ background: "color-mix(in oklab, var(--ink) 92%, transparent)" }}
                        >
                          {item.coverUrl && (
                            <img
                              src={item.coverUrl}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span className="block px-4 py-4">
                          <span className="portal-eyebrow">{formatEditionCode(item.number)}</span>
                          <span className="portal-serif mt-1 block text-lg">{item.title}</span>
                          <span className="mt-1 block text-[11px] text-[color:var(--muted-foreground)]">
                            {formatPeriod(item.startsOn)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </PortalOverlayShell>
  );
}
