import { Reveal } from "./Reveal";

export type TimelineItem = {
  marker: string;
  title: string;
  description?: string;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div>
      {/* Desktop: horizontal */}
      <div className="hidden md:block">
        <div className="relative">
          <div className="absolute inset-x-0 top-6 h-px bg-border" />
          <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="relative flex flex-col items-start pr-8">
                  <div className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-border bg-background">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  </div>
                  <div className="mt-6 font-serif text-2xl text-foreground">{item.marker}</div>
                  <div className="eyebrow mt-2">{item.title}</div>
                  {item.description && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden">
        <ol className="relative space-y-10 border-l border-border pl-6">
          {items.map((item, i) => (
            <Reveal key={i} as="li" delay={i * 80}>
              <div className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-accent" />
              <div className="font-serif text-2xl text-foreground">{item.marker}</div>
              <div className="eyebrow mt-1">{item.title}</div>
              {item.description && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              )}
            </Reveal>
          ))}
        </ol>
      </div>
    </div>
  );
}