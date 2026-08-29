/**
 * PRINCÍPIOS VELOX — experiência institucional do Portal do Investidor.
 *
 * COMANDO 3 §18 — exatamente 6 princípios, sempre visíveis. O conteúdo
 * oficial de cada card é administrado no Workspace (blocos do módulo
 * "principios", posições 1–6). Enquanto um princípio não for definido
 * pela liderança, o espaço exibe um placeholder interno claramente
 * identificado — nunca texto inventado.
 */
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { fetchInstitutionalModule } from "@/lib/magazine.functions";
import type { InstitutionalBlock } from "@/server/magazine.server";
import { assetUrl } from "@/lib/assets/registry";

/**
 * PRINCÍPIOS VELOX — três quadros oficiais: Missão, Visão e Valores.
 * Não existem quadros vazios "em definição": o que não tem texto
 * oficial simplesmente não aparece.
 */
const PRINCIPLE_TITLES = ["Missão", "Visão", "Valores"] as const;
const PRINCIPLE_COUNT = PRINCIPLE_TITLES.length;

type PrincipleSlot = {
  position: number;
  title: string;
  body: string;
  /** true quando o card ainda aguarda o texto oficial. */
  placeholder: boolean;
};

const PLACEHOLDER_BODY =
  "Conteúdo oficial em definição pela liderança Velox. Este espaço já está preparado para receber o princípio definitivo.";

function buildSlots(blocks: InstitutionalBlock[] | null): PrincipleSlot[] {
  const byPosition = new Map<number, InstitutionalBlock>();
  for (const block of blocks ?? []) {
    if (block.position >= 1 && block.position <= PRINCIPLE_COUNT && !byPosition.has(block.position)) {
      byPosition.set(block.position, block);
    }
  }
  return Array.from({ length: PRINCIPLE_COUNT }, (_, i) => {
    const position = i + 1;
    const block = byPosition.get(position);
    return {
      position,
      title: block?.title?.trim() || `Princípio ${String(position).padStart(2, "0")}`,
      body: block?.body?.trim() || PLACEHOLDER_BODY,
      placeholder: !block,
    };
  });
}

export function PrincipiosOverlay({
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
    void fetchInstitutionalModule({ data: { module: "principios" } })
      .then((rows) => alive && setBlocks(rows))
      .catch(() => alive && setError("Não foi possível carregar este módulo agora."));
    return () => {
      alive = false;
    };
  }, [open, blocks]);

  const slots = buildSlots(blocks);

  return (
    <PortalOverlayShell open={open} title="Princípios Velox" onClose={onClose}>
      <div className="h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
        <header className="mx-auto max-w-5xl px-8 pb-10 pt-16 md:px-12">
          <span className="portal-eyebrow">Portal Velox</span>
          <h1 className="portal-serif mt-4 text-4xl md:text-5xl">Princípios Velox</h1>
          <p className="mt-5 max-w-[60ch] text-sm leading-relaxed text-[color:var(--muted-foreground)] md:text-base">
            Os valores que orientam cada decisão da Velox — da relação com o
            investidor à conduta de cada unidade da rede.
          </p>
          <figure className="mt-10 overflow-hidden rounded-3xl border border-[color:var(--border)] shadow-[0_24px_60px_-30px_rgba(10,20,40,0.45)]">
            <img
              src={assetUrl("portal-capa-principios")}
              alt="Sala institucional Velox em tons de azul-marinho e dourado, com livro aberto sobre mesa de madeira"
              width={1536}
              height={864}
              loading="lazy"
              className="aspect-[16/9] w-full object-cover"
            />
          </figure>
        </header>

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

        {(blocks || error) && (
          <section
            aria-label="Os seis Princípios Velox"
            className="mx-auto grid max-w-5xl gap-5 px-8 pb-20 sm:grid-cols-2 md:px-12 lg:grid-cols-3"
          >
            {slots.map((slot) => (
              <article
                key={slot.position}
                className="flex flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/60 p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="portal-serif text-2xl text-[color:var(--gold)]">
                    {String(slot.position).padStart(2, "0")}
                  </span>
                  {slot.placeholder ? (
                    <span className="rounded-full border border-dashed border-[color:var(--border)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                      Em definição
                    </span>
                  ) : (
                    <ShieldCheck
                      className="h-4 w-4 text-[color:var(--gold)]"
                      strokeWidth={1.6}
                      aria-hidden
                    />
                  )}
                </div>
                <h2 className="portal-serif mt-4 text-xl leading-snug">{slot.title}</h2>
                <p
                  className={
                    "mt-3 text-sm leading-relaxed " +
                    (slot.placeholder
                      ? "italic text-[color:var(--muted-foreground)]"
                      : "text-[color:var(--muted-foreground)]")
                  }
                >
                  {slot.body}
                </p>
              </article>
            ))}
          </section>
        )}
      </div>
    </PortalOverlayShell>
  );
}
