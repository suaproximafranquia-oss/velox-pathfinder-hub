/**
 * Nova Conversa — 100% dentro do CRM (canal oficial da Meta).
 *
 * Nunca redireciona para o WhatsApp Web. Duas ações possíveis:
 *   • Conversar  → abre uma conversa operacional efêmera. Nenhum Lead,
 *                  cadastro, Jornada, Timeline, Auditoria ou Backup é
 *                  criado; ao encerrar, nada permanece.
 *   • Criar Lead → segunda etapa com Nome, WhatsApp (obrigatório),
 *                  E-mail e Cidade. O proprietário nasce sendo o
 *                  Executivo autenticado; nunca entra na fila automática.
 */
import { useState } from "react";
import { MessageSquarePlus, X, MessageCircle, UserPlus } from "lucide-react";

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

export type CrmNewChatLead = {
  name: string;
  whatsapp: string;
  email: string;
  city: string;
};

export function CrmNewChatDialog({
  onClose,
  onConverse,
  onCreateLead,
}: {
  onClose: () => void;
  /** Abre a conversa operacional efêmera com o número informado. */
  onConverse: (phone: string) => void;
  /** Cria o Lead com proprietário = Executivo autenticado. */
  onCreateLead: (lead: CrmNewChatLead) => void;
}) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"numero" | "lead">("numero");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  function normalized(): string | null {
    const value = normalizeWhatsappNumber(phone);
    if (!value) {
      setError("Informe um número válido com DDD.");
      return null;
    }
    return value;
  }

  function converse() {
    const value = normalized();
    if (!value) return;
    onConverse(value);
    onClose();
  }

  function goToLead() {
    const value = normalized();
    if (!value) return;
    setStep("lead");
  }

  function createLead() {
    const value = normalized();
    if (!value) return;
    onCreateLead({
      name: name.trim(),
      whatsapp: value,
      email: email.trim(),
      city: city.trim(),
    });
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
            <h2 className="text-sm font-semibold">
              {step === "numero" ? "Nova Conversa" : "Criar Lead"}
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--crm-muted)]">
              {step === "numero"
                ? "A conversa acontece dentro do CRM, pelo canal oficial."
                : "Somente o WhatsApp é obrigatório."}
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
        <div className="space-y-3 px-5 py-4">
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
                if (e.key === "Enter") (step === "numero" ? converse : createLead)();
              }}
              placeholder="(17) 99999-9999"
              className="mt-1 w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
            />
          </label>
          {step === "lead" ? (
            <>
              <label className="block">
                <span className="text-[11px] font-medium text-[color:var(--crm-muted)]">
                  Nome
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[color:var(--crm-muted)]">
                  E-mail (opcional)
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[color:var(--crm-muted)]">
                  Cidade (opcional)
                </span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
                />
              </label>
            </>
          ) : null}
          {error ? <p className="mt-2 text-[11px] text-rose-500">{error}</p> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[color:var(--crm-border)] px-5 py-3.5">
          {step === "numero" ? (
            <>
              <button
                type="button"
                onClick={converse}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-3 py-2 text-xs font-medium transition-colors hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Conversar
              </button>
              <button
                type="button"
                onClick={goToLead}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-3 py-2 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Criar Lead
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={createLead}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-3 py-2 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Confirmar cadastro
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
