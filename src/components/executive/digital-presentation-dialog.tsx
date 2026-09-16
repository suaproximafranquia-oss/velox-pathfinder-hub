import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Save, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ENVIRONMENT_PRESENTATION_KEYS,
  listarApresentacoesAmbiente,
  salvarApresentacaoAmbiente,
} from "@/lib/relationship/presentation.functions";

const ENVIRONMENT_LABEL: Record<string, string> = {
  financeira: "Financeira",
  solar: "Solar",
  seguradora: "Seguradora",
};

type PresentationItem = {
  environment: string;
  introText: string | null;
  videoUrl: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
};

type PresentationDraft = {
  videoUrl: string;
  description: string;
  isPublished: boolean;
};

const EMPTY_DRAFT: PresentationDraft = {
  videoUrl: "",
  description: "",
  isPublished: false,
};

export function presentationVideoSource(videoUrl?: string | null): string | null {
  const source = videoUrl?.trim();
  return source || null;
}

function PresentationVideo({ videoUrl, title }: { videoUrl?: string | null; title: string }) {
  const source = presentationVideoSource(videoUrl);

  if (!source) {
    return (
      <div
        data-testid="digital-presentation-placeholder"
        className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/20 px-6 text-center"
      >
        <Video className="h-8 w-8 text-[color:var(--muted-foreground)]" aria-hidden />
        <p className="mt-3 text-sm font-medium text-[color:var(--foreground)]">
          Vídeo da apresentação
        </p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          Espaço reservado para o arquivo que será hospedado no storage/CDN da Velox.
        </p>
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden rounded-lg bg-[color:var(--muted)]">
      <video src={source} controls preload="metadata" className="h-full w-full" aria-label={title}>
        <track kind="captions" />
      </video>
    </div>
  );
}

export function DigitalPresentationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const list = useServerFn(listarApresentacoesAmbiente);
  const save = useServerFn(salvarApresentacaoAmbiente);
  const [environment, setEnvironment] = useState<string>(ENVIRONMENT_PRESENTATION_KEYS[0]);
  const [items, setItems] = useState<PresentationItem[]>([]);
  const [draft, setDraft] = useState<PresentationDraft>({ ...EMPTY_DRAFT });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [investorView, setInvestorView] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await list({})) as PresentationItem[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a apresentação.");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    const found = items.find((item) => item.environment === environment);
    setDraft(
      found
        ? {
            videoUrl: found.videoUrl ?? "",
            description: found.introText ?? "",
            isPublished: found.isPublished,
          }
        : { ...EMPTY_DRAFT },
    );
  }, [environment, items]);

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          environment,
          introText: draft.description,
          videoUrl: draft.videoUrl,
          isPublished: draft.isPublished,
        },
      });
      setItems((await list({})) as PresentationItem[]);
      toast.success(`Apresentação da ${ENVIRONMENT_LABEL[environment]} salva.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const published = items.find((item) => item.environment === environment && item.isPublished);
  const visibleVideoUrl = investorView ? published?.videoUrl : draft.videoUrl;
  const visibleDescription = investorView ? published?.introText : draft.description;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apresentação Digital</DialogTitle>
          <DialogDescription>
            Vídeo e texto de contexto da apresentação vigente por ambiente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-[color:var(--border)] p-1">
            {ENVIRONMENT_PRESENTATION_KEYS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={environment === key ? "default" : "ghost"}
                onClick={() => {
                  setEnvironment(key);
                  setInvestorView(false);
                }}
              >
                {ENVIRONMENT_LABEL[key]}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setInvestorView((value) => !value)}
          >
            <Eye aria-hidden />
            {investorView ? "Voltar à edição" : "Ver como o investidor"}
          </Button>
        </div>

        {loading ? (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-[color:var(--border)] text-sm text-[color:var(--muted-foreground)]">
            Carregando apresentação…
          </div>
        ) : (
          <PresentationVideo
            videoUrl={visibleVideoUrl}
            title={`Apresentação — ${ENVIRONMENT_LABEL[environment]}`}
          />
        )}

        {investorView ? (
          <p className="min-h-10 whitespace-pre-line text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            {visibleDescription || "A legenda da apresentação será exibida aqui."}
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block text-xs text-[color:var(--muted-foreground)]">
              URL do vídeo no storage/CDN
              <input
                value={draft.videoUrl}
                onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })}
                placeholder="https://"
                className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>
            <label className="block text-xs text-[color:var(--muted-foreground)]">
              Legenda e texto de contexto
              <textarea
                rows={5}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="A legenda da apresentação será exibida aqui."
                className="mt-1 w-full resize-y rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={draft.isPublished}
                  onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })}
                />
                Publicada
              </label>
              <Button type="button" size="sm" disabled={busy || loading} onClick={() => void submit()}>
                <Save aria-hidden />
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}