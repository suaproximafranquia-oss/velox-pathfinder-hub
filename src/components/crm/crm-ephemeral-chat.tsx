/**
 * Conversa temporária (Nova Conversa › Conversar).
 *
 * Atendimento inicial pelo canal oficial, sem criar Lead, Jornada,
 * Portal, Histórico ou Backup. A conversa permanece na lista lateral
 * até ser excluída ou transformada em Lead.
 */
import { useState } from "react";
import { Send, Phone, Trash2, UserPlus } from "lucide-react";
import { formatTempPhone, type TempChat, type TempChatMessage } from "@/lib/crm/temp-chats";

export type EphemeralMessage = TempChatMessage;

/** Item da lista lateral — identificado como conversa temporária. */
export function CrmTempChatItem({
  chat,
  active,
  onSelect,
}: {
  chat: TempChat;
  active: boolean;
  onSelect: () => void;
}) {
  const last = chat.messages[chat.messages.length - 1];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        active
          ? "bg-[color:var(--crm-accent-soft)]"
          : "hover:bg-[color:var(--crm-hover)]",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--crm-hover)] text-[color:var(--crm-muted)]"
      >
        <Phone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {formatTempPhone(chat.phone)}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[color:var(--crm-muted)]">
          {last ? last.body : "Conversa iniciada"}
        </span>
      </span>
      <span className="shrink-0 rounded-full border border-[color:var(--crm-border)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--crm-muted)]">
        Temporária
      </span>
    </button>
  );
}

export function CrmEphemeralHeader({
  phone,
  onConvert,
  onDelete,
}: {
  phone: string;
  /** Transformar em Lead — exclusivo das conversas temporárias. */
  onConvert: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3.5">
      <span
        aria-hidden
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[color:var(--crm-hover)] text-[color:var(--crm-muted)]"
      >
        <Phone className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">
          {formatTempPhone(phone)}
        </h2>
        <span className="w-fit rounded-full border border-[color:var(--crm-border)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--crm-muted)]">
          Conversa temporária
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onConvert}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Transformar em Lead
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Excluir conversa temporária"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--crm-muted)] transition-colors hover:border-rose-400 hover:text-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir
        </button>
      </div>
    </div>
  );
}

export function CrmEphemeralThread({ messages }: { messages: EphemeralMessage[] }) {
  if (messages.length === 0) return <div className="h-full" />;
  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div
          key={m.id}
          className={m.direction === "recebida" ? "flex justify-start" : "flex justify-end"}
        >
          <div
            className={[
              "max-w-[75%] px-3.5 py-2 text-[13px] leading-relaxed",
              m.direction === "recebida"
                ? "rounded-2xl rounded-bl-md border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)]"
                : "rounded-2xl rounded-br-md bg-[color:var(--crm-accent)] text-white",
            ].join(" ")}
          >
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <span className="mt-1 block text-right text-[10px] opacity-70">
              {new Date(m.at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CrmEphemeralComposer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  };
  return (
    <div className="shrink-0 border-t border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-5 py-3">
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Escreva a mensagem"
          className="max-h-32 min-h-[38px] w-full resize-none rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={text.trim().length === 0}
          aria-label="Enviar"
          className="inline-flex h-[38px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[color:var(--crm-accent)] px-3.5 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
