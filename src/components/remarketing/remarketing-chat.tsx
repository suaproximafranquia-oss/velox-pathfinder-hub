/**
 * Caixa de Conversas do Remarketing — três colunas.
 *
 * Painel operacional isolado: lista de conversas, histórico completo e
 * resposta manual. Nenhuma informação aqui vira lead, card, etapa ou
 * cadência no CRM de Relacionamento.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare, Search, Send } from "lucide-react";
import { formatPhone } from "@/lib/remarketing/phone";
import {
  CONVERSATION_STATUS_LABEL,
  type RemarketingConversation,
  type RemarketingConversationStatus,
  type RemarketingMessage,
} from "@/lib/remarketing/types";
import {
  listRemarketingConversations,
  listRemarketingMessages,
  sendRemarketingReply,
  updateRemarketingConversation,
} from "@/lib/remarketing.functions";

const panel =
  "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40";
const field =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--gold)]/50";

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function RemarketingChat({ operatorName }: { operatorName: string }) {
  const [conversations, setConversations] = useState<RemarketingConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RemarketingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshList = useCallback(async () => {
    setConversations(await listRemarketingConversations());
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setMessages(await listRemarketingMessages({ data: { conversationId: id } }));
  }, []);

  useEffect(() => {
    void refreshList().catch((e) =>
      setError(e instanceof Error ? e.message : "Falha ao carregar conversas."),
    );
  }, [refreshList]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshList().catch(() => undefined);
      if (activeId)
        void listRemarketingMessages({ data: { conversationId: activeId } })
          .then(setMessages)
          .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [refreshList, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.contactName ?? "", c.phone, c.campaignName ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const send = useCallback(async () => {
    if (!activeId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const message = await sendRemarketingReply({
        data: { conversationId: activeId, body: draft.trim(), authorName: operatorName },
      });
      setMessages((prev) => [...prev, message]);
      setDraft("");
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mensagem não enviada.");
    } finally {
      setBusy(false);
    }
  }, [activeId, draft, operatorName, refreshList]);

  const changeStatus = useCallback(
    async (status: RemarketingConversationStatus) => {
      if (!activeId) return;
      setConversations(
        await updateRemarketingConversation({ data: { conversationId: activeId, status } }),
      );
    },
    [activeId],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_260px]">
      {/* Coluna 1 — conversas */}
      <aside className={panel + " flex max-h-[70vh] flex-col overflow-hidden"}>
        <div className="border-b border-[color:var(--border)] p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar número ou campanha"
              className={field + " pl-8 text-xs"}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 && (
            <p className="p-4 text-xs text-[color:var(--muted-foreground)]">
              Nenhuma conversa registrada. Elas aparecem assim que uma campanha dispara.
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void openConversation(c.id)}
              className={`w-full border-b border-[color:var(--border)] px-3 py-2.5 text-left transition hover:bg-[color:var(--background)]/40 ${
                c.id === activeId ? "bg-[color:var(--background)]/60" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">
                  {c.contactName || formatPhone(c.phone)}
                </span>
                {c.unreadCount > 0 && (
                  <span className="rounded-full bg-[color:var(--gold)] px-1.5 text-[10px] font-medium text-[color:var(--navy-deep,#0b1220)]">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-[color:var(--muted-foreground)]">
                {CONVERSATION_STATUS_LABEL[c.status]} · {c.lastMessagePreview || "—"}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Coluna 2 — histórico */}
      <section className={panel + " flex max-h-[70vh] flex-col overflow-hidden"}>
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-xs text-[color:var(--muted-foreground)]">
            <MessageSquare className="h-6 w-6" strokeWidth={1.5} />
            Selecione uma conversa para ver o histórico completo.
          </div>
        ) : (
          <>
            <header className="border-b border-[color:var(--border)] px-4 py-3">
              <p className="text-sm">{active.contactName || formatPhone(active.phone)}</p>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                {formatPhone(active.phone)} · Campanha: {active.campaignName || "—"}
              </p>
            </header>

            <div className="flex-1 space-y-2 overflow-auto p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    m.direction === "saida"
                      ? "ml-auto border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10"
                      : "border border-[color:var(--border)] bg-[color:var(--background)]/50"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-[color:var(--foreground)]">{m.body}</p>
                  <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
                    {timeLabel(m.occurredAt)}
                    {m.kind === "template" ? " · template" : ""}
                    {m.authorName ? ` · ${m.authorName}` : ""}
                    {m.simulated ? " · simulado" : ""}
                    {!m.delivered ? ` · não entregue${m.error ? `: ${m.error}` : ""}` : ""}
                  </p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-[color:var(--border)] p-3">
              {error && (
                <p className="mb-2 text-[11px] text-[color:var(--muted-foreground)]">{error}</p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Responder manualmente…"
                  className={field + " text-xs"}
                />
                <button
                  type="button"
                  disabled={busy || !draft.trim()}
                  onClick={() => void send()}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-4 py-2 text-xs font-medium text-[color:var(--navy-deep,#0b1220)] transition hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Enviar
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Coluna 3 — ficha da conversa */}
      <aside className={panel + " max-h-[70vh] overflow-auto p-4"}>
        <h3 className="font-display text-sm">Ficha da conversa</h3>
        {!active ? (
          <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
            Nenhuma conversa aberta.
          </p>
        ) : (
          <div className="mt-3 space-y-3 text-xs text-[color:var(--muted-foreground)]">
            <p>
              Número:{" "}
              <span className="text-[color:var(--foreground)]">{formatPhone(active.phone)}</span>
            </p>
            <p>
              Origem:{" "}
              <span className="text-[color:var(--foreground)]">{active.campaignName || "—"}</span>
            </p>
            <p>
              Última atividade:{" "}
              <span className="text-[color:var(--foreground)]">
                {timeLabel(active.lastMessageAt)}
              </span>
            </p>
            <label className="block">
              Situação
              <select
                value={active.status}
                onChange={(e) =>
                  void changeStatus(e.target.value as RemarketingConversationStatus)
                }
                className={field + " mt-1 text-xs"}
                style={{ colorScheme: "dark" }}
              >
                {(
                  Object.keys(CONVERSATION_STATUS_LABEL) as RemarketingConversationStatus[]
                ).map((s) => (
                  <option
                    key={s}
                    value={s}
                    style={{ backgroundColor: "#0b1220", color: "#e5e7eb" }}
                  >
                    {CONVERSATION_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-lg border border-[color:var(--border)] p-2 text-[11px]">
              Ambiente isolado: nada desta conversa cria lead, card ou cadência no CRM de
              Relacionamento.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
