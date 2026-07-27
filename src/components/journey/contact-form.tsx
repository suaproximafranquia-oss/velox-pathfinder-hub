import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/lib/journey-data";
import { getResponsibleExecutive } from "@/lib/responsible-executive";
import type { ExecutiveUser } from "@/lib/executive-auth";
import { registerLead } from "@/lib/leads";

export function ContactForm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", city: "", time: "Qualquer horário" });
  const [responsible, setResponsible] = useState<{
    executive: ExecutiveUser | null;
    personalized: boolean;
  }>({ executive: null, personalized: false });

  useEffect(() => {
    setResponsible(getResponsibleExecutive());
  }, []);

  const exec = responsible.executive;
  const whatsappNumber =
    (exec?.whatsapp || exec?.phone || "").replace(/\D/g, "") || WHATSAPP_NUMBER;
  const ctaLabel = responsible.personalized
    ? "Quero voltar a falar com meu especialista"
    : "Quero conversar com um especialista da Velox";

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSubmitting(true);
    const salutation = responsible.personalized && exec
      ? `Olá ${exec.name.split(" ")[0]}! Concluí o Manual do Investidor e gostaria de continuar nossa conversa. Tenho algumas dúvidas.`
      : `Olá! Concluí o Manual do Investidor e gostaria de continuar nossa conversa. Tenho algumas dúvidas.`;
    const msg =
      `${salutation}\n\n` +
      `Nome: ${form.name}\nWhatsApp: ${form.phone}\nCidade: ${form.city || "—"}\n` +
      `Melhor horário: ${form.time}`;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") {
      registerLead({
        identity: {
          name: form.name,
          whatsapp: form.phone,
          email: "",
          city: form.city,
        },
        material: "Manual do Investidor",
        origin: `Manual · Formulário final · ${form.time}`,
      });
      window.open(url, "_blank");
    }
    navigate({ to: "/manual/concluido" });
  };

  const field =
    "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)]/60 focus:outline-none focus:border-[color:var(--gold)]/60 focus:ring-2 focus:ring-[color:var(--gold)]/20 transition";

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--card)]/50 p-6 sm:p-8 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
          Sem compromisso · Uma conversa para você avaliar
        </p>
        <h3 className="font-display text-2xl mb-1">Vamos conversar</h3>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {responsible.personalized && exec
            ? `Você será atendido diretamente por ${exec.name}${exec.title ? ` — ${exec.title}` : ""}.`
            : "Preencha e nossa equipe entra em contato em até um dia útil."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-[color:var(--muted-foreground)] mb-1.5">Seu nome</label>
          <input required value={form.name} onChange={set("name")} className={field} placeholder="Nome completo" />
        </div>
        <div>
          <label className="block text-xs text-[color:var(--muted-foreground)] mb-1.5">WhatsApp</label>
          <input required value={form.phone} onChange={set("phone")} className={field} placeholder="(00) 00000-0000" inputMode="tel" />
        </div>
        <div>
          <label className="block text-xs text-[color:var(--muted-foreground)] mb-1.5">Cidade</label>
          <input value={form.city} onChange={set("city")} className={field} placeholder="Onde você está" />
        </div>
        <div>
          <label className="block text-xs text-[color:var(--muted-foreground)] mb-1.5">Melhor horário</label>
          <select value={form.time} onChange={set("time")} className={field}>
            <option>Qualquer horário</option>
            <option>Manhã</option>
            <option>Tarde</option>
          </select>
        </div>
      </div>

      <p className="text-[11px] text-[color:var(--muted-foreground)]/80 leading-relaxed">
        Ao enviar, você concorda com o uso dos seus dados exclusivamente para
        esta conversa comercial, conforme a LGPD.
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="group inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-8 py-4 text-sm font-medium text-[color:var(--gold-foreground)] hover:shadow-[0_15px_50px_-15px_var(--gold)] transition-all duration-300 disabled:opacity-60"
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}
