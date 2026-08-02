/**
 * DEF 3.0.2 §3/§4 — Confirmação do WhatsApp SEM código, OTP ou PIN.
 *
 * O CRM dispara o Template Oficial pela Cloud API da Meta. O visitante
 * responde CONFIRMAR ou NÃO CONFIRMAR dentro do próprio WhatsApp: o
 * Portal apenas aguarda o retorno oficial do Webhook. Nenhum botão de
 * confirmação existe aqui e nenhum WhatsApp Web é aberto.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck, X, RefreshCw, Pencil, Loader2 } from "lucide-react";
import {
  confirmWhatsapp,
  declineWhatsapp,
  getVerification,
  requestWhatsappConfirmation,
} from "@/lib/portal-verification";
import { getWhatsappReply } from "@/lib/crm/whatsapp-inbox";
import { readWhatsappValidation } from "@/lib/whatsapp.functions";

export function WhatsappConfirmOverlay({
  open,
  investorId,
  investorName,
  phone,
  onConfirmed,
  onClose,
}: {
  open: boolean;
  investorId: string;
  investorName: string;
  phone: string;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"intro" | "aguardando" | "numero">("intro");
  const [currentPhone, setCurrentPhone] = useState(phone);
  const [newPhone, setNewPhone] = useState(phone);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const settled = useRef(false);

  useEffect(() => {
    if (!open) return;
    const existing = getVerification(investorId);
    setCurrentPhone(existing?.phone || phone);
    setNewPhone(existing?.phone || phone);
    setStep(existing?.sentAt ? "aguardando" : "intro");
    setError("");
    setInfo("");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, investorId, phone, onClose]);

  /**
   * Aguardo ativo pela resposta oficial: o CRM é informado pelo Webhook
   * da Meta e o Portal libera os módulos automaticamente.
   */
  useEffect(() => {
    if (!open || step !== "aguardando") return;
    settled.current = false;
    let alive = true;

    const handle = (status: "confirmado" | "recusado") => {
      if (!alive || settled.current) return;
      settled.current = true;
      if (status === "confirmado") {
        const result = confirmWhatsapp({ investorId, investorName });
        if (!result.ok) {
          setError("Não localizamos o envio. Solicite o reenvio da mensagem oficial.");
          settled.current = false;
          return;
        }
        setError("");
        onConfirmed();
        return;
      }
      declineWhatsapp({ investorId, investorName });
      setInfo(
        "Resposta 'NÃO CONFIRMAR' registrada. Os módulos seguem bloqueados; o Manual do Investidor continua liberado.",
      );
      settled.current = false;
    };

    const check = async () => {
      const local = getWhatsappReply(currentPhone);
      if (local && local.status !== "aguardando") {
        handle(local.status);
        return;
      }
      try {
        const remote = await readWhatsappValidation({ data: { phone: currentPhone } });
        if (remote && (remote.status === "confirmado" || remote.status === "recusado")) {
          handle(remote.status);
        }
      } catch {
        /* canal indisponível — segue aguardando */
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 4000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open, step, currentPhone, investorId, investorName, onConfirmed]);

  if (!open) return null;

  const send = (target: string) => {
    const digits = target.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Informe um WhatsApp válido para receber a confirmação.");
      return;
    }
    requestWhatsappConfirmation({
      investorId,
      investorName,
      phone: digits,
    });
    setCurrentPhone(digits);
    setError("");
    setInfo(
      "O CRM enviou o Template Oficial da Velox. Responda no WhatsApp usando os botões CONFIRMAR ou NÃO CONFIRMAR.",
    );
    setStep("aguardando");
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Fechar confirmação"
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
        aria-label="Confirme seu WhatsApp"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
          boxShadow: "0 60px 120px -30px color-mix(in oklab, var(--ink) 70%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition hover:scale-105"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-7 md:p-9">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--gold)]">
            Segurança da sua jornada
          </p>
          <h2 className="portal-serif mt-3 text-3xl leading-tight">Confirme seu WhatsApp</h2>
          <p className="mt-4 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Você iniciou sua Jornada Digital. Para proteger sua experiência e restaurar
            automaticamente seu progresso em futuros acessos, confirme que este WhatsApp realmente
            pertence a você.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Esta confirmação NÃO representa uma solicitação de contato comercial. Ela serve apenas
            para validar sua identidade dentro da plataforma.
          </p>

          {step === "numero" ? (
            <div className="mt-7 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                  Novo WhatsApp
                </span>
                <input
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  inputMode="tel"
                  autoFocus
                  className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)]"
                  placeholder="(00) 00000-0000"
                />
              </label>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Seu cadastro existente será atualizado. Nenhum novo registro será criado.
              </p>
            </div>
          ) : null}

          {step === "aguardando" ? (
            <div className="mt-7 space-y-4">
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Enviamos a mensagem oficial da Velox para o WhatsApp{" "}
                <strong>{currentPhone}</strong>. Não há código a digitar: basta
                tocar em um dos botões da própria mensagem.
              </p>

              {/* Reprodução fiel da mensagem oficial recebida no WhatsApp. */}
              <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/70">
                <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
                  <MessageCircle className="h-4 w-4 text-[color:var(--gold)]" />
                  <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                    Velox Soluções Financeiras
                  </span>
                </div>
                <p className="px-4 py-4 text-sm leading-relaxed">
                  Olá, {investorName}. Você está iniciando sua jornada no Portal
                  do Investidor Velox. Confirma que este WhatsApp é seu?
                </p>
                <div className="grid gap-2 border-t border-[color:var(--border)] p-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={confirm}
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[color:var(--gold)] px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--gold-foreground)] transition hover:scale-[1.01]"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={decline}
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[color:var(--border)] px-4 py-3 text-xs uppercase tracking-[0.16em] transition hover:scale-[1.01] hover:border-[color:var(--gold)]"
                  >
                    Não confirmar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-[color:var(--destructive)]">{error}</p> : null}
          {!error && info ? (
            <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">{info}</p>
          ) : null}

          <div className="mt-7 space-y-3">
            {step === "intro" ? (
              <button
                type="button"
                onClick={() => send(currentPhone)}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-6 py-4 text-sm font-medium text-[color:var(--gold-foreground)] transition hover:scale-[1.01] hover:shadow-[0_15px_50px_-15px_var(--gold)]"
              >
                Confirmar WhatsApp
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}

            {step === "numero" ? (
              <button
                type="button"
                onClick={() => send(newPhone)}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-6 py-4 text-sm font-medium text-[color:var(--gold-foreground)] transition hover:scale-[1.01] hover:shadow-[0_15px_50px_-15px_var(--gold)]"
              >
                Salvar número e enviar
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}

            {step !== "intro" ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => send(currentPhone)}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-5 py-3 text-xs uppercase tracking-[0.18em] transition hover:scale-[1.01] hover:border-[color:var(--gold)]"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Enviar novamente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(step === "numero" ? "aguardando" : "numero");
                    setError("");
                    setInfo("");
                  }}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-5 py-3 text-xs uppercase tracking-[0.18em] transition hover:scale-[1.01] hover:border-[color:var(--gold)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {step === "numero" ? "Cancelar alteração" : "Alterar número"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
            <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
              O Manual do Investidor permanece liberado. Os demais módulos são desbloqueados assim
              que sua identidade for confirmada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}