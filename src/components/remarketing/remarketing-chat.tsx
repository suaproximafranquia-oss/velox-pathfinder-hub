/**
 * Caixa de Conversas do Remarketing — mesma linguagem visual do CRM.
 *
 * Reutiliza integralmente os componentes visuais do CRM de Relacionamento
 * (painéis, lista, thread, composer e ficha). A arquitetura e os dados
 * permanecem 100% isolados: nada aqui cria lead, card, etapa ou cadência.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessagesSquare, Megaphone, IdCard, History } from "lucide-react";
import {
  CrmListPane,
  CrmMainPane,
  CrmDetailsPane,
  useDetailsPane,
} from "@/components/crm/crm-workspace";
import {
  CrmAvatar,
  CrmThread,
  CrmComposer,
  CrmRecordSection,
  CrmRecordRow,
  CrmCopyRow,
} from "@/components/crm/crm-conversation";
import { crmCssVars, resolveCrmBranding } from "@/lib/crm/theme";
import { findCrmTheme, getUserCrmTheme } from "@/lib/crm/themes";
import { getSession } from "@/lib/executive-auth";
import type { CrmMessage } from "@/lib/crm/messages";
import { formatPhone } from "@/lib/remarketing/phone";
import { threadInitials } from "@/lib/crm/thread-view";
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

const STATUS_DOT: Record<RemarketingConversationStatus, string> = {
  aguardando: "bg-[color:var(--crm-muted)]/50",
  respondeu: "bg-blue-500",
  em_atendimento: "bg-emerald-500",
  encerrada: "bg-[color:var(--crm-muted)]/40",
};

function fullLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Rótulo curto do item da lista (mesmo padrão do CRM). */
function shortLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function displayName(c: RemarketingConversation): string {
  return c.contactName?.trim() || formatPhone(c.phone);
}

/** Traduz a mensagem do Remarketing para o modelo visual da conversa. */
function toCrmMessage(m: RemarketingMessage): CrmMessage {
  const suffix = [
    m.kind === "template" ? `Template: ${m.templateName ?? "oficial"}` : null,
    m.simulated ? "Simulado" : null,
    !m.delivered ? `Não entregue${m.error ? `: ${m.error}` : ""}` : null,
  ].filter(Boolean);
  return {
    id: m.id,
    investorId: m.conversationId,
    direction: m.direction === "saida" ? "enviada" : "recebida",
    body: suffix.length ? `${m.body}\n\n— ${suffix.join(" · ")}` : m.body,
    at: m.occurredAt,
    authorId: m.direction === "saida" ? "REMARKETING" : "CONTATO",
    authorName: m.authorName ?? undefined,
  };
}

