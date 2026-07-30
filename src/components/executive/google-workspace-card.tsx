import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Info, Loader2, LogOut, RefreshCw } from "lucide-react";
import type { ExecutiveSession } from "@/lib/executive-auth";
import {
  CONNECTOR_LABEL,
  GOOGLE_SCOPES,
  disconnect,
  getGoogleStore,
  isConnectorConnected,
  refreshGoogleStore,
  startConnect,
  subscribeGoogleStore,
  type GoogleConnectorKey,
  type GoogleStore,
} from "@/lib/google-workspace";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12S6.8 21.4 12 21.4c6.9 0 9.5-4.8 9.5-8.6 0-.6-.1-1-.1-1.5H12z"/>
      <path fill="#34A853" d="M3.9 7.4l3.2 2.4C8 8.4 9.9 7.4 12 7.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 4.9 14.7 3.9 12 3.9 8 3.9 4.6 6.1 3.9 7.4z"/>
      <path fill="#FBBC05" d="M12 21.4c2.7 0 4.9-.9 6.5-2.4l-3.1-2.4c-.8.6-2 1.1-3.4 1.1-2.6 0-4.8-1.7-5.6-4.1L3.2 16C4.8 19.2 8.1 21.4 12 21.4z"/>
      <path fill="#4285F4" d="M21.4 12.8c0-.6-.1-1-.1-1.5H12v3.9h5.5c-.3 1.4-1.4 2.5-2.6 3.2l3.1 2.4c1.8-1.7 3.4-4.2 3.4-8z"/>
    </svg>
  );
}

const CONNECTORS: { id: GoogleConnectorKey; description: string }[] = [
  {
    id: "google_calendar",
    description:
      "Cria os eventos reais na sua agenda, gera o link oficial do Google Meet e envia os convites por e-mail.",
  },
  {
    id: "google_drive",
    description:
      "Organiza os documentos do investidor em pastas dedicadas dentro de \u201cPortal Velox\u201d.",
  },
  {
    id: "google_mail",
    description: "Permite enviar comunicações do Portal a partir do seu próprio e-mail.",
  },
];

/**
 * Google Workspace — conexão OAuth 2.0 oficial por executivo.
 * As credenciais ficam apenas no servidor, criptografadas.
 */
export function GoogleWorkspaceCard({ session }: { session: ExecutiveSession }) {
  const [store, setStore] = useState<GoogleStore>(() => getGoogleStore(session.userId));
  const [busy, setBusy] = useState<GoogleConnectorKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sync = useCallback(() => setStore(getGoogleStore(session.userId)), [session.userId]);

  useEffect(() => {
    const off = subscribeGoogleStore(session.userId, sync);
    void refreshGoogleStore(session.userId);
    return off;
  }, [session.userId, sync]);

  const actor = {
    userId: session.userId,
    userName: session.name,
    userRole: session.activeRole,
  };

  async function handleConnect(connectorId: GoogleConnectorKey) {
    setMessage(null);
    setBusy(connectorId);
    try {
      const next = await startConnect(actor, connectorId);
      if (next.state === "error") setMessage(next.error);
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(connectorId: GoogleConnectorKey) {
    setBusy(connectorId);
    try {
      await disconnect(actor, connectorId);
    } finally {
      setBusy(null);
    }
  }

  const connectedEmail = store.account?.email ?? null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg mb-3">Google Workspace</h2>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60">
            <GoogleIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base">Conta Google</p>
            <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed mt-1">
              {connectedEmail
                ? `Conectada como ${connectedEmail}. As reuniões confirmadas passam a criar eventos e links do Meet automaticamente.`
                : "Conecte sua conta para criar eventos no Calendar, gerar links do Meet e enviar convites automaticamente."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              {connectedEmail ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Conectada
                </>
              ) : (
                <>
                  <Info className="h-3 w-3" /> Não conectada
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => void refreshGoogleStore(session.userId)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] text-[color:var(--muted-foreground)] hover:border-[color:var(--gold)]/40 transition"
            >
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-[color:var(--border)]/60 pt-5">
          {CONNECTORS.map((item) => {
            const isConnected = isConnectorConnected(store, item.id);
            const isBusy = busy === item.id;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)]/60 bg-[color:var(--background)]/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">{CONNECTOR_LABEL[item.id]}</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)] leading-relaxed mt-0.5">
                    {item.description}
                  </p>
                </div>
                {isConnected ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDisconnect(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:border-red-400/50 hover:text-red-400 transition disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleConnect(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-4 py-1.5 text-[11px] text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <GoogleIcon className="h-3 w-3" />}
                    Conectar
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {(message || store.error) && (
          <p className="mt-4 text-[11px] text-red-400">{message ?? store.error}</p>
        )}

        <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Escopos: Calendar · Meet · Drive · Gmail · Perfil · E-mail
        </p>
        <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
          {GOOGLE_SCOPES.length} permissões — nenhuma além do necessário. Os tokens ficam
          exclusivamente no servidor, criptografados e vinculados ao seu acesso.
        </p>
      </div>
    </section>
  );
}
