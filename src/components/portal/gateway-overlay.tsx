/**
 * Gateway do Portal Velox — overlay obrigatório sobre a Home.
 *
 * Deixou de ser rota pública (`/entrar`): a Home é a única porta de
 * entrada. O Gateway identifica o visitante, cria a sessão oficial e
 * devolve o controle para a Home abrir o módulo solicitado.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck, X } from "lucide-react";
import { getExecutiveBySlug } from "@/lib/executive-auth";
import { setResponsibleExecutiveSlug } from "@/lib/responsible-executive";
import { readEntryContext } from "@/lib/portal-entry";
import { startPortalSession } from "@/lib/portal-session";
import { getVisitorIdentity } from "@/lib/leads";

export function GatewayOverlay({
  open,
  moduleTitle,
  onDone,
  onClose,
}: {
  open: boolean;
  moduleTitle?: string | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const executive = useMemo(() => {
    if (!open) return null;
    const slug = readEntryContext().executiveSlug;
    return slug ? (getExecutiveBySlug(slug) ?? null) : null;
  }, [open]);

  /**
   * DEF 2.4.11 — quem chega pelo link personalizado do Executivo (ou já
   * foi identificado antes) nunca é questionado novamente: apenas
   * recebe a confirmação de continuidade da experiência.
   */
  const known = useMemo(() => {
    if (!open) return null;
    const identity = getVisitorIdentity();
    if (!identity?.name || !identity?.email) return null;
    return identity;
  }, [open]);
  const welcomeBack = Boolean(known);

  useEffect(() => {
    if (!open) return;
    if (executive) setResponsibleExecutiveSlug(executive.slug);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, executive, onClose]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2) {
      setError("Informe seu nome para continuar.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Informe um e-mail válido para restaurar ou criar seu perfil.");
      return;
    }
    const entry = readEntryContext();
    if (executive) setResponsibleExecutiveSlug(executive.slug);
    startPortalSession({
      name: trimmedName,
      email: trimmedEmail,
      phone: phone.trim(),
      origin:
        entry.origin ?? (executive ? `Link personalizado · ${executive.name}` : "Portal Velox"),
    });
    setError("");
    onDone();
  };

  /** Retorno reconhecido: continuidade imediata, sem qualquer formulário. */
  const continueKnown = () => {
    if (!known) return;
    const entry = readEntryContext();
    if (executive) setResponsibleExecutiveSlug(executive.slug);
    startPortalSession({
      name: known.name,
      email: known.email,
      phone: known.whatsapp,
      origin:
        entry.origin ?? (executive ? `Link personalizado · ${executive.name}` : "Portal Velox"),
    });
    onDone();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Fechar identificação"
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
        aria-label="Identificação do investidor"
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
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border transition hover:scale-105"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          <X className="h-4 w-4" />
        </button>

        {welcomeBack ? (
          <div className="p-7 md:p-9">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--gold)]">
              Sua jornada Velox
            </p>
            <h2 className="portal-serif mt-3 text-3xl leading-tight">
              Bem-vindo novamente, {known?.name?.split(" ")[0]}.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              Seu progresso foi restaurado.
            </p>
            <button
              type="button"
              onClick={continueKnown}
              className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-6 py-4 text-sm font-medium text-[color:var(--gold-foreground)] transition hover:shadow-[0_15px_50px_-15px_var(--gold)]"
            >
              Continuar jornada
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="mt-6 flex gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
              <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
                Continuamos exatamente de onde você parou. Nada precisa ser
                informado novamente.
              </p>
            </div>
          </div>
        ) : (
        <form onSubmit={submit} className="p-7 md:p-9">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--gold)]">
            Sua jornada Velox
          </p>
          <h2 className="portal-serif mt-3 text-3xl leading-tight">
            Antes de iniciar, vamos identificar sua jornada.
          </h2>
          {executive ? (
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              Você está entrando pelo link de {executive.name}. O vínculo será preservado durante
              toda a jornada.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              {moduleTitle ? `Para abrir ${moduleTitle}, identifique-se. ` : ""}
              Se já existir um perfil com este e-mail, seu progresso será restaurado
              automaticamente.
            </p>
          )}

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Nome
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                autoFocus
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)]"
                placeholder="Seu nome completo"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                E-mail
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)]"
                placeholder="voce@email.com"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                WhatsApp
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)]"
                placeholder="(00) 00000-0000"
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-[color:var(--destructive)]">{error}</p> : null}

          <button
            type="submit"
            className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-6 py-4 text-sm font-medium text-[color:var(--gold-foreground)] transition hover:shadow-[0_15px_50px_-15px_var(--gold)]"
          >
            Continuar jornada
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-6 flex gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
            <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
              Estas informações serão utilizadas apenas para identificar sua jornada caso você
              retorne futuramente, permitindo restaurar seu progresso e personalizar sua
              experiência dentro da plataforma.
            </p>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