export function RemarketingChat({ operatorName }: { operatorName: string }) {
  const [conversations, setConversations] = useState<RemarketingConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RemarketingMessage[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useDetailsPane(true);

  // Mesmo tema visual escolhido pelo usuário no CRM de Relacionamento.
  const theme = useMemo(() => findCrmTheme(getUserCrmTheme(getSession()?.userId ?? null)), []);
  const themeVars = useMemo(
    () =>
      ({
        ...crmCssVars(resolveCrmBranding({ colors: theme.colors })),
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }) as React.CSSProperties,
    [theme],
  );

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.contactName ?? "", c.phone, c.campaignName ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const threadMessages = useMemo(() => messages.map(toCrmMessage), [messages]);
  const lastTemplate = useMemo(
    () => [...messages].reverse().find((m) => m.kind === "template")?.templateName ?? null,
    [messages],
  );

  const send = useCallback(
    async (text: string) => {
      if (!activeId || !text.trim()) return;
      setError(null);
      try {
        const message = await sendRemarketingReply({
          data: { conversationId: activeId, body: text.trim(), authorName: operatorName },
        });
        setMessages((prev) => [...prev, message]);
        await refreshList();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Mensagem não enviada.");
      }
    },
    [activeId, operatorName, refreshList],
  );

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
    <div
      className="crm-root overflow-hidden rounded-2xl border border-[color:var(--crm-border)] text-[color:var(--crm-foreground)]"
      data-crm-theme={theme.id}
      style={themeVars}
    >
      <div className="flex h-[74vh] min-h-[520px] w-full bg-[color:var(--crm-background)]">
        {/* 1 — Lista de conversas */}
        <CrmListPane
          title="Conversas"
          subtitle="Remarketing — ambiente isolado"
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Buscar número ou campanha"
          count={filtered.length}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs leading-relaxed text-[color:var(--crm-muted)]">
              Nenhuma conversa registrada. Elas aparecem assim que uma campanha dispara.
            </p>
          ) : null}
          {filtered.map((c) => {
            const name = displayName(c);
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => void openConversation(c.id)}
                aria-current={isActive ? "true" : undefined}
                className={[
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150",
                  isActive
                    ? "bg-[color:var(--crm-accent-soft)]"
                    : "hover:bg-[color:var(--crm-hover)]",
                ].join(" ")}
              >
                <CrmAvatar name={name} initials={threadInitials(name)} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
                      {name}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--crm-muted)]">
                      {shortLabel(c.lastMessageAt)}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[c.status]}`}
                      aria-hidden
                    />
                    <span
                      className={[
                        "min-w-0 flex-1 truncate text-[11px]",
                        c.unreadCount > 0
                          ? "font-semibold text-blue-600"
                          : "text-[color:var(--crm-muted)]",
                      ].join(" ")}
                    >
                      {CONVERSATION_STATUS_LABEL[c.status]}
                      {c.lastMessagePreview ? ` · ${c.lastMessagePreview}` : ""}
                    </span>
                    {c.unreadCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </CrmListPane>

        {/* 2 — Conversa */}
        <CrmMainPane
          title={active ? displayName(active) : "Conversas"}
          header={
            active ? (
              <div className="crm-enter flex min-w-0 flex-1 items-center gap-3.5">
                <CrmAvatar
                  name={displayName(active)}
                  initials={threadInitials(displayName(active))}
                  size={42}
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">
                    {displayName(active)}
                  </h2>
                  <span className="truncate text-[11px] text-[color:var(--crm-muted)]">
                    {formatPhone(active.phone)} · {active.campaignName || "sem campanha"}
                  </span>
                </div>
                <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--crm-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--crm-accent)]">
                  <Megaphone className="h-3.5 w-3.5" />
                  Remarketing
                </span>
              </div>
            ) : undefined
          }
          footer={
            active ? (
              <CrmComposer
                onSend={(text) => void send(text)}
                investorName={displayName(active)}
                executiveName={operatorName}
                hint={error ?? undefined}
              />
            ) : undefined
          }
        >
          {!active ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium">Selecione uma conversa</p>
              <p className="max-w-sm text-xs leading-relaxed text-[color:var(--crm-muted)]">
                O histórico completo dos disparos e das respostas do Remarketing aparece aqui.
              </p>
            </div>
          ) : (
            <>
              {error ? (
                <p className="mx-auto mb-3 w-full max-w-2xl rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                  {error}
                </p>
              ) : null}
              <CrmThread
                item={{ id: active.id, name: displayName(active) }}
                messages={threadMessages}
                self={{ name: operatorName }}
                peer={{ name: displayName(active) }}
              />
            </>
          )}
        </CrmMainPane>

        {/* 3 — Ficha operacional do Remarketing */}
        <CrmDetailsPane
          open={detailsOpen}
          title="Ficha da conversa"
          onToggle={() => setDetailsOpen((v) => !v)}
        >
          {!active ? (
            <p className="px-1 text-xs leading-relaxed text-[color:var(--crm-muted)]">
              Nenhuma conversa aberta.
            </p>
          ) : (
            <div className="space-y-3">
              <CrmRecordSection title="Contato" icon={IdCard}>
                <CrmRecordRow label="Nome" value={active.contactName || "—"} />
                <CrmCopyRow label="WhatsApp" value={formatPhone(active.phone)} />
                <CrmRecordRow
                  label="Situação"
                  value={CONVERSATION_STATUS_LABEL[active.status]}
                />
                <label className="block pt-1 text-xs text-[color:var(--crm-muted)]">
                  Alterar situação
                  <select
                    value={active.status}
                    onChange={(e) =>
                      void changeStatus(e.target.value as RemarketingConversationStatus)
                    }
                    className="mt-1 w-full rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-xs text-[color:var(--crm-foreground)] outline-none focus:border-[color:var(--crm-accent)]"
                  >
                    {(
                      Object.keys(CONVERSATION_STATUS_LABEL) as RemarketingConversationStatus[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {CONVERSATION_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </CrmRecordSection>

              <CrmRecordSection title="Origem" icon={Megaphone}>
                <CrmRecordRow label="Campanha" value={active.campaignName || "—"} />
                <CrmRecordRow label="Template" value={lastTemplate || "—"} />
                <CrmRecordRow label="Primeiro registro" value={fullLabel(active.createdAt)} />
              </CrmRecordSection>

              <CrmRecordSection title="Atividade" icon={History}>
                <CrmRecordRow label="Última mensagem" value={fullLabel(active.lastMessageAt)} />
                <CrmRecordRow
                  label="Direção"
                  value={active.lastDirection === "saida" ? "Enviada" : "Recebida"}
                />
                <CrmRecordRow label="Mensagens" value={String(messages.length)} />
                <p className="rounded-xl bg-[color:var(--crm-hover)] px-3 py-2 text-[11px] leading-relaxed text-[color:var(--crm-muted)]">
                  Ambiente isolado: nada desta conversa cria lead, card, etapa ou cadência no CRM
                  de Relacionamento.
                </p>
              </CrmRecordSection>
            </div>
          )}
        </CrmDetailsPane>
      </div>
    </div>
  );
}
