import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Film,
  GripVertical,
  History,
  Loader2,
  MessageSquareText,
  Save,
  Tag,
} from "lucide-react";
import {
  listarMensagensBiblioteca,
  
  publicarVersaoMensagem,
  renomearRotuloEtapa,
  reordenarBiblioteca,
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
  contentUrl: string | null;
  contentLabel: string | null;
  /** Contexto do conteúdo (E7/E8): SEM_CONTATO ou MATERIAL_ENVIADO. */
  stepContext: "SEM_CONTATO" | "MATERIAL_ENVIADO" | null;
  /** A etapa existe na configuração do motor (é operacional). */
  official: boolean;
  /** A chave é a identidade atual (não histórica) — é o que se lista. */
  currentIdentity: boolean;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * E7/E8 TÊM DOIS CONTEXTOS INDEPENDENTES: investidor que nunca
   * respondeu (SEM_CONTATO) e investidor que já recebeu o material
   * (MATERIAL_ENVIADO). Cada contexto tem os seus próprios textos com
   * nome e sem nome — quatro conteúdos ao todo, sem aproveitamento de
   * um no outro.
   */
  const [ctx, setCtx] = useState<"SEM_CONTATO" | "MATERIAL_ENVIADO">("SEM_CONTATO");
  const [contentUrl, setContentUrl] = useState("");
  const [contentLabel, setContentLabel] = useState("");
  /* BLOCO 3 — criação e ordenação visual. */
  const [order, setOrder] = useState<string[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

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

  /**
   * ETAPAS OPERACIONAIS = as que a CONFIGURAÇÃO do motor reconhece.
   * Registros de chaves que saíram (ou nunca fizeram parte) da
   * configuração continuam gravados, mas fora da lista operacional.
   */
  const steps = useMemo(() => {
    const map = new Map<string, LibraryMessage[]>();
    for (const message of messages) {
      if (!message.currentIdentity) continue;
      const list = map.get(message.stepKey) ?? [];
      list.push(message);
      map.set(message.stepKey, list);
    }
    return map;
  }, [messages]);




  /* A ordem vem do servidor (posição salva) e é espelhada localmente
     apenas para o arrastar fluir sem esperar a gravação. */
  useEffect(() => {
    setOrder([...steps.keys()]);
  }, [steps]);

  const visibleSteps = useMemo(() => {
    const known = [...steps.keys()];
    const ordered = order.filter((key) => steps.has(key));
    return [...ordered, ...known.filter((key) => !ordered.includes(key))];
  }, [order, steps]);

  const needsContext = step === "E7" || step === "E8";
  const selected = step
    ? (steps.get(step) ?? []).filter((m) => (needsContext ? m.stepContext === ctx : true))
    : [];
  const active = selected.find((m) => m.active) ?? selected[0] ?? null;

  /* Trocar de contexto recarrega os textos DAQUELE contexto. */
  useEffect(() => {
    if (!needsContext || !step) return;
    const list = (steps.get(step) ?? []).filter((m) => m.stepContext === ctx);
    const current = list.find((m) => m.active) ?? list[0];
    setDraft(current?.body ?? "");
    setDraftWithoutName(current?.bodyWithoutName ?? "");
    setContentUrl(current?.contentUrl ?? "");
    setContentLabel(current?.contentLabel ?? "");
  }, [ctx, needsContext, step, steps]);


  /** Move a etapa arrastada para a posição de destino e persiste. */
  async function dropOn(targetKey: string) {
    const source = dragKey;
    setDragKey(null);
    if (!source || source === targetKey) return;
    const next = visibleSteps.filter((k) => k !== source);
    const index = next.indexOf(targetKey);
    next.splice(index < 0 ? next.length : index, 0, source);
    setOrder(next);
    setSavingOrder(true);
    try {
      const updated = (await reordenarBiblioteca({
        data: { stepKeys: next },
      })) as LibraryMessage[];
      setMessages(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a ordem.");
      await load();
    } finally {
      setSavingOrder(false);
    }
  }

  /** Cria a etapa na Biblioteca. Ela NÃO entra em nenhum fluxo. */
  function openStep(key: string) {
    setStep(key);
    const contextual = key === "E7" || key === "E8";
    const list = (steps.get(key) ?? []).filter((m) =>
      contextual ? m.stepContext === ctx : true,
    );
    const current = list.find((m) => m.active) ?? list[0];
    setDraft(current?.body ?? "");
    setDraftWithoutName(current?.bodyWithoutName ?? "");
    setLabel(current?.displayLabel ?? key);
    setContentUrl(current?.contentUrl ?? "");
    setContentLabel(current?.contentLabel ?? "");
    setError(null);
  }

  /**
   * IDENTIDADE DA ETAPA: "CÓDIGO — Título". Mudar só o título mantém a
   * chave; mudar o código faz a chave técnica acompanhar (todas as
   * versões seguem juntas, nada é apagado). Não publica versão.
   */
  async function renameStep() {
    if (!step || renaming) return;
    setRenaming(true);
    try {
      const next = (await renomearRotuloEtapa({
        data: { stepKey: step, label },
      })) as { stepKey: string; messages: LibraryMessage[] };
      setMessages(next.messages);
      setStep(next.stepKey);
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
          stepContext: needsContext ? ctx : null,
          body: draft,
          bodyWithoutName: draftWithoutName.trim() ? draftWithoutName : null,
          contentUrl: contentUrl.trim() ? contentUrl.trim() : null,
          contentLabel: contentLabel.trim() ? contentLabel.trim() : null,
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

  return (
    <section className={card}>
      <header className="mb-4 flex items-start gap-2">
        <MessageSquareText className="mt-0.5 h-4 w-4 text-[color:var(--gold)]" />
        <div className="flex-1">
          <h2 className="text-sm font-medium">Mensagens do Motor</h2>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Fonte oficial das cadências. A lista de etapas vem da configuração do
            motor; aqui se escreve e versiona o texto de cada uma. Editar publica uma
            nova versão — o histórico enviado nunca é reescrito.
          </p>
        </div>
      </header>





      {loading ? (
        <p className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)]">
              <GripVertical className="h-3 w-3" /> Arraste para organizar a exibição
              {savingOrder ? " · salvando…" : ""}
            </p>
            {/* ORDEM VISUAL da Biblioteca. Não altera a ordem de execução
                do motor: fluxo e prazos seguem inalterados. */}
            <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
              {visibleSteps.map((key) => {
                const list = steps.get(key) ?? [];
                const contextual = key === "E7" || key === "E8";
                const current = list.find((m) => m.active) ?? list[0];
                /* Sem versão ativa = o motor NÃO envia esta etapa. Em E7/E8
                   cada contexto precisa da própria versão ativa; uma linha
                   sem contexto não conta para elas. O rótulo continua
                   editável; o texto é que falta. */
                const hasText = (c: LibraryMessage["stepContext"]) =>
                  list.some((m) => m.stepContext === c && m.active && m.body.trim());
                const pendingContexts = contextual
                  ? (["SEM_CONTATO", "MATERIAL_ENVIADO"] as const).filter((c) => !hasText(c))
                  : [];
                const awaiting = contextual ? pendingContexts.length > 0 : !hasText(null);
                const labelText = (current?.displayLabel ?? key).replace(
                  new RegExp(`^${key}\\s*[—–-]\\s*`),
                  "",
                );
                return (
                  <li
                    key={key}
                    draggable
                    onDragStart={() => setDragKey(key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void dropOn(key);
                    }}
                    onDragEnd={() => setDragKey(null)}
                    className={dragKey === key ? "opacity-50" : ""}
                  >
                    <button
                      type="button"
                      onClick={() => openStep(key)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                        step === key
                          ? "border-[color:var(--gold)] text-[color:var(--gold)]"
                          : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--gold)]/40"
                      }`}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab opacity-50" />
                      <span className="shrink-0 rounded-md border border-current/30 px-1.5 py-0.5 font-mono text-[10px]">
                        {key}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{labelText}</span>
                      <span className="shrink-0 text-[10px]">
                        {awaiting ? (
                          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-400">
                            {contextual && pendingContexts.length === 1
                              ? `${pendingContexts[0]} aguardando texto`
                              : "aguardando texto oficial"}
                          </span>
                        ) : contextual ? (
                          "2 contextos ativos"
                        ) : (
                          `v${current?.version}`
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Registros de chaves fora da configuração atual do motor
                permanecem gravados no banco, mas NÃO são apresentados
                nesta interface editorial. Nada é apagado. */}

          </div>

          <div className="space-y-3">

            {step ? (
              <>
                {/* IDENTIDADE DA ETAPA — o código digitado antes do "—"
                    é a chave técnica. Trocar o código move a etapa (e
                    todas as suas versões) para a nova chave. */}
                {needsContext ? (
                  <div className="rounded-xl border border-[color:var(--border)] p-3">
                    <p className="mb-2 text-[11px] text-[color:var(--muted-foreground)]">
                      {step} tem dois contextos independentes, cada um com texto COM
                      NOME e SEM NOME (quatro conteúdos). Nenhum contexto aproveita o
                      texto do outro; contexto sem versão ativa fica bloqueado.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["SEM_CONTATO", "Investidor que nunca respondeu"],
                          ["MATERIAL_ENVIADO", "Investidor que já recebeu o material"],
                        ] as const
                      ).map(([value, text]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setCtx(value)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
                            ctx === value
                              ? "border-[color:var(--gold)] text-[color:var(--gold)]"
                              : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--gold)]/40"
                          }`}
                        >
                          <span className="font-mono">{value}</span> · {text}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="min-w-56 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-xs outline-none focus:border-[color:var(--gold)]/50"
                    placeholder={`${step} — Título da etapa`}
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
                    Salvar identidade
                  </button>
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">
                    Chave técnica {step}
                  </span>
                </div>
                <p className="text-[11px] text-[color:var(--muted-foreground)]">
                  <span className="font-mono">COM_NOME</span> — usada quando o primeiro nome
                  do investidor foi validado (Central dos Nomes).
                </p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
                  placeholder="Texto oficial desta etapa. Variáveis: {{nome_investidor}}, {{nome_executivo}}, {{link_portal}}."
                />
                <div>
                  <p className="mb-1 text-[11px] text-[color:var(--muted-foreground)]">
                    <span className="font-mono">SEM_NOME</span> — usada quando o nome do
                    investidor não foi validado. Deixe em branco para usar sempre o texto
                    acima.
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
                        draftWithoutName === (active?.bodyWithoutName ?? "") &&
                        contentUrl === (active?.contentUrl ?? "") &&
                        contentLabel === (active?.contentLabel ?? ""))
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
                    <Film className="h-3.5 w-3.5" /> Link desta mensagem
                  </p>
                  {/* A mensagem é autossuficiente: o link pertence a ela e
                      viaja junto na versão publicada. Não existe mais
                      cadastro de conteúdo separado. */}
                  <input
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-xs outline-none focus:border-[color:var(--gold)]/50"
                    placeholder="https://… (vídeo, material ou página)"
                  />
                  <input
                    value={contentLabel}
                    onChange={(e) => setContentLabel(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-xs outline-none focus:border-[color:var(--gold)]/50"
                    placeholder="Rótulo do botão (ex.: Assistir ao vídeo)"
                  />
                  <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
                    Publicar salva o link junto do texto. Versões antigas mantêm o link
                    que tinham quando foram enviadas.
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
