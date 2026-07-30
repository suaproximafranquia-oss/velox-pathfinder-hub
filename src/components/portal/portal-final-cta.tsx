/**
 * CTA final institucional — reutilizado ao término do Manual do
 * Investidor, do Material Institucional e da Calculadora (Simulador).
 *
 * Cenário 1 — existe um Executivo Responsável (link personalizado):
 * exibe o especialista, seu cargo comercial e um botão que retoma a
 * conversa no WhatsApp dele.
 *
 * Cenário 2 — sem executivo personalizado: convida o investidor a
 * conversar com um especialista, abrindo o Modal Inteligente
 * diretamente na página, sem trocar de rota ou módulo.
 */
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { getResponsibleExecutive, getCommercialTitle } from "@/lib/responsible-executive";
import { WHATSAPP_NUMBER } from "@/lib/journey-data";
import { ExecutiveContactDialog } from "@/components/shared/executive-contact-dialog";

export function PortalFinalCta({
  context,
  whatsappMessage,
}: {
  /** Identifica a origem da conversão (ex.: "Manual do Investidor"). */
  context: string;
  whatsappMessage?: string;
}) {
  const { executive, personalized } = getResponsibleExecutive();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (personalized && executive) {
    const title = getCommercialTitle(executive);
    const firstName = executive.name.split(" ")[0];
    const number = (executive.whatsapp || executive.phone || "").replace(/\D/g, "") || WHATSAPP_NUMBER;
    const msg =
      whatsappMessage ??
      `Olá ${firstName}! Gostaria de voltar a falar sobre a Velox, a partir do ${context}.`;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;

    return (
      <div
        className="mx-auto max-w-2xl rounded-2xl border p-8 text-center md:p-10"
        style={{ borderColor: "var(--paper-edge)", background: "var(--paper-2)" }}
      >
        <span className="portal-eyebrow" style={{ color: "var(--brand-orange)" }}>
          Seu Especialista
        </span>
        <h3 className="portal-serif mt-4 text-2xl md:text-3xl" style={{ color: "var(--brand-blue-deep)" }}>
          {executive.name}
        </h3>
        <p
          className="mt-1 text-xs uppercase tracking-[0.22em]"
          style={{ color: "color-mix(in oklab, var(--brand-blue-deep) 62%, transparent)" }}
        >
          {title}
        </p>
        <p
          className="mx-auto mt-6 max-w-[52ch] text-sm leading-relaxed"
          style={{ color: "color-mix(in oklab, var(--brand-blue-deep) 78%, transparent)" }}
        >
          Sua jornada até aqui já foi acompanhada por {firstName}. Sempre que fizer sentido para
          você, é uma satisfação retomar essa conversa e avançar no seu ritmo.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ed-btn-primary mt-8 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium"
        >
          <MessageCircle className="h-4 w-4" />
          Voltar a falar com meu especialista
        </a>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-2xl rounded-2xl border p-8 text-center md:p-10"
      style={{ borderColor: "var(--paper-edge)", background: "var(--paper-2)" }}
    >
      <span className="portal-eyebrow" style={{ color: "var(--brand-orange)" }}>
        Continue a conversa
      </span>
      <h3 className="portal-serif mt-4 text-2xl md:text-3xl" style={{ color: "var(--brand-blue-deep)" }}>
        Fale com um especialista Velox.
      </h3>
      <p
        className="mx-auto mt-6 max-w-[52ch] text-sm leading-relaxed"
        style={{ color: "color-mix(in oklab, var(--brand-blue-deep) 78%, transparent)" }}
      >
        Uma conversa consultiva de aproximadamente 45 minutos para compreender seu momento,
        esclarecer dúvidas e avaliar se existe aderência entre seus objetivos e o modelo de
        expansão da Velox.
      </p>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="ed-btn-primary mt-8 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium"
      >
        <MessageCircle className="h-4 w-4" />
        Conversar com um Especialista
      </button>

      <ExecutiveContactDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        material={context}
      />
    </div>
  );
}
