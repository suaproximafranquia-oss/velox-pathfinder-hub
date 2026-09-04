/**
 * FORMULÁRIO ÚNICO DE INTERESSE DAS MARCAS DO GRUPO
 * (Financeira, Solar e Seguros).
 *
 * Existe um único caminho de captação institucional: este formulário,
 * usado nas páginas `/financeira`, `/solar`, `/seguradora`, `/s`, `/seg`
 * e na landing do Grupo. Ele NÃO cria lead operacional da Financeira,
 * não abre Gateway, não inicia cadência e não toca no Portal dos Leads —
 * apenas registra o interessado na carteira institucional.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { registrarInteresseUnidade } from "@/lib/group/unit-leads.functions";

const RANGE_OPTIONS = [
  { value: "10_20", label: "De R$ 10 mil a R$ 20 mil" },
  { value: "20_30", label: "De R$ 20 mil a R$ 30 mil" },
  { value: "acima_30", label: "Acima de R$ 30 mil" },
] as const;

export type UnitInterestFormProps = {
  unit: "financeira" | "solar" | "seguros";
  /** Origem declarada no link (tráfego pago, material impresso, etc.). */
  origin?: string | null;
  campaign?: string | null;
  /** O visitante chegou pelo Portal Institucional do Grupo Velox. */
  fromGroup?: boolean;
};

const UNIT_NAME: Record<UnitInterestFormProps["unit"], string> = {
  financeira: "Velox Soluções Financeiras",
  solar: "Velox Solar",
  seguros: "Velox Seguros",
};

export function UnitInterestForm({ unit, origin, campaign, fromGroup }: UnitInterestFormProps) {
  const submit = useServerFn(registrarInteresseUnidade);
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    city: "",
    investmentRange: "" as "" | (typeof RANGE_OPTIONS)[number]["value"],
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const unitName = UNIT_NAME[unit];

  /**
   * Todos os campos são obrigatórios: a carteira da unidade só recebe
   * cadastro completo. A mesma regra é reaplicada no servidor.
   */
  async function send() {
    if (!form.name.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (form.whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (form.city.trim().length < 2) {
      toast.error("Informe sua cidade.");
      return;
    }
    if (!form.investmentRange) {
      toast.error("Selecione a faixa de investimento.");
      return;
    }
    setSending(true);
    try {
      await submit({
        data: {
          unit,
          name: form.name,
          whatsapp: form.whatsapp,
          email: form.email.trim(),
          city: form.city.trim(),
          investmentRange: form.investmentRange,
          origin: origin ?? null,
          campaign: campaign ?? null,
          fromGroup: Boolean(fromGroup),
        },
      });
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar agora.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[#c9a961]/30 bg-[#c9a961]/5 p-6">
        <h2 className="text-lg font-semibold text-white">Interesse registrado</h2>
        <p className="mt-2 text-sm text-white/70">
          Recebemos seus dados. Um responsável da {unitName} entrará em contato pelo WhatsApp
          informado.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold text-white">Quero conhecer a {unitName}</h2>
      <p className="mt-1 text-sm text-white/60">
        Todos os campos são obrigatórios. O contato é feito por uma pessoa — não existe disparo automático.
      </p>

      <div className="mt-5 space-y-3">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Seu nome completo *"
          required
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
        />
        <input
          value={form.whatsapp}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          inputMode="tel"
          placeholder="WhatsApp com DDD *"
          required
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
        />
        <input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          inputMode="email"
          placeholder="E-mail *"
          required
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
        />
        <input
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="Cidade *"
          required
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
        />

        <div className="space-y-2 pt-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">
            Quanto pretende investir *
          </p>
          {RANGE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                form.investmentRange === option.value
                  ? "border-[#c9a961] bg-[#c9a961]/10 text-white"
                  : "border-white/10 bg-white/5 text-white/70"
              }`}
            >
              <input
                type="radio"
                name="range"
                className="accent-[#c9a961]"
                checked={form.investmentRange === option.value}
                onChange={() => setForm({ ...form, investmentRange: option.value })}
              />
              {option.label}
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={sending}
          onClick={() => void send()}
          className="mt-2 w-full rounded-full bg-[#c9a961] px-5 py-3 text-sm font-medium text-[#0b1b33] disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar interesse"}
        </button>
        <p className="text-[11px] text-white/40">
          Seus dados são usados apenas para contato sobre a {unitName}.
        </p>
      </div>
    </div>
  );
}
