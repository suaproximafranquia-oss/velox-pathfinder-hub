import { useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { AlertCircle, Video } from "lucide-react";

export type PublicDigitalPresentationData = {
  muxPlaybackId: string | null;
  introText: string | null;
};

export function normalizeMuxPlaybackId(value?: string | null): string | null {
  const playbackId = value?.trim();
  return playbackId || null;
}

export function PublicDigitalPresentation({
  presentation,
}: {
  presentation: PublicDigitalPresentationData;
}) {
  const playbackId = normalizeMuxPlaybackId(presentation.muxPlaybackId);
  const [failed, setFailed] = useState(false);

  return (
    <main className="min-h-screen bg-navy-deep px-5 py-10 text-navy-foreground sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 border-b border-border/60 pb-6">
          <p className="text-xs uppercase text-gold">Velox Financeira</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Apresentação Digital</h1>
        </header>

        <section aria-label="Vídeo da Apresentação Digital">
          <div className="aspect-video overflow-hidden rounded-lg border border-border bg-background/20">
            {!playbackId ? (
              <div
                data-testid="digital-presentation-placeholder"
                className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground"
              >
                <Video className="h-9 w-9" aria-hidden />
                <p className="mt-3 text-sm">Vídeo ainda não disponível.</p>
              </div>
            ) : failed ? (
              <div
                role="alert"
                data-testid="digital-presentation-error"
                className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground"
              >
                <AlertCircle className="h-9 w-9" aria-hidden />
                <p className="mt-3 text-sm">Não foi possível reproduzir o vídeo agora.</p>
                <p className="mt-1 text-xs">Tente novamente em alguns instantes.</p>
              </div>
            ) : (
              <MuxPlayer
                data-testid="mux-player"
                playbackId={playbackId}
                streamType="on-demand"
                accentColor="var(--gold)"
                className="h-full w-full"
                onError={() => setFailed(true)}
              />
            )}
          </div>

          {presentation.introText ? (
            <p className="mt-6 whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">
              {presentation.introText}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}