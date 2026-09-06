/**
 * PRÉVIA "VER COMO O INVESTIDOR" — APRESENTAÇÃO VIGENTE DO AMBIENTE.
 *
 * Mostra exatamente o que o investidor vê: texto de abertura e vídeo da
 * apresentação vigente do ambiente escolhido. Não usa capítulos antigos e
 * não cria, altera nem apaga capítulo algum.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import {
  ENVIRONMENT_PRESENTATION_KEYS,
  listarApresentacoesAmbiente,
} from "@/lib/relationship/presentation.functions";

const LABEL: Record<string, string> = {
  financeira: "Financeira",
  solar: "Solar",
  seguradora: "Seguradora",
};

type Item = {
  environment: string;
  introText: string | null;
  videoUrl: string | null;
  isPublished: boolean;
};

export function EnvironmentPresentationPreview() {
  const list = useServerFn(listarApresentacoesAmbiente);
  const [items, setItems] = useState<Item[]>([]);
  const [environment, setEnvironment] = useState<string>(
    ENVIRONMENT_PRESENTATION_KEYS[0],
  );
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await list({})) as Item[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar apresentações.");
    }
  }, [list]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = items.find(
    (item) => item.environment === environment && item.isPublished,
  );

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="h-4 w-4" aria-hidden />
          Pré-visualização da apresentação vigente
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            className="rounded border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1.5 text-xs text-[color:var(--foreground)]"
          >
            {ENVIRONMENT_PRESENTATION_KEYS.map((key) => (
              <option key={key} value={key}>
                {LABEL[key]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPreview((value) => !value)}
            className="rounded border border-[color:var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]"
          >
            {preview ? "Ocultar" : "Ver como o investidor"}
          </button>
        </div>
      </div>

      {preview ? (
        current ? (
          <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              {LABEL[environment]} · vigente
            </p>
            {current.introText ? (
              <p className="mt-2 whitespace-pre-line text-sm">{current.introText}</p>
            ) : (
              <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                Texto de abertura ainda não definido.
              </p>
            )}
            {current.videoUrl ? (
              <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black/40">
                <iframe
                  src={current.videoUrl}
                  title={`Apresentação vigente — ${LABEL[environment]}`}
                  loading="lazy"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
                Vídeo ainda não definido.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">
            Nenhuma apresentação publicada para {LABEL[environment]}.
          </p>
        )
      ) : (
        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
          A prévia mostra a apresentação vigente do ambiente escolhido — texto de abertura e vídeo.
        </p>
      )}
    </section>
  );
}
