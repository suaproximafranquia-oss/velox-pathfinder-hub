/**
 * Painel da Central dos Nomes.
 *
 * A tela NÃO processa lote nenhum: ela entrega o conteúdo (colagem ou
 * Word) ao servidor, que registra um trabalho e digere os nomes em
 * segundo plano. Fechar a aba, dar F5 ou voltar amanhã não interrompe
 * nada — ao voltar, a Central consulta o trabalho persistente e mostra
 * o progresso real.
 *
 * A listagem é paginada: o navegador nunca carrega a base inteira.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, FileUp } from "lucide-react";
import {
  listarNomesCentral,
  enviarNomesCentral,
  enviarWordCentral,
  excluirNomeCentral,
  situacaoImportacaoNomes,
} from "@/lib/relationship/name-central.functions";
import {
  NAME_BANDS,
  NAME_BAND_LABEL,
  nameBand,
  type NameLengthBand,
} from "@/lib/relationship/name-central";

type CentralName = { id: string; name: string; key: string; createdAt: string };
type ImportJob = {
  id: string;
  source: string;
  filename: string | null;
  status: "pendente" | "processando" | "concluido" | "erro";
  total: number;
  processed: number;
  added: number;
  existing: number;
  invalid: number;
  lastError: string | null;
  finishedAt: string | null;
};

const PAGE_SIZE = 300;

function fmt(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function NameCentralPanel() {
  const [names, setNames] = useState<CentralName[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paste, setPaste] = useState("");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CentralName | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPage = useCallback(async (term: string, offset: number) => {
    const page = (await listarNomesCentral({
      data: { search: term, offset, limit: PAGE_SIZE },
    })) as { items: CentralName[]; total: number };
    setTotal(page.total);
    setNames((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
  }, []);

  // Primeira carga e recarga a cada busca (a busca consulta o servidor).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await loadPage(search, 0);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível carregar a Central.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, loadPage]);

  // Acompanhamento do trabalho persistente no servidor.
  const refreshJob = useCallback(async () => {
    try {
      const status = (await situacaoImportacaoNomes()) as {
        job: ImportJob | null;
        total: number;
      };
      setJob(status.job);
      setTotal(status.total);
      return status.job;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const current = await refreshJob();
      if (!alive) return;
      const running = current?.status === "pendente" || current?.status === "processando";
      timer = setTimeout(() => void tick(), running ? 4000 : 30000);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refreshJob]);

  // Enquanto importa, a lista visível também acompanha o progresso.
  const importing = job?.status === "pendente" || job?.status === "processando";
  useEffect(() => {
    if (!importing) return;
    const id = setInterval(() => {
      void loadPage(search, 0).catch(() => undefined);
    }, 8000);
    return () => clearInterval(id);
  }, [importing, search, loadPage]);

  async function handleAdd() {
    if (!paste.trim() || saving) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    const text = paste;
    setPaste("");
    inputRef.current?.focus();
    try {
      const result = await enviarNomesCentral({ data: { text } });
      setFeedback(
        `Recebemos ${fmt(result.total)} ${result.total === 1 ? "nome" : "nomes"}. O processamento continua no servidor — pode fechar a página.`,
      );
      await refreshJob();
    } catch (e) {
      setPaste(text);
      setError(e instanceof Error ? e.message : "Não foi possível enviar os nomes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleWord(file: File) {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buffer.length; i += 8192) {
        binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
      }
      const result = await enviarWordCentral({
        data: { filename: file.name, base64: btoa(binary) },
      });
      setFeedback(
        `Arquivo recebido com ${fmt(result.total)} nomes. O processamento continua no servidor — pode fechar a página.`,
      );
      await refreshJob();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo Word.");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    try {
      await excluirNomeCentral({ data: { id: target.id } });
      setNames((prev) => prev.filter((n) => n.id !== target.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setFeedback(`Nome ${target.name} removido da Central.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir o nome.");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<NameLengthBand, CentralName[]>();
    for (const band of NAME_BANDS) map.set(band, []);
    for (const n of names) map.get(nameBand(n.name))!.push(n);
    for (const band of NAME_BANDS) {
      map.get(band)!.sort((a, b) => a.name.length - b.name.length);
    }
    return map;
  }, [names]);

  const bandWidth: Record<NameLengthBand, string> = {
    ate6: "w-[7.5rem]",
    de7a10: "w-[10.5rem]",
    de11a15: "w-[14rem]",
    acima15: "w-[19rem]",
  };

  const filteredTotal = total;
  const hasMore = names.length < filteredTotal;

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4 space-y-3">
        <p className="text-[11px] text-[color:var(--muted-foreground)]">
          Cole um nome ou centenas de milhares de nomes (um por linha), ou envie um
          arquivo Word. Assim que o servidor recebe, o processamento continua sozinho —
          você pode fechar a página. A Central guarda apenas o primeiro nome e nunca
          altera o cadastro original de nenhum lead.
        </p>
        <textarea
          ref={inputRef}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={8}
          placeholder="Cole os nomes aqui (Ctrl+V)"
          className="w-full resize-y rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={saving || !paste.trim()}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--foreground)] disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Adicionar nomes
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-40"
          >
            <FileUp className="h-3.5 w-3.5" />
            Upload Word
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleWord(file);
            }}
          />
          {feedback ? (
            <span className="text-[11px] text-[color:var(--muted-foreground)]">{feedback}</span>
          ) : null}
          {error ? <span className="text-[11px] text-red-400">{error}</span> : null}
        </div>

        {job ? (
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]">
            {importing ? (
              <>
                <span className="text-[color:var(--foreground)]">
                  Importando nomes: {fmt(job.processed)} / {fmt(job.total)}
                </span>{" "}
                · {fmt(job.added)} novos · {fmt(job.existing)} já cadastrados
                {job.invalid > 0 ? ` · ${fmt(job.invalid)} não aproveitados` : ""}
                {job.filename ? ` · ${job.filename}` : ""}
              </>
            ) : job.status === "concluido" ? (
              <>
                Importação concluída. {fmt(job.added)} novos · {fmt(job.existing)} já
                cadastrados
                {job.invalid > 0 ? ` · ${fmt(job.invalid)} não aproveitados` : ""}
              </>
            ) : (
              <span className="text-red-400">
                A última importação parou: {job.lastError ?? "erro desconhecido"}. Os nomes
                já gravados foram mantidos.
              </span>
            )}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nome..."
            className="w-full max-w-xs rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
          />
          <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            {fmt(filteredTotal)} {filteredTotal === 1 ? "nome cadastrado" : "nomes cadastrados"}
          </span>
        </div>

        {loading ? (
          <p className="text-[11px] text-[color:var(--muted-foreground)]">Carregando…</p>
        ) : names.length === 0 ? (
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Nenhum nome para exibir.
          </p>
        ) : (
          <>
            {NAME_BANDS.map((band) => {
              const items = grouped.get(band)!;
              if (items.length === 0) return null;
              return (
                <div key={band} className="space-y-2">
                  <h2 className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                    {NAME_BAND_LABEL[band]} · {fmt(items.length)}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {items.map((n) => (
                      <span
                        key={n.id}
                        className={`inline-flex ${bandWidth[band]} items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)]/60 px-3 py-1.5 text-sm`}
                      >
                        <span className="truncate">{n.name}</span>
                        <button
                          type="button"
                          aria-label={`Excluir ${n.name}`}
                          onClick={() => setPendingDelete(n)}
                          className="text-[color:var(--muted-foreground)] hover:text-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {hasMore ? (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    setLoadingMore(true);
                    void loadPage(search, names.length)
                      .catch(() => undefined)
                      .finally(() => setLoadingMore(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-40"
                >
                  {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Carregar mais ({fmt(names.length)} de {fmt(filteredTotal)})
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] p-5 space-y-4">
            <p className="text-sm">
              Deseja excluir o nome <strong>{pendingDelete.name}</strong> da Central dos
              Nomes?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
