import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { PublicDigitalPresentation } from "@/components/portal/public-digital-presentation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listarApresentacoesAmbiente,
  salvarApresentacaoAmbiente,
} from "@/lib/relationship/presentation.functions";

type PresentationItem = {
  environment: string;
  introText: string | null;
  muxPlaybackId: string | null;
  isPublished: boolean;
};

type PresentationDraft = {
  muxPlaybackId: string;
  introText: string;
  isPublished: boolean;
};

const EMPTY_DRAFT: PresentationDraft = {
  muxPlaybackId: "",
  introText: "",
  isPublished: false,
};

export function DigitalPresentationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const list = useServerFn(listarApresentacoesAmbiente);
  const save = useServerFn(salvarApresentacaoAmbiente);
  const [draft, setDraft] = useState<PresentationDraft>({ ...EMPTY_DRAFT });
  const [published, setPublished] = useState<PresentationItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [investorView, setInvestorView] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = (await list({})) as PresentationItem[];
      const finance = rows.find((item) => item.environment === "financeira") ?? null;
      setPublished(finance?.isPublished ? finance : null);
      setDraft(
        finance
          ? {
              muxPlaybackId: finance.muxPlaybackId ?? "",
              introText: finance.introText ?? "",
              isPublished: finance.isPublished,
            }
          : { ...EMPTY_DRAFT },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a apresentação.");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function submit() {
    setBusy(true);
    try {
      await save({
        data: {
          environment: "financeira",
          introText: draft.introText,
          muxPlaybackId: draft.muxPlaybackId,
          isPublished: draft.isPublished,
        },
      });
      await load();
      toast.success("Apresentação da Financeira salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apresentação Digital</DialogTitle>
          <DialogDescription>Configuração da experiência pública da Financeira.</DialogDescription>
        </DialogHeader>

        {investorView ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <PublicDigitalPresentation
              presentation={{
                muxPlaybackId: published?.muxPlaybackId ?? null,
                introText: published?.introText ?? null,
              }}
            />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">Ambiente</p>
              <p className="mt-1 text-sm font-medium">Financeira</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mux-playback-id">Playback ID do vídeo Mux</Label>
              <Input
                id="mux-playback-id"
                value={draft.muxPlaybackId}
                onChange={(event) => setDraft({ ...draft, muxPlaybackId: event.target.value })}
                placeholder="Playback ID"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="presentation-context">Texto de contexto da apresentação</Label>
              <Textarea
                id="presentation-context"
                rows={5}
                value={draft.introText}
                onChange={(event) => setDraft({ ...draft, introText: event.target.value })}
                placeholder="Texto exibido abaixo do vídeo na experiência pública."
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="presentation-published"
                checked={draft.isPublished}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, isPublished: checked === true })
                }
              />
              <Label htmlFor="presentation-published">Publicada</Label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setInvestorView((value) => !value)}
          >
            <Eye aria-hidden />
            {investorView ? "Voltar à configuração" : "Ver como o investidor"}
          </Button>
          {!investorView ? (
            <Button type="button" disabled={busy || loading} onClick={() => void submit()}>
              <Save aria-hidden />
              Salvar
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}