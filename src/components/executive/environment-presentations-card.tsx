/**
 * APRESENTAÇÃO VIGENTE POR AMBIENTE.
 *
 * UMA apresentação vigente por ambiente (Financeira, Solar, Seguradora),
 * com texto de abertura e um vídeo. Camada separada dos capítulos
 * versionados: nada aqui altera apresentações já emitidas, e os
 * ambientes continuam isolados entre si.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Globe2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  ENVIRONMENT_PRESENTATION_KEYS,
  listarApresentacoesAmbiente,
  salvarApresentacaoAmbiente,
} from "@/lib/relationship/presentation.functions";

const LABEL: Record<string, string> = {
  financeira: "Financeira",
  solar: "Solar",
  seguradora: "Seguradora",
};

type Draft = { introText: string; videoUrl: string; isPublished: boolean };

const EMPTY: Draft = { introText: "", videoUrl: "", isPublished: false };

const input =
  "mt-1 w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)]";

export function EnvironmentPresentationsCard() {
  const list = useServerFn(listarApresentacoesAmbiente);
  const save = useServerFn(salvarApresentacaoAmbiente);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await list({});
      const next: Record<string, Draft> = {};
      for (const key of ENVIRONMENT_PRESENTATION_KEYS) next[key] = { ...EMPTY };
      for (const row of rows) {
        next[row.environment] = {
          introText: row.introText ?? "",
          videoUrl: row.videoUrl ?? "",
          isPublished: row.isPublished,
        };
      }
      setDrafts(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar apresentações.");
    }
  }, [list]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(environment: string) {
    const draft = drafts[environment] ?? EMPTY;
    setBusy(environment);
    try {
      await save({ data: { environment, ...draft } });
      toast.success(`Apresentação da ${LABEL[environment]} salva.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Globe2 className="h-4 w-4" aria-hidden />
        Apresentação vigente por ambiente
      </h2>
      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
        Uma apresentação vigente por ambiente. Financeira, Solar e Seguradora
        permanecem separadas: salvar uma nunca altera as outras.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {ENVIRONMENT_PRESENTATION_KEYS.map((key) => {
          const draft = drafts[key] ?? EMPTY;
          return (
            <div key={key} className="rounded-lg border border-[color:var(--border)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                {LABEL[key]}
              </p>
              <label className="mt-3 block text-xs text-[color:var(--muted-foreground)]">
                Texto de abertura
                <textarea
                  rows={3}
                  value={draft.introText}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [key]: { ...draft, introText: e.target.value } })
                  }
                  className={input}
                />
              </label>
              <label className="mt-3 block text-xs text-[color:var(--muted-foreground)]">
                URL do vídeo
                <input
                  value={draft.videoUrl}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [key]: { ...draft, videoUrl: e.target.value } })
                  }
                  className={input}
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={draft.isPublished}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [key]: { ...draft, isPublished: e.target.checked } })
                  }
                />
                Publicada
              </label>
              <button
                type="button"
                disabled={busy === key}
                onClick={() => void submit(key)}
                className="mt-4 inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                Salvar
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
