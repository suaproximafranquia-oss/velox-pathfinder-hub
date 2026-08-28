import { useEffect, useState } from "react";
import { X, ArrowRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WHATSAPP_NUMBER } from "@/lib/journey-data";
import { whatsappLinkWithText } from "@/lib/whatsapp-number";
import { contatoDoExecutivo } from "@/lib/relationship/e20.functions";
import { registerLead, updateLead } from "@/lib/leads";
import { getPortalSession } from "@/lib/portal-session";
import { emitEvent } from "@/lib/events/bus";
import { addComment } from "@/lib/investor-comments";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Nome amigável do material acessado (ex.: "Material Institucional"). */
  material: string;
};

const INVESTMENT_RANGES = [
  "Até R$ 300 mil",
  "Entre R$ 300 mil e R$ 800 mil",
  "Acima de R$ 800 mil",
] as const;

/**
 * Modal Inteligente — usado apenas ao final da jornada, quando não há
 * um Executivo Responsável já vinculado ao visitante.
 *
 * Nome e e-mail são obtidos da sessão do Portal e não são solicitados
 * novamente. É pedido apenas o essencial para qualificar o lead:
 * WhatsApp, Pretensão de Investimento (faixas de finalidade consultiva),
 * dois horários preferenciais de contato e uma mensagem opcional.
 *
 * Não cria reunião automaticamente: gera um Lead qualificado através
 * da infraestrutura existente (leads, eventos e comentários internos).
 */
export function ExecutiveContactDialog({ open, onClose, material }: Props) {
  const session = getPortalSession();
  const [whatsapp, setWhatsapp] = useState("");
  const [investmentRange, setInvestmentRange] = useState<string>(INVESTMENT_RANGES[0]);
  const [time1, setTime1] = useState("");
  const [time2, setTime2] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setWhatsapp("");
    setInvestmentRange(INVESTMENT_RANGES[0]);
    setTime1("");
    setTime2("");
    setMessage("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const name = session?.name?.trim() || "Visitante Velox";
  const email = session?.email?.trim() || "";

  const canSubmit = whatsapp.replace(/\D/g, "").length >= 10 && time1.trim().length > 1 && time2.trim().length > 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const identity = { name, email, whatsapp, city: "" };
    const { lead } = session?.investorId
      ? { lead: updateLead(session.investorId, { whatsapp }) }
      : registerLead({ identity, material, origin: material });

    const investorId = lead?.id ?? session?.investorId ?? null;

    if (investorId) {
      emitEvent({
        type: "lead.status.changed",
        investorId,
        payload: {
          stage: "qualificado",
          material,
          investmentRange,
          preferredTimes: [time1, time2],
          message: message.trim() || undefined,
        },
        // Duplo clique / reenvio do formulário não vira dois acontecimentos.
        dedupeKey: `lead.status.changed:${investorId}:qualificado`,
      });


      addComment({
        investorId,
        authorId: "ai_corporate",
        authorName: "IA Corporativa",
        body:
          `Lead qualificado a partir de ${material}. ` +
          `Pretensão de Investimento: ${investmentRange}. ` +
          `Horários preferenciais: ${time1} e ${time2}.` +
          (message.trim() ? ` Mensagem: "${message.trim()}"` : ""),
      });
    }

    const msg =
      `Olá! Sou ${name} e gostaria de conversar com um especialista da Velox.\n\n` +
      `WhatsApp: ${whatsapp}\n` +
      `Pretensão de Investimento: ${investmentRange}\n` +
      `Horários preferenciais: ${time1} / ${time2}` +
      (message.trim() ? `\nMensagem: ${message.trim()}` : "");
    /**
     * DESTINO REAL (COMANDO 2A §6): se o lead já tem executivo
     * responsável com WhatsApp cadastrado, a conversa vai para ELE.
     * Só quando não existe responsável a conversa segue para o canal
     * institucional oficial. O link é montado por uma única função.
     */
    let destination = WHATSAPP_NUMBER;
    if (investorId) {
      try {
        const contact = await contatoDoExecutivo({ data: { leadId: investorId } });
        if (contact.available && contact.whatsapp) destination = contact.whatsapp;
      } catch {
        // Indisponibilidade do servidor não bloqueia o contato institucional.
      }
    }
    const url = whatsappLinkWithText(destination, msg);

    setSubmitting(false);
    setDone(true);
    if (url && typeof window !== "undefined") window.open(url, "_blank");
  };

  const field =
    "w-full rounded-xl border border-[color:var(--paper-edge)] bg-white px-4 py-3 text-[15px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--brand-orange)] focus:ring-2 focus:ring-[color:var(--brand-orange)]/25 transition";
  const label = "block text-xs font-medium text-[color:var(--foreground)] mb-1.5";

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
            "relative w-full max-w-lg overflow-hidden rounded-2xl border border-[color:var(--paper-edge)] bg-[color:var(--paper-2)] shadow-2xl transition-all duration-300 max-h-[90vh] overflow-y-auto",
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

          {done ? (
            <div className="px-8 py-14 text-center">
              <div
                className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background: "color-mix(in oklab, var(--brand-orange) 14%, transparent)",
                  color: "var(--brand-orange)",
                }}
              >
                <MessageCircle className="h-6 w-6" />
              </div>
              <h2 className="font-[var(--font-editorial)] text-2xl text-[color:var(--brand-blue-deep)]">
                Recebemos suas informações.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                Um especialista Velox entrará em contato nos horários indicados. Você também foi
                direcionado ao WhatsApp para adiantar essa conversa, se preferir.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="ed-btn-primary mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="px-8 pt-8 pb-2">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--brand-orange)]">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Conversar com um Especialista
                </div>
                <h2
                  id="exec-dialog-title"
                  className="mt-3 font-[var(--font-editorial)] text-3xl leading-tight text-[color:var(--brand-blue-deep)]"
                >
                  Vamos entender seu momento.
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--muted-foreground)]">
                  Uma conversa consultiva de aproximadamente 45 minutos para compreender seu
                  momento, esclarecer dúvidas e avaliar se existe aderência entre seus objetivos
                  e o modelo de expansão da Velox.
                </p>
                {(name || email) && (
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                    {name}
                    {email ? ` · ${email}` : ""}
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="px-8 pb-8 pt-6 space-y-4">
                <div>
                  <label className={label}>WhatsApp</label>
                  <input
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className={field}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                  />
                </div>

                <div>
                  <label className={label}>Pretensão de Investimento</label>
                  <select
                    value={investmentRange}
                    onChange={(e) => setInvestmentRange(e.target.value)}
                    className={field}
                  >
                    {INVESTMENT_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
                    Referência apenas consultiva, para direcionar melhor a conversa.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>1º horário preferencial</label>
                    <input
                      required
                      value={time1}
                      onChange={(e) => setTime1(e.target.value)}
                      className={field}
                      placeholder="Ex.: Terça, à tarde"
                    />
                  </div>
                  <div>
                    <label className={label}>2º horário preferencial</label>
                    <input
                      required
                      value={time2}
                      onChange={(e) => setTime2(e.target.value)}
                      className={field}
                      placeholder="Ex.: Quinta, pela manhã"
                    />
                  </div>
                </div>

                <div>
                  <label className={label}>Mensagem (opcional)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className={field}
                    placeholder="Conte um pouco do que gostaria de conversar"
                  />
                </div>

                <p className="text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
                  Seus dados serão utilizados exclusivamente para esta conversa consultiva,
                  conforme a LGPD.
                </p>

                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="ed-btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Enviando..." : "Solicitar conversa"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
