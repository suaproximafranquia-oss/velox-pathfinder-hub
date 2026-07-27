import { useEffect, useState } from "react";
import { X, ArrowRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WHATSAPP_NUMBER } from "@/lib/journey-data";
import {
  getVisitorIdentity,
  registerLead,
  type VisitorIdentity,
} from "@/lib/leads";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Nome amigável do material acessado (ex.: "Material Institucional"). */
  material: string;
  /** Rótulo do CTA que originou a abertura (para relatórios internos). */
  triggerLabel?: string;
};

/**
 * Diálogo reutilizável "Conversar com o Executivo".
 *
 * - Se o visitante já se identificou anteriormente, reutiliza os dados
 *   salvos e vai direto para o WhatsApp.
 * - Caso contrário, coleta Nome, WhatsApp, E-mail e Cidade, grava o
 *   lead com origem/data/horário/material/executivo responsável e só
 *   depois abre o WhatsApp.
 * - Não altera a lógica de atribuição de executivos: continua usando
 *   `getResponsibleExecutive()` internamente através de `registerLead()`.
 */
export function ExecutiveContactDialog({ open, onClose, material, triggerLabel }: Props) {
  const [form, setForm] = useState<VisitorIdentity>({
    name: "",
    whatsapp: "",
    email: "",
    city: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const existing = getVisitorIdentity();
    if (existing) setForm(existing);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const set =
    (k: keyof VisitorIdentity) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit =
    form.name.trim().length > 1 &&
    form.whatsapp.replace(/\D/g, "").length >= 10 &&
    /.+@.+\..+/.test(form.email) &&
    form.city.trim().length > 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const { executive, personalized } = registerLead({
      identity: form,
      material,
      origin: triggerLabel
        ? `${material} · ${triggerLabel}`
        : material,
    });

    const number =
      (executive?.whatsapp || executive?.phone || "").replace(/\D/g, "") ||
      WHATSAPP_NUMBER;
    const salutation =
      personalized && executive
        ? `Olá ${executive.name.split(" ")[0]}! Sou ${form.name} e acabei de acessar o ${material} da Velox. Gostaria de continuar nossa conversa.`
        : `Olá! Sou ${form.name} e acabei de acessar o ${material} da Velox. Gostaria de conversar com um especialista.`;
    const msg =
      `${salutation}\n\n` +
      `Nome: ${form.name}\n` +
      `WhatsApp: ${form.whatsapp}\n` +
      `E-mail: ${form.email}\n` +
      `Cidade: ${form.city}`;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;

    // Lead já persistido antes de abrir o WhatsApp — se o visitante
    // fechar a conversa, o registro permanece.
    if (typeof window !== "undefined") window.open(url, "_blank");
    setSubmitting(false);
    onClose();
  };

  const field =
    "w-full rounded-xl border border-[color:var(--paper-edge)] bg-white px-4 py-3 text-[15px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--brand-orange)] focus:ring-2 focus:ring-[color:var(--brand-orange)]/25 transition";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-opacity",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exec-dialog-title"
    >
      <div
        className="absolute inset-0 bg-[color:var(--brand-blue-deep)]/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            "relative w-full max-w-lg overflow-hidden rounded-2xl border border-[color:var(--paper-edge)] bg-[color:var(--paper-2)] shadow-2xl transition-all duration-300",
            open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-full p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-black/5 transition"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-8 pt-8 pb-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--brand-orange)]">
              <MessageCircle className="h-3.5 w-3.5" />
              Conversar com o Executivo
            </div>
            <h2
              id="exec-dialog-title"
              className="mt-3 font-[var(--font-editorial)] text-3xl leading-tight text-[color:var(--brand-blue-deep)]"
            >
              Antes de continuarmos.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--muted-foreground)]">
              Nos conte com quem estamos falando. Vamos direcionar sua conversa
              ao especialista responsável e manter o histórico do seu contato.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                  Nome completo
                </label>
                <input required value={form.name} onChange={set("name")} className={field} placeholder="Como podemos te chamar" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                  WhatsApp
                </label>
                <input required value={form.whatsapp} onChange={set("whatsapp")} className={field} placeholder="(00) 00000-0000" inputMode="tel" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                  E-mail
                </label>
                <input required type="email" value={form.email} onChange={set("email")} className={field} placeholder="seu@email.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[color:var(--foreground)] mb-1.5">
                  Cidade
                </label>
                <input required value={form.city} onChange={set("city")} className={field} placeholder="Onde você está" />
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
              Seus dados serão utilizados exclusivamente para esta conversa
              comercial, conforme a LGPD. Ao continuar, você será encaminhado
              para o WhatsApp do executivo responsável.
            </p>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="ed-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Enviando..." : "Continuar no WhatsApp"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}