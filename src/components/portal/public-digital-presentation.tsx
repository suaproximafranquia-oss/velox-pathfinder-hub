import { useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { AlertCircle, ArrowRight, Video } from "lucide-react";
import presentationBackground from "@/assets/presentation/velox-financeira-sede.png.asset.json";
import { Button } from "@/components/ui/button";

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
    <main className="relative isolate min-h-screen overflow-hidden bg-navy-deep px-4 py-8 text-navy-foreground sm:px-8 sm:py-12 lg:py-16">
      <img
        src={presentationBackground.url}
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-30 h-full w-full object-cover object-[43%_center]"
      />
      <div className="pointer-events-none fixed inset-0 -z-20 bg-navy-deep/80" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-navy-deep/30 via-navy-deep/65 to-navy-deep/95"
        aria-hidden="true"
      />

      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-navy-foreground/15 bg-navy-deep/80 shadow-2xl backdrop-blur-md">
        <header className="px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 shrink-0 bg-gold" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Velox Financeira</p>
          </div>
          <h1 className="mt-3 font-display text-3xl leading-tight text-navy-foreground sm:text-4xl">
            Apresentação Digital
          </h1>
        </header>

        <section className="border-t border-navy-foreground/10 px-3 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-8 lg:px-10 lg:pb-10" aria-label="Vídeo da Apresentação Digital">
          <div className="aspect-video overflow-hidden rounded-lg border border-navy-foreground/20 bg-navy-deep shadow-xl">
            {!playbackId ? (
              <div
                data-testid="digital-presentation-placeholder"
                className="flex h-full flex-col items-center justify-center px-6 text-center text-navy-foreground/70"
              >
                <Video className="h-9 w-9" aria-hidden />
                <p className="mt-3 text-sm">Vídeo ainda não disponível.</p>
              </div>
            ) : failed ? (
              <div
                role="alert"
                data-testid="digital-presentation-error"
                className="flex h-full flex-col items-center justify-center px-6 text-center text-navy-foreground/70"
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
            <section
              aria-labelledby="digital-presentation-caption"
              className="mt-6 border-l-2 border-gold bg-navy/80 px-5 py-5 sm:mt-8 sm:px-6 sm:py-6"
            >
              <h2
                id="digital-presentation-caption"
                className="text-xs font-semibold uppercase tracking-[0.18em] text-gold"
              >
                Legenda
              </h2>
              <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-navy-foreground/90 sm:text-base sm:leading-8">
                {presentation.introText}
              </p>
            </section>
          ) : null}

          <div className="mt-6 flex sm:mt-8">
            <Button asChild size="lg" className="h-auto min-h-12 w-full whitespace-normal px-5 py-3 text-center sm:w-auto">
              <a href="https://portalvelox.com.br/f">
                Continuar no Portal do Investidor
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}