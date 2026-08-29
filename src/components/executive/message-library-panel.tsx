import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Film, History, Loader2, MessageSquareText, Save, Tag } from "lucide-react";
import {
  listarConteudosDaBiblioteca,
  listarMensagensBiblioteca,
  importarBibliotecaOficial,
  listarVinculosDeEtapa,
  publicarVersaoMensagem,
  removerVinculoDeEtapa,
  renomearRotuloEtapa,
  vincularConteudoAEtapa,
} from "@/lib/relationship/library.functions";

type LibraryMessage = {
  id: string;
  stepKey: string;
  code: string | null;
  title: string;
  displayLabel: string;
  body: string;
  bodyWithoutName: string | null;
  version: number;
  active: boolean;
  createdAt: string;
  createdByName: string;
  notes: string | null;
};

type LibraryContent = { id: string; name: string; kind: string; active: boolean };
type StepBinding = {
  stepKey: string;
  contentId: string;
  contentName: string | null;
  contentKind: string | null;
};

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";
const gold =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-2 text-xs text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40";

/**
 * MENSAGENS DO MOTOR — fonte oficial versionada.
 *
 * Editar aqui NÃO altera o texto já enviado: publica a versão seguinte.
 * A versão anterior fica no histórico e os envios antigos continuam
 * mostrando exatamente o que foi enviado (snapshot).
 */
