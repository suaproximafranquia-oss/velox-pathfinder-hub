import { Reveal } from "../Reveal";

export type GalleryItem = { src: string; alt: string; caption?: string; span?: 1 | 2 };

/**
 * Gallery — grade assimétrica de fotos com molduras editoriais.
 */
export function Gallery({ items }: { items: GalleryItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-6 md:gap-6">
      {items.map((it, i) => (
        <Reveal
          key={i}
          delay={i * 100}
          className={
            it.span === 2
              ? "md:col-span-4"
              : "md:col-span-2"
          }
        >
          <figure>
            <div
              className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]"
              style={{ aspectRatio: it.span === 2 ? "16 / 10" : "4 / 5" }}
            >
              <img
                src={it.src}
                alt={it.alt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out hover:scale-[1.03]"
              />
            </div>
            {it.caption && (
              <figcaption className="mt-4 flex items-center gap-3 font-serif text-sm italic text-muted-foreground">
                <span className="h-px w-6" style={{ background: "var(--brand-orange)" }} aria-hidden="true" />
                {it.caption}
              </figcaption>
            )}
          </figure>
        </Reveal>
      ))}
    </div>
  );
}