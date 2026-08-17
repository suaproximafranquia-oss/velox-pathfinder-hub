/**
 * MÓDULOS INSTITUCIONAIS DO PORTAL — Nossa Estrutura e Princípios Velox.
 *
 * Ambos compartilham a mesma estrutura editorial: blocos com texto e
 * mídia (imagem ou vídeo institucional), administrados no Workspace e
 * lidos aqui sem qualquer conteúdo inventado.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { fetchInstitutionalModule } from "@/lib/magazine.functions";
import type { InstitutionalBlock } from "@/server/magazine.server";

export function InstitutionalOverlay({
  open,
  module,
  title,
  intro,
  onClose,
}: {
  open: boolean;
  module: "estrutura" | "principios";
  title: string;
  intro: string;
  onClose: () => void;
}) {
  const [blocks, setBlocks] = useState<InstitutionalBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || blocks) return;
    let alive = true;
    void fetchInstitutionalModule({ data: { module } })
      .then((rows) => alive && setBlocks(rows))
      .catch(() => alive && setError("Não foi possível carregar este módulo agora."));
    return () => {
      alive = false;
    };
  }, [open, blocks, module]);

  return (
    <PortalOverlayShell open={open} title={title} onClose={onClose}>
      <div className="h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
        <header className="mx-auto max-w-4xl px-8 pb-8 pt-16 md:px-12">
          <span className="portal-eyebrow">Portal Velox</span>
          <h1 className="portal-serif mt-4 text-4xl md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-[60ch] text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
            {intro}
          </p>
        </header>

        {!blocks && !error && (
          <div className="flex items-center justify-center gap-3 py-20 text-sm text-[color:var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conteúdo...
          </div>
        )}
        {error && (
          <p className="px-8 py-20 text-center text-sm text-[color:var(--muted-foreground)]">
            {error}
          </p>
        )}
        {blocks && blocks.length === 0 && (
          <p className="mx-auto max-w-4xl px-8 pb-24 text-sm text-[color:var(--muted-foreground)] md:px-12">
            Este módulo está sendo preparado. Em breve, novos conteúdos institucionais aparecerão
            aqui.
          </p>
        )}

        <div className="mx-auto max-w-5xl space-y-16 px-8 pb-24 md:px-12">
          {blocks?.map((block, index) => (
            <article
              key={block.id}
              className="grid items-center gap-8 md:grid-cols-2"
              style={{ direction: "ltr" }}
            >
              <div className={index % 2 === 1 ? "md:order-2" : undefined}>
                {block.eyebrow && <span className="portal-eyebrow">{block.eyebrow}</span>}
                <h2 className="portal-serif mt-3 text-2xl md:text-3xl">{block.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                  {block.body
                    .split(/\n{2,}/)
                    .filter(Boolean)
                    .map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                </div>
              </div>
              {block.mediaKind !== "none" && block.mediaUrl && (
                <div
                  className={
                    "overflow-hidden rounded-2xl " + (index % 2 === 1 ? "md:order-1" : "")
                  }
                  style={{ background: "color-mix(in oklab, var(--ink) 92%, transparent)" }}
                >
                  {block.mediaKind === "imagem" ? (
                    <img src={block.mediaUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <video
                      src={block.mediaUrl}
                      controls
                      playsInline
                      className="aspect-video w-full object-cover"
                    />
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </PortalOverlayShell>
  );
}