export function MessageLibraryPanel() {
  const [messages, setMessages] = useState<LibraryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftWithoutName, setDraftWithoutName] = useState("");
  const [label, setLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contents, setContents] = useState<LibraryContent[]>([]);
  const [bindings, setBindings] = useState<StepBinding[]>([]);
  const [bindingBusy, setBindingBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await listarMensagensBiblioteca()) as LibraryMessage[];
      setMessages(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a Biblioteca.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Vínculo etapa ↔ conteúdo: a Biblioteca de Conteúdos é a mesma de
  // sempre; aqui apenas declaramos qual material pertence a cada etapa.
  useEffect(() => {
    void (async () => {
      try {
        const [lib, links] = await Promise.all([
          listarConteudosDaBiblioteca() as Promise<LibraryContent[]>,
          listarVinculosDeEtapa() as Promise<StepBinding[]>,
        ]);
        setContents(lib.filter((c) => c.active));
        setBindings(links);
      } catch {
        /* a Biblioteca de Mensagens continua utilizável sem os vínculos */
      }
    })();
  }, []);

  const boundContent = step ? (bindings.find((b) => b.stepKey === step) ?? null) : null;

  async function bindContent(contentId: string) {
    if (!step || bindingBusy) return;
    setBindingBusy(true);
    try {
      const next = contentId
        ? ((await vincularConteudoAEtapa({ data: { stepKey: step, contentId } })) as StepBinding[])
        : ((await removerVinculoDeEtapa({ data: { stepKey: step } })) as StepBinding[]);
      setBindings(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao vincular o conteúdo.");
    } finally {
      setBindingBusy(false);
    }
  }

  const steps = useMemo(() => {
    const map = new Map<string, LibraryMessage[]>();
    for (const message of messages) {
      const list = map.get(message.stepKey) ?? [];
      list.push(message);
      map.set(message.stepKey, list);
    }
    return map;
  }, [messages]);

  const selected = step ? (steps.get(step) ?? []) : [];
  const active = selected.find((m) => m.active) ?? selected[0] ?? null;

  function openStep(key: string) {
    setStep(key);
    const list = steps.get(key) ?? [];
    const current = list.find((m) => m.active) ?? list[0];
    setDraft(current?.body ?? "");
    setDraftWithoutName(current?.bodyWithoutName ?? "");
    setLabel(current?.displayLabel ?? key);
    setError(null);
  }

  /**
   * Renomear é APENAS rótulo: não publica versão nem toca no histórico.
   */
  async function renameStep() {
    if (!step || renaming) return;
    setRenaming(true);
    try {
      const next = (await renomearRotuloEtapa({
        data: { stepKey: step, label },
      })) as LibraryMessage[];
      setMessages(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao renomear a etapa.");
    } finally {
      setRenaming(false);
    }
  }

  async function publish() {
    if (!step || !draft.trim() || saving) return;
    setSaving(true);
    try {
      await publicarVersaoMensagem({
        data: {
          stepKey: step,
          body: draft,
          bodyWithoutName: draftWithoutName.trim() ? draftWithoutName : null,
        },
      });
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar a nova versão.");
    } finally {
      setSaving(false);
    }
  }

  async function importOfficial() {
    if (importing) return;
    setImporting(true);
    try {
      const entries = (await importarBibliotecaOficial()) as {
        stepKey: string;
        outcome: string;
      }[];
      const changed = entries.filter((e) => e.outcome !== "inalterada");
      setImportNote(
        changed.length === 0
          ? "Biblioteca já idêntica ao Word oficial — nenhuma versão nova criada."
          : `Atualizadas ${changed.length} etapa(s): ${changed.map((e) => e.stepKey).join(", ")}.`,
      );
      await load();
      if (step) openStep(step);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao importar o Word oficial.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className={card}>
      <header className="mb-4 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-[color:var(--gold)]" />
        <div>
          <h2 className="text-sm font-medium">Mensagens do Motor</h2>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Fonte oficial das cadências. Editar publica uma nova versão — o histórico
            enviado nunca é reescrito.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void importOfficial()}
          disabled={importing}
          className={`${gold} ml-auto`}
        >
          {importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Importar Word oficial
        </button>
      </header>

      {importNote ? (
        <p className="mb-3 text-[11px] text-[color:var(--gold)]">{importNote}</p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
            {[...steps.keys()].map((key) => {
              const list = steps.get(key) ?? [];
              const current = list.find((m) => m.active) ?? list[0];
              /* Sem versão ativa = o motor NÃO envia esta etapa. O
                 rótulo continua editável; o texto é que falta. */
              const awaiting = !list.some((m) => m.active && m.body.trim());
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => openStep(key)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                      step === key
                        ? "border-[color:var(--gold)] text-[color:var(--gold)]"
                        : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--gold)]/40"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {current?.displayLabel ?? key}
                      <span className="ml-1 text-[10px] opacity-60">({key})</span>
                    </span>
                    <span className="shrink-0 text-[10px]">
                      {awaiting ? (
                        <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-400">
                          aguardando texto oficial
                        </span>
                      ) : (
                        `v${current?.version}`
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="space-y-3">
            {step ? (
              <>
                {/* RÓTULO VISÍVEL — apresentação apenas. A chave técnica
                    ({step}) nunca muda: fila, snapshots e histórico
                    continuam gravados nela. */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="min-w-56 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-xs outline-none focus:border-[color:var(--gold)]/50"
                    placeholder={`Rótulo exibido para ${step}`}
                  />
                  <button
                    type="button"
                    onClick={() => void renameStep()}
                    disabled={renaming || label === (active?.displayLabel ?? "")}
                    className={gold}
                  >
                    {renaming ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Tag className="h-3.5 w-3.5" />
                    )}
                    Salvar rótulo
                  </button>
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">
                    Chave técnica {step} — imutável.
                  </span>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
                  placeholder="Texto oficial desta etapa. Variáveis: {{nome_investidor}}, {{nome_executivo}}, {{link_portal}}."
                />
                <div>
                  <p className="mb-1 text-[11px] text-[color:var(--muted-foreground)]">
                    Versão SEM nome — usada quando o nome do investidor não foi validado.
                    Deixe em branco para usar sempre o texto acima.
                  </p>
                  <textarea
                    value={draftWithoutName}
                    onChange={(e) => setDraftWithoutName(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
                    placeholder="Redação oficial sem tratamento nominal."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={
                      saving ||
                      !draft.trim() ||
                      (draft === active?.body &&
                        draftWithoutName === (active?.bodyWithoutName ?? ""))
                    }
                    className={gold}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Publicar versão {active ? active.version + 1 : 1}
                  </button>
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">
                    Ativa hoje: {active ? `versão ${active.version}` : "nenhuma"}
                  </span>
                </div>

                <div className="rounded-xl border border-[color:var(--border)] p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] text-[color:var(--muted-foreground)]">
                    <Film className="h-3.5 w-3.5" /> Vídeo/conteúdo vinculado a esta etapa
                  </p>
                  <select
                    value={boundContent?.contentId ?? ""}
                    disabled={bindingBusy}
                    onChange={(e) => void bindContent(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-xs outline-none focus:border-[color:var(--gold)]/50"
                  >
                    <option value="">Sem vínculo — o motor escolhe pelo grupo de conteúdo</option>
                    {contents.map((content) => (
                      <option key={content.id} value={content.id}>
                        {content.name} ({content.kind})
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
                    O motor busca exatamente o material vinculado. Nada é inferido por nome
                    ou posição e nenhum arquivo é duplicado.
                  </p>
                </div>

                <div className="rounded-xl border border-[color:var(--border)] p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] text-[color:var(--muted-foreground)]">
                    <History className="h-3.5 w-3.5" /> Histórico de versões
                  </p>
                  <ul className="space-y-2">
                    {selected.map((message) => (
                      <li key={message.id} className="text-[11px]">
                        <span className="text-[color:var(--foreground)]">
                          v{message.version}
                          {message.active ? " · ativa" : ""}
                        </span>
                        <span className="text-[color:var(--muted-foreground)]">
                          {" "}
                          — {new Date(message.createdAt).toLocaleString("pt-BR")} ·{" "}
                          {message.createdByName}
                        </span>
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[color:var(--muted-foreground)]">
                          {message.body || "(slot vazio — envio bloqueado)"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Selecione uma etapa para ver e editar o texto oficial.
              </p>
            )}
            {error ? <p className="text-[11px] text-rose-500">{error}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
