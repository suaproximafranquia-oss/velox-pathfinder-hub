/**
 * Nova Conversa — abre o WhatsApp a partir de um número informado.
 *
 * Não cria Lead, não cria cadastro e não adiciona nada ao CRM. Disponível
 * para todos os perfis autorizados a acessar o relacionamento.
 */
import { useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";

/** Normaliza o número informado com ou sem máscara. */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function CrmNewChatButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Nova Conversa"
      aria-label="Nova Conversa"
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-2 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)] active:translate-y-0"
    >
      <MessageSquarePlus className="h-3.5 w-3.5" />
      Nova Conversa
    </button>
  );
}

export function CrmNewChatDialog({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    const normalized = normalizeWhatsappNumber(phone);
    if (!normalized) {
      setError("Informe um número válido com DDD.");
      return;
    }
    window.open(`https://wa.me/${normalized}`, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nova Conversa"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[color:var(--crm-border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Nova Conversa</h2>
            <p className="mt-0.5 text-xs text-[color:var(--crm-muted)]">
              Inicia uma conversa no WhatsApp. Nenhum cadastro é criado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer rounded-lg p-1.5 text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-medium text-[color:var(--crm-muted)]">
              Número de telefone
            </span>
            <input
              autoFocus
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
              placeholder="(17) 99999-9999"
              className="mt-1 w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
            />
          </label>
          {error ? <p className="mt-2 text-[11px] text-rose-500">{error}</p> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[color:var(--crm-border)] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[color:var(--crm-border)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[color:var(--crm-hover)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            className="cursor-pointer rounded-lg bg-[color:var(--crm-accent)] px-3 py-2 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
          >
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  );
}
