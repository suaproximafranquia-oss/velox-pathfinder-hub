/**
 * Conversa operacional efêmera (Nova Conversa › Conversar).
 *
 * Acontece integralmente dentro do CRM, pelo canal oficial da Meta.
 * Nada é persistido: sem Lead, sem cadastro, sem Jornada, sem Timeline,
 * sem Auditoria e sem Backup. Ao encerrar, nenhuma informação permanece.
 */
import { useState } from "react";
import { Send, X, Phone } from "lucide-react";

export type EphemeralMessage = { id: string; body: string; at: string };

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

export function CrmEphemeralHeader({
  phone,
  onClose,
}: {
  phone: string;
  onClose: () => void;
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
          {formatPhone(phone)}
        </h2>
        <span className="text-[11px] text-[color:var(--crm-muted)]">
          Conversa avulsa — nenhum cadastro é criado
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--crm-muted)] transition-colors hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)]"
      >
        <X className="h-3.5 w-3.5" />
        Encerrar conversa
      </button>
    </div>
  );
}

export function CrmEphemeralThread({ messages }: { messages: EphemeralMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-sm text-center text-xs leading-relaxed text-[color:var(--crm-muted)]">
          Conversa operacional avulsa. As mensagens saem pelo canal oficial e não
          geram cadastro, histórico permanente nem registro no Workspace.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div key={m.id} className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[color:var(--crm-accent)] px-3.5 py-2 text-[13px] leading-relaxed text-white">
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
