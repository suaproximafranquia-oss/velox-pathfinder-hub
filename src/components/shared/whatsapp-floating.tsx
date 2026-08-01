import { useEffect, useMemo, useState } from "react";
import { MessageCircle, X, ArrowRight } from "lucide-react";
import { getResponsibleExecutive } from "@/lib/responsible-executive";
import { getDefaultExecutive, type ExecutiveUser } from "@/lib/executive-auth";
import { getPortalSession } from "@/lib/portal-session";
import { registerLead, updateLead, loadLeads, type VisitorIdentity } from "@/lib/leads";
import { trackJourney } from "@/lib/journey/engine";
import { getActiveOverlay, subscribeOverlay } from "@/lib/portal-overlay";
import { startRelationship } from "@/lib/crm/commercial";
import { recordServiceRequestAlert } from "@/lib/workspace-alerts";

/**
 * DEF 2.4.11 — Solicitação de Atendimento.
 *
 * O pedido do investidor cria imediatamente o Relacionamento Comercial:
 * Lead, Card no Workspace, conversa liberada no CRM e alerta ao Executivo
 * responsável. Todo o histórico anterior da Jornada Digital é preservado.
 */
function requestService(input: {
  investorId: string | null;
  investorName: string;
  executiveId: string | null;
}) {
  if (!input.investorId) return;
  startRelationship({
    investorId: input.investorId,
    investorName: input.investorName,
    actorId: "sistema",
    actorName: "Sistema",
    actorRole: "Automatizado",
    ownerId: input.executiveId ?? "sistema",
    origin: "Portal Velox",
    source: "solicitacao_investidor",
  });
  recordServiceRequestAlert({
    ownerUserId: input.executiveId ?? "sistema",
    investorId: input.investorId,
    investorName: input.investorName,
    dateIso: new Date().toISOString(),
  });
}

/**
 * Botão flutuante de WhatsApp — fixo em toda a navegação do Portal,
 * exceto Gateway (/entrar) e Área Executiva (/executivo).
 *
 * • Se o Lead entrou por link personalizado, abre direto o WhatsApp
 *   do executivo responsável ("Chame seu Executivo").
 * • Caso contrário, abre um modal enxuto (Nome/WhatsApp/E-mail) e
 *   vincula o lead ao Executivo Padrão da plataforma, sem duplicar
 *   registros ("Falar com a Velox").
 *
 * Em qualquer cenário, registra na Timeline "Solicitou atendimento
 * via WhatsApp." com data e hora.
 */
export function WhatsAppFloating() {
  const [resolved, setResolved] = useState<{
    executive: ExecutiveUser | null;
    personalized: boolean;
  }>({ executive: null, personalized: false });
  const [modalOpen, setModalOpen] = useState(false);
  /** Dentro de um overlay (iframe) o botão da Home já está visível. */
  const [insideOverlay, setInsideOverlay] = useState(false);
  /** Enquanto um módulo estiver aberto sobre a Home, o FAB global some. */
  const [overlayActive, setOverlayActive] = useState(false);

  useEffect(() => {
    setResolved(getResponsibleExecutive());
    setInsideOverlay(typeof window !== "undefined" && window.self !== window.top);
  }, []);

  useEffect(() => {
    setOverlayActive(getActiveOverlay() !== null);
    return subscribeOverlay((key) => setOverlayActive(key !== null));
  }, []);

  if (insideOverlay || overlayActive) return null;

  const label = "Solicitar Atendimento";

  const openDirect = () => {
    const exec = resolved.executive;
    if (!exec) return;
    const raw = (exec.whatsapp || exec.phone || "").replace(/\D/g, "");
    if (!raw) return;
    const session = getPortalSession();
    const first = exec.name.split(" ")[0];
    const msg = session?.name
      ? `Olá ${first}! Sou ${session.name} e gostaria de continuar nossa conversa sobre a Velox.`
      : `Olá ${first}! Gostaria de conversar sobre a Velox.`;
    trackJourney({
      type: "whatsapp.requested",
      investorId: session?.investorId ?? null,
      detail: "Solicitou atendimento pelo WhatsApp",
      payload: { executiveId: exec.id, personalized: true },
    });
    requestService({
      investorId: session?.investorId ?? null,
      investorName: session?.name ?? "Investidor",
      executiveId: exec.id,
    });
    window.open(`https://wa.me/${raw}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleClick = () => {
    if (resolved.personalized && resolved.executive) openDirect();
    else setModalOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className="fixed bottom-6 right-6 z-[70] inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-medium text-white shadow-[0_18px_40px_-12px_rgba(37,211,102,0.55)] transition hover:scale-[1.03] hover:bg-[#1FAE54]"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {modalOpen && (
        <WhatsAppLeadModal
          onClose={() => setModalOpen(false)}
          onSubmitted={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function WhatsAppLeadModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState<Pick<VisitorIdentity, "name" | "whatsapp" | "email">>({
    name: "",
    whatsapp: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const defaultExec = useMemo(() => getDefaultExecutive(), []);

  useEffect(() => {
    const s = getPortalSession();
    if (s) setForm((f) => ({ ...f, name: s.name, email: s.email }));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const canSubmit =
    form.name.trim().length > 1 &&
    form.whatsapp.replace(/\D/g, "").length >= 10 &&
    /.+@.+\..+/.test(form.email);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const normalizedEmail = form.email.trim().toLowerCase();
    const existing = loadLeads().find((l) => l.email.toLowerCase() === normalizedEmail);
    let investorId: string | null = null;

    if (existing) {
      const updated = updateLead(existing.id, {
        name: form.name,
        whatsapp: form.whatsapp,
        email: normalizedEmail,
      });
      investorId = updated?.id ?? existing.id;
    } else {
      const { lead } = registerLead({
        identity: { name: form.name, whatsapp: form.whatsapp, email: normalizedEmail, city: "" },
        material: "Falar com a Velox",
        origin: "Botão flutuante · WhatsApp",
      });
      investorId = lead.id;
    }

    const raw = (defaultExec?.whatsapp || defaultExec?.phone || "").replace(/\D/g, "");
    const first = defaultExec?.name?.split(" ")[0] ?? "Velox";
    const msg = `Olá ${first}! Sou ${form.name} e gostaria de conversar com a Velox.`;

    trackJourney({
      type: "whatsapp.requested",
      investorId,
      detail: "Solicitou atendimento pelo WhatsApp",
      payload: { executiveId: defaultExec?.id ?? null, personalized: false },
    });
    requestService({
      investorId,
      investorName: form.name,
      executiveId: defaultExec?.id ?? null,
    });

    if (raw) window.open(`https://wa.me/${raw}?text=${encodeURIComponent(msg)}`, "_blank");
    setSubmitting(false);
    onSubmitted();
  };

  const field =
    "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/25 transition";

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="px-7 pt-7 pb-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#25D366]">
              <MessageCircle className="h-3.5 w-3.5" /> Solicitar Atendimento
            </div>
            <h2 className="mt-3 font-[var(--font-editorial)] text-2xl leading-tight text-slate-900">
              Antes de iniciarmos.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Nos conte com quem estamos falando para direcionarmos você ao
              especialista responsável.
            </p>
          </div>
          <form onSubmit={submit} className="px-7 pb-7 pt-4 space-y-3">
            <input
              className={field}
              placeholder="Nome completo"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              className={field}
              placeholder="WhatsApp — (00) 00000-0000"
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              required
            />
            <input
              className={field}
              placeholder="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#1FAE54] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Encaminhando..." : "Continuar no WhatsApp"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}