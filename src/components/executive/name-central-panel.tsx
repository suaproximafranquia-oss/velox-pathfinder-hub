/**
 * Painel da Central dos Nomes. Toda a persistência vive no servidor —
 * nada é guardado no navegador. A lista exibida é sempre a devolvida
 * pelo servidor após cada operação.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import {
  listarNomesCentral,
  adicionarNomesCentral,
  excluirNomeCentral,
} from "@/lib/relationship/name-central.functions";
import {
  NAME_BANDS,
  NAME_BAND_LABEL,
  nameBand,
  nameCentralKey,
  type NameLengthBand,
} from "@/lib/relationship/name-central";

type CentralName = { id: string; name: string; key: string; createdAt: string };

export function NameCentralPanel() {
  const [names, setNames] = useState<CentralName[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paste, setPaste] = useState("");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CentralName | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        setNames((await listarNomesCentral()) as CentralName[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível carregar a Central.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAdd() {
    if (!paste.trim() || saving) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    const text = paste;
    // A caixa é liberada assim que o envio é aceito, pronta para nova colagem.
    setPaste("");
    inputRef.current?.focus();
    try {
      const result = await adicionarNomesCentral({ data: { text } });
      setFeedback(
        `${result.added} ${result.added === 1 ? "nome adicionado" : "nomes adicionados"}. ${result.existing} já ${result.existing === 1 ? "estava cadastrado" : "estavam cadastrados"}.`,
      );
      setNames((await listarNomesCentral()) as CentralName[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível adicionar os nomes.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    try {
      setNames((await excluirNomeCentral({ data: { id: target.id } })) as CentralName[]);
      setFeedback(`Nome ${target.name} removido da Central.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir o nome.");
    }
  }

  const filtered = useMemo(() => {
    const key = nameCentralKey(search);
    if (!key) return names;
    return names.filter((n) => n.key.includes(key));
  }, [names, search]);

  const grouped = useMemo(() => {
    const map = new Map<NameLengthBand, CentralName[]>();
    for (const band of NAME_BANDS) map.set(band, []);
    for (const n of filtered) map.get(nameBand(n.name))!.push(n);
    for (const band of NAME_BANDS) {
      map.get(band)!.sort((a, b) => a.name.length - b.name.length);
    }
    return map;
  }, [filtered]);

  const bandWidth: Record<NameLengthBand, string> = {
    ate6: "w-[7.5rem]",
    de7a10: "w-[10.5rem]",
    de11a15: "w-[14rem]",
    acima15: "w-[19rem]",
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-4 space-y-3">
        <p className="text-[11px] text-[color:var(--muted-foreground)]">
          Cole um nome ou milhares de nomes (um por linha). A Central guarda apenas o
          primeiro nome e nunca altera o cadastro original de nenhum lead.
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
          {feedback ? (
            <span className="text-[11px] text-[color:var(--muted-foreground)]">{feedback}</span>
          ) : null}
          {error ? <span className="text-[11px] text-red-400">{error}</span> : null}
        </div>
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
            {names.length.toLocaleString("pt-BR")}{" "}
            {names.length === 1 ? "nome cadastrado" : "nomes cadastrados"}
          </span>
        </div>

        {loading ? (
          <p className="text-[11px] text-[color:var(--muted-foreground)]">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Nenhum nome para exibir.
          </p>
        ) : (
          NAME_BANDS.map((band) => {
            const items = grouped.get(band)!;
            if (items.length === 0) return null;
            return (
              <div key={band} className="space-y-2">
                <h2 className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                  {NAME_BAND_LABEL[band]} · {items.length}
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
          })
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
