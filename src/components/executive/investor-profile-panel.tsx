import { useEffect, useState } from "react";
import { X, Clock, User, Calendar } from "lucide-react";
import { buildInvestorProfile, type InvestorProfile } from "@/lib/investor-profile";
import { onEvent } from "@/lib/events/bus";

/**
 * Perfil Inteligente — overlay (modal sobre modal permitido).
 * Fechamento exclusivo via X, preservando o contexto anterior.
 */
export function InvestorProfilePanel({
  investorId,
  open,
  onClose,
}: {
  investorId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<InvestorProfile | null>(null);

  useEffect(() => {
    if (!open || !investorId) return;
    const refresh = () => setProfile(buildInvestorProfile(investorId));
    refresh();
    return onEvent(refresh);
  }, [open, investorId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !investorId) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(3, 12, 28, 0.6)", backdropFilter: "blur(10px)" }}
      />
      <div className="absolute inset-x-4 top-[5vh] bottom-[5vh] md:inset-x-auto md:right-6 md:left-auto md:w-[520px] rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] shadow-2xl overflow-hidden flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent)] text-[color:var(--gold)]">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                Perfil Inteligente
              </p>
              <p className="font-display text-base truncate">
                {profile?.identity?.name ?? investorId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {profile?.identity && (
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
                Identidade
              </p>
              <ul className="text-xs text-[color:var(--muted-foreground)] space-y-1">
                <li>WhatsApp: <span className="text-[color:var(--foreground)]">{profile.identity.whatsapp}</span></li>
                <li>Email: <span className="text-[color:var(--foreground)]">{profile.identity.email}</span></li>
                <li>Cidade: <span className="text-[color:var(--foreground)]">{profile.identity.city}</span></li>
              </ul>
            </section>
          )}

          {profile && profile.pendings.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
                Pendências
              </p>
              <ul className="space-y-2">
                {profile.pendings.map((p) => (
                  <li key={p.id} className="rounded-lg border border-[color:var(--border)] px-3 py-2">
                    <p className="text-sm">{p.title}</p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">{p.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {profile && profile.meetings.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" /> Reuniões
              </p>
              <ul className="space-y-2">
                {profile.meetings.map((m) => (
                  <li key={m.id} className="rounded-lg border border-[color:var(--border)] px-3 py-2">
                    <div className="flex justify-between text-xs">
                      <span>{new Date(m.scheduledAt).toLocaleString("pt-BR")}</span>
                      <span className="text-[color:var(--gold)]">{m.status}</span>
                    </div>
                    {m.notes.length > 0 && (
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
                        {m.notes.length} anotação(ões) pós-reunião
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Linha do tempo
            </p>
            {!profile || profile.timeline.length === 0 ? (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                Nenhum evento registrado ainda.
              </p>
            ) : (
              <ol className="space-y-2 border-l border-[color:var(--border)] pl-4">
                {profile.timeline.map((t) => (
                  <li key={`${t.kind}_${t.id}`} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[color:var(--gold)]" />
                    <p className="text-sm">{t.title}</p>
                    {t.description && (
                      <p className="text-[11px] text-[color:var(--muted-foreground)]">{t.description}</p>
                    )}
                    <p className="text-[10px] text-[color:var(--muted-foreground)]">
                      {new Date(t.at).toLocaleString("pt-BR")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}