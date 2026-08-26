import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Loader2, MessageSquareText, Save } from "lucide-react";
import {
  listarMensagensBiblioteca,
  publicarVersaoMensagem,
} from "@/lib/relationship/library.functions";

type LibraryMessage = {
  id: string;
  stepKey: string;
  code: string | null;
  title: string;
  body: string;
  version: number;
  active: boolean;
  createdAt: string;
  createdByName: string;
  notes: string | null;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setDraft((list.find((m) => m.active) ?? list[0])?.body ?? "");
    setError(null);
  }

  async function publish() {
    if (!step || !draft.trim() || saving) return;
    setSaving(true);
    try {
      await publicarVersaoMensagem({ data: { stepKey: step, body: draft } });
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
      <header className="mb-4 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-[color:var(--gold)]" />
        <div>
          <h2 className="text-sm font-medium">Mensagens do Motor</h2>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Fonte oficial das cadências. Editar publica uma nova versão — o histórico
            enviado nunca é reescrito.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
            {[...steps.keys()].map((key) => {
              const list = steps.get(key) ?? [];
              const current = list.find((m) => m.active);
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
                    <span>{key}</span>
                    <span className="text-[10px]">
                      {current ? `v${current.version}` : "sem texto"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="space-y-3">
            {step ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
                  placeholder="Texto oficial desta etapa. Variáveis: {{nome_investidor}}, {{nome_executivo}}, {{link_portal}}."
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={saving || !draft.trim() || draft === active?.body}
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
