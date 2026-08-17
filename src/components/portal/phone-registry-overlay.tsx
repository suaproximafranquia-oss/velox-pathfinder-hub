/**
 * COMANDO 4E §26–§29 — Segunda tela de identificação.
 *
 * Existe SOMENTE para quem chegou sem Executivo identificado (link cru
 * / acesso institucional). Nenhuma mensagem é enviada, nenhum código
 * existe e nenhuma chamada à Meta acontece: o objetivo é apenas manter
 * o cadastro atualizado e preservar a jornada.
 */
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, X, Pencil } from "lucide-react";
import { registerPortalPhone, getPhoneRegistry } from "@/lib/portal-verification";

export function PhoneRegistryOverlay({
  open,
  investorId,
  investorName,
  phone,
  onContinue,
  onClose,
}: {
  open: boolean;
  investorId: string;
  investorName: string;
  phone: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"intro" | "numero">("intro");
  const [currentPhone, setCurrentPhone] = useState(phone);
  const [newPhone, setNewPhone] = useState(phone);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const stored = getPhoneRegistry(investorId);
    setCurrentPhone(stored?.phone || phone);
    setNewPhone(stored?.phone || phone);
    setStep("intro");
    setError("");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, investorId, phone, onClose]);

  if (!open) return null;

  const keepNumber = () => {
    registerPortalPhone({ investorId, investorName, phone: currentPhone });
    onContinue();
  };

  const saveNumber = () => {
    if (newPhone.replace(/\D/g, "").length < 10) {
      setError("Informe um número de WhatsApp válido para continuar.");
      return;
    }
    registerPortalPhone({ investorId, investorName, phone: newPhone });
    setCurrentPhone(newPhone);
    setError("");
    onContinue();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: "color-mix(in oklab, var(--ink) 62%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confira seu WhatsApp"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border p-7 shadow-2xl md:p-9"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border transition hover:scale-105"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--gold)]">
          Segurança da sua jornada
        </p>
        <h2 className="portal-serif mt-3 text-3xl leading-tight">Confira seu WhatsApp</h2>

        {step === "intro" ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              Você iniciou sua Jornada Digital. Informe um número de WhatsApp válido para manter
              seus dados atualizados e facilitar o acesso futuro à sua jornada.
            </p>
            <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-4 py-3">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Número informado
              </span>
              <p className="mt-1 text-lg">{currentPhone || "—"}</p>
            </div>
            <button
              type="button"
              onClick={keepNumber}
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-6 py-4 text-sm font-medium text-[color:var(--gold-foreground)] transition hover:shadow-[0_15px_50px_-15px_var(--gold)]"
            >
              Usar este número e continuar
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setStep("numero")}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-6 py-3 text-sm transition hover:scale-[1.01]"
            >
              <Pencil className="h-4 w-4" /> Alterar número
            </button>
          </>
        ) : (
          <>
            <label className="mt-6 block">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Novo WhatsApp
              </span>
              <input
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)]"
                placeholder="(00) 00000-0000"
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm text-[color:var(--destructive)]">{error}</p>
            ) : null}
            <button
              type="button"
              onClick={saveNumber}
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-6 py-4 text-sm font-medium text-[color:var(--gold-foreground)] transition hover:shadow-[0_15px_50px_-15px_var(--gold)]"
            >
              Salvar número e continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}

        <div className="mt-6 flex gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
          <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
            Este cadastro não representa uma solicitação de contato comercial. O número é
            utilizado para identificar e preservar sua jornada dentro da plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}
