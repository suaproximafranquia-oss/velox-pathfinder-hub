/**
 * NOSSA ESTRUTURA — experiência institucional do Portal do Investidor.
 *
 * COMANDO 3 §20 — apresenta a estrutura física e operacional da Velox
 * com fotografias reais já oficiais do Portal e um espaço reservado
 * para o futuro vídeo institucional (placeholder, sem URL inventada).
 * Blocos editoriais adicionais são administrados no Workspace.
 */
import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { fetchInstitutionalModule } from "@/lib/magazine.functions";
import type { InstitutionalBlock } from "@/server/magazine.server";
import { assetUrl } from "@/lib/assets/registry";

const GALLERY: { key: Parameters<typeof assetUrl>[0]; label: string; alt: string }[] = [
  {
    key: "sede-velox",
    label: "Matriz",
    alt: "Fachada da sede Velox Soluções Financeiras",
  },
  {
    key: "sede-recepcao",
    label: "Recepção",
    alt: "Recepção da sede Velox",
  },
  {
    key: "unidade-fachada",
    label: "Unidades da rede",
    alt: "Fachada de unidade franqueada Velox",
  },
];

export function EstruturaOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [blocks, setBlocks] = useState<InstitutionalBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || blocks) return;
    let alive = true;
    void fetchInstitutionalModule({ data: { module: "estrutura" } })
      .then((rows) => alive && setBlocks(rows))
      .catch(() => alive && setError("Não foi possível carregar este módulo agora."));
    return () => {
      alive = false;
    };
  }, [open, blocks]);

  return (
    <PortalOverlayShell open={open} title="Nossa Estrutura" onClose={onClose}>
      <div className="h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
        <header className="mx-auto max-w-5xl px-8 pb-10 pt-16 md:px-12">
          <span className="portal-eyebrow">Portal Velox</span>
          <h1 className="portal-serif mt-4 text-4xl md:text-5xl">Nossa Estrutura</h1>
          <p className="mt-5 max-w-[60ch] text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
            A matriz, os bastidores e as unidades que sustentam a operação
            Velox em todo o país.
          </p>

          {/* Espaço reservado para o futuro vídeo institucional oficial. */}
          <div
            role="note"
            aria-label="Espaço reservado para o vídeo institucional Velox"
            className="mt-10 flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/40 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--gold)]/50 text-[color:var(--gold)]">
              <Play className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            </span>
            <div>
              <p className="portal-serif text-lg">Vídeo institucional em produção</p>
              <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                Em breve, os bastidores oficiais da Velox neste espaço.
              </p>
            </div>
          </div>
        </header>

        <section
          aria-label="Estrutura física da Velox"
          className="mx-auto grid max-w-5xl gap-5 px-8 pb-10 sm:grid-cols-3 md:px-12"
        >
          {GALLERY.map((photo) => (
            <figure
              key={photo.key}
              className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/60"
            >
              <img
                src={assetUrl(photo.key)}
                alt={photo.alt}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <figcaption className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                {photo.label}
              </figcaption>
            </figure>
          ))}
        </section>

        {!blocks && !error && (
          <div className="flex items-center justify-center gap-3 pb-20 text-sm text-[color:var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conteúdo...
          </div>
        )}
        {error && (
          <p className="px-8 pb-20 text-center text-sm text-[color:var(--muted-foreground)]">
            {error}
          </p>
        )}
        {blocks && blocks.length > 0 && (
          <section className="mx-auto max-w-5xl space-y-5 px-8 pb-20 md:px-12">
            {blocks.map((block) => (
              <article
                key={block.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/60 p-6"
              >
                {block.eyebrow ? (
                  <span className="portal-eyebrow">{block.eyebrow}</span>
                ) : null}
                <h2 className="portal-serif mt-2 text-2xl leading-snug">{block.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                  {block.body}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </PortalOverlayShell>
  );
}
