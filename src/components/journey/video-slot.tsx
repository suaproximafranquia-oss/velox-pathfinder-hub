import { PlayCircle } from "lucide-react";

export function VideoSlot({ label }: { label?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy-deep)] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
      <div className="aspect-video w-full bg-gradient-to-br from-[color:var(--navy-deep)] via-[color:var(--navy)] to-[color:var(--navy-deep)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <button
            type="button"
            aria-label="Reproduzir vídeo"
            className="group flex items-center justify-center rounded-full bg-[color:var(--gold)]/10 p-1 backdrop-blur-sm ring-1 ring-[color:var(--gold)]/40 animate-soft-pulse"
          >
            <PlayCircle
              className="h-16 w-16 text-[color:var(--gold)] transition-transform group-hover:scale-105"
              strokeWidth={1.25}
            />
          </button>
          <p className="text-sm text-[color:var(--muted-foreground)] max-w-xs">
            {label ?? "Vídeo do especialista — em breve."}
          </p>
        </div>
      </div>
    </div>
  );
}
