/**
 * REVISTA VELOX — banca de edições + leitura.
 *
 * A revista NUNCA abre direto em uma edição: primeiro o investidor vê a
 * BANCA, com um card por edição (a capa da edição é o próprio card).
 * Só o clique em um card abre o leitor daquela edição — e o leitor
 * trabalha exclusivamente com o conteúdo dela.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, BookMarked, Lock } from "lucide-react";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { MagazineReader } from "@/components/portal/magazine-reader";
import { fetchPortalMagazine } from "@/lib/magazine.functions";
import {
  daysRemaining,
  editionStatus,
  formatEditionCode,
  formatEditionMonth,
  galleryEditions,
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

  /** Ao sair do leitor, o investidor sempre volta para a banca. */
  useEffect(() => {
    if (!open) setReadingId(null);
  }, [open]);

  const reading = useMemo(
    () => editions?.find((e) => e.id === readingId) ?? null,
    [editions, readingId],
  );
  const shelf = useMemo(() => (editions ? galleryEditions(editions) : []), [editions]);

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
        <div className="flex h-full flex-col overflow-y-auto" style={{ background: "var(--paper)" }}>
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
          {editions && !error && shelf.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center">
              <BookMarked className="h-8 w-8" style={{ color: "var(--brand-orange)" }} />
              <h2 className="portal-serif text-3xl">A primeira edição está sendo preparada.</h2>
              <p className="max-w-md text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                A Revista Velox reúne bastidores, comunicados e histórias da rede. Assim que a
                edição for publicada, ela aparece aqui.
              </p>
            </div>
          )}

          {editions && !error && shelf.length > 0 && (
            <div className="px-6 py-10 md:px-14 md:py-12">
              <header className="flex min-w-0 items-center gap-3">
                <BookMarked className="h-6 w-6 shrink-0" style={{ color: "var(--brand-orange)" }} />
                <div className="min-w-0">
                  <h2 className="portal-serif text-3xl md:text-4xl">Revista Velox</h2>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    Conteúdo estratégico para os investidores da Velox
                  </p>
                </div>
              </header>

              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {shelf.map((item) => (
                  <EditionCard
                    key={item.id}
                    edition={item}
                    onOpen={() => setReadingId(item.id)}
                  />
                ))}
              </div>

              <p className="mt-8 text-center text-xs text-[color:var(--muted-foreground)]">
                Clique em uma edição para iniciar a leitura
              </p>
            </div>
          )}
        </div>
      )}
    </PortalOverlayShell>
  );
}

/** O card É a capa da edição — não existe página "Capa" dentro do leitor. */
function EditionCard({
  edition,
  onOpen,
}: {
  edition: MagazineEdition;
  onOpen: () => void;
}) {
  const status = editionStatus(edition);
  const locked = status === "agendada";

  return (
    <button
      type="button"
      onClick={locked ? undefined : onOpen}
      disabled={locked}
      aria-label={`${formatEditionCode(edition.number)} — ${edition.title}`}
      className={
        "group relative aspect-[3/4] overflow-hidden rounded-xl border text-left transition " +
        (locked ? "cursor-default opacity-60" : "hover:-translate-y-1 hover:shadow-2xl")
      }
      style={{
        borderColor:
          status === "vigente" ? "var(--brand-orange)" : "var(--paper-edge)",
        background: "color-mix(in oklab, var(--ink) 94%, transparent)",
        boxShadow: "0 26px 50px -34px color-mix(in oklab, var(--ink) 70%, transparent)",
      }}
    >
      {edition.coverUrl ? (
        <img
          src={edition.coverUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, var(--brand-orange) 22%, transparent), transparent 65%)",
          }}
        />
      )}

      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--ink) 25%, transparent) 0%, transparent 35%, color-mix(in oklab, var(--ink) 85%, transparent) 100%)",
        }}
      />

      <span className="absolute inset-x-0 top-6 flex flex-col items-center gap-1 px-4 text-center">
        <span
          className="text-[9px] uppercase tracking-[0.42em]"
          style={{ color: "color-mix(in oklab, var(--paper) 75%, transparent)" }}
        >
          Revista
        </span>
        <span
          className="portal-serif text-2xl uppercase tracking-[0.18em]"
          style={{ color: "var(--paper)" }}
        >
          Velox
        </span>
        <span
          className="text-[8px] uppercase tracking-[0.28em]"
          style={{ color: "color-mix(in oklab, var(--paper) 60%, transparent)" }}
        >
          Estratégia. Performance. Crescimento.
        </span>
      </span>

      {locked && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Lock className="h-5 w-5" style={{ color: "var(--paper)" }} />
          <span
            className="text-[10px] uppercase tracking-[0.24em]"
            style={{ color: "var(--paper)" }}
          >
            Em breve
          </span>
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-4 py-4">
        <span
          className="text-xs font-medium uppercase tracking-[0.16em]"
          style={{ color: "var(--paper)" }}
        >
          {formatEditionCode(edition.number)}
        </span>
        <span
          className="text-[11px]"
          style={{ color: "color-mix(in oklab, var(--paper) 70%, transparent)" }}
        >
          {formatEditionMonth(edition.startsOn)}
        </span>
        {status === "vigente" && (
          <span
            className="mt-1 w-fit rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]"
            style={{ background: "var(--brand-orange)", color: "#fff" }}
          >
            Vigente · {daysRemaining(edition)} dia(s)
          </span>
        )}
      </span>
    </button>
  );
}
