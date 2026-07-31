import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import type { Investor } from "@/lib/executive-data";
import { createMeeting } from "@/lib/meetings";
import type { ExecutiveSession } from "@/lib/executive-auth";
import {
  MEETING_PROVIDERS,
  getDefaultProviderForExecutive,
  getProvider,
  tryGenerateProviderLink,
  type MeetingProviderId,
} from "@/lib/meeting-providers";
import { trySyncCreate, checkConflicts, DEFAULT_TIMEZONE } from "@/lib/google-calendar";
import { getGoogleStore } from "@/lib/google-workspace";

/**
 * Diálogo de criação de reunião a partir do Perfil do Investidor.
 * A reunião nasce sempre vinculada ao lead — nunca a partir da Central.
 */
export function InvestorMeetingDialog({
  investor,
  session,
  onClose,
  onCreated,
}: {
  investor: Investor;
  session: ExecutiveSession;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [providerId, setProviderId] = useState<MeetingProviderId>(
    () => getDefaultProviderForExecutive(session.userId),
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  // Preenchimento automático: o e-mail do investidor vem do cadastro e o do
  // executivo da sessão. Ambos permanecem editáveis antes do envio.
  const [investorEmail, setInvestorEmail] = useState(investor.email ?? "");
  const [executiveEmail, setExecutiveEmail] = useState(
    () => session.email ?? getGoogleStore(session.userId).account?.email ?? "",
  );
  const [conflicts, setConflicts] = useState<{ summary: string; start: string; end: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = getProvider(providerId);
  const googleStore = getGoogleStore(session.userId);
  const googleConnected = googleStore.state === "connected";

  async function submit(force = false) {
    if (!date || !time || submitting) return;
    setError(null);
    if (provider.id === "manual" && !meetUrl.trim()) {
      setError("Informe o link da reunião.");
      return;
    }
    const iso = new Date(`${date}T${time}:00`).toISOString();
    if (Number.isNaN(Date.parse(iso))) {
      setError("Data ou horário inválido.");
      return;
    }
    if (new Date(iso).getTime() < Date.now()) {
      setError("Escolha uma data e um horário futuros.");
      return;
    }
    const endIso = new Date(new Date(iso).getTime() + 60 * 60_000).toISOString();
    if (!force && googleConnected && provider.id === "google_meet") {
      const found = checkConflicts(session.userId, iso, endIso);
      if (found.length > 0) {
        setConflicts(found.map((e) => ({ summary: e.summary, start: e.start, end: e.end })));
        return;
      }
    }
    const gen = tryGenerateProviderLink(provider.id, {
      executiveId: session.userId,
      manualUrl: meetUrl,
    });
    setSubmitting(true);
    const created = createMeeting({
      investorId: investor.id,
      investorName: investor.name,
      investorEmail: investorEmail.trim() || undefined,
      executiveId: session.userId,
      executiveName: session.name,
      scheduledAt: iso,
      durationMin: 60,
      meetUrl: gen.url || undefined,
      meetingProvider: provider.id,
      meetingProviderStatus: gen.status,
      meetingProviderUrl: gen.url || undefined,
    });
    if (provider.id === "google_meet" && googleConnected) {
      await trySyncCreate(created, {
        userId: session.userId,
        userName: session.name,
        userRole: "Executivo",
        email: executiveEmail.trim() || undefined,
      });
    }
    setSubmitting(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              Nova reunião
            </p>
            <h2 className="font-display text-lg">{investor.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              Provedor da reunião
            </span>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value as MeetingProviderId)}
              className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
            >
              {MEETING_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.enabled}>
                  {p.label}{p.comingSoon ? " (em breve)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">Data</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">Hora</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                E-mail do investidor
              </span>
              <input
                type="email"
                value={investorEmail}
                onChange={(e) => setInvestorEmail(e.target.value)}
                placeholder="investidor@email.com"
                className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                Seu e-mail
              </span>
              <input
                type="email"
                value={executiveEmail}
                onChange={(e) => setExecutiveEmail(e.target.value)}
                placeholder="executivo@velox.com.br"
                className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
          </div>

          {provider.id === "manual" ? (
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">Link da reunião *</span>
              <input
                value={meetUrl}
                onChange={(e) => setMeetUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
          ) : provider.id === "google_meet" ? (
            <p className="rounded-md border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]">
              {googleConnected
                ? `Evento será criado no Google Calendar (${DEFAULT_TIMEZONE}) com Meet e convites automáticos.`
                : "Conecte a integração Google para gerar link automaticamente."}
            </p>
          ) : (
            <p className="rounded-md border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]">
              {provider.label} — aguardando configuração da integração.
            </p>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          {conflicts.length > 0 && (
            <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
              <p className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3 w-3" /> Conflito de agenda detectado
              </p>
              <ul className="space-y-0.5">
                {conflicts.map((c, i) => (
                  <li key={i}>· {c.summary}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={submitting || !date || !time}
              onClick={() => submit(conflicts.length > 0)}
              className="flex-1 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--accent)] px-4 py-2 text-sm text-[color:var(--foreground)] hover:border-[color:var(--gold)] disabled:opacity-40"
            >
              {conflicts.length > 0 ? "Agendar mesmo assim" : submitting ? "Criando..." : "Criar reunião"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}