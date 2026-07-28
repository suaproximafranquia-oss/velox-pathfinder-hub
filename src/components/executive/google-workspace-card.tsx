import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, LogOut, RefreshCw } from "lucide-react";
import type { ExecutiveSession } from "@/lib/executive-auth";
import { ROLE_LABEL } from "@/lib/executive-auth";
import {
  disconnect,
  ensureFreshToken,
  getGoogleStore,
  GOOGLE_SCOPES,
  isExpired,
  startConnect,
  subscribeGoogleStore,
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

export function GoogleWorkspaceCard({ session }: { session: ExecutiveSession }) {
  const [store, setStore] = useState<GoogleStore>(() => getGoogleStore(session.userId));
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const sync = useCallback(() => setStore(getGoogleStore(session.userId)), [session.userId]);

  useEffect(() => {
    sync();
    return subscribeGoogleStore(session.userId, sync);
  }, [session.userId, sync]);

  // Renovação automática: se expirou, tenta refresh silencioso.
  useEffect(() => {
    if (store.state !== "connected") return;
    if (!isExpired(store)) return;
    void ensureFreshToken(session.userId);
  }, [store, session.userId]);

  async function onConnect() {
    await startConnect({
      userId: session.userId,
      userName: session.name,
      userRole: ROLE_LABEL[session.activeRole],
    });
  }

  function onDisconnect() {
    disconnect({
      userId: session.userId,
      userName: session.name,
      userRole: ROLE_LABEL[session.activeRole],
    });
    setConfirmingDisconnect(false);
  }

  const account = store.account;

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
              Conecte sua conta Google para utilizar o Google Calendar, Google Meet e demais integrações do Portal Velox.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {store.state === "connected" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4A7C59]/50 bg-[rgba(74,124,89,0.15)] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#4A7C59]">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </span>
            )}
            {store.state === "error" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C53030]/50 bg-[rgba(197,48,48,0.15)] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#C53030]">
                <AlertTriangle className="h-3 w-3" /> Erro
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-[color:var(--border)]/60 pt-5">
          {store.state === "idle" && !account && (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Nenhuma conta conectada.
              </p>
              <button
                type="button"
                onClick={onConnect}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2 text-sm hover:border-[color:var(--gold)]/60 transition"
              >
                <GoogleIcon className="h-4 w-4" /> Conectar com Google
              </button>
            </div>
          )}

          {store.state === "connecting" && (
            <div className="flex items-center gap-3 text-sm text-[color:var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--gold)]" />
              Conectando sua conta...
            </div>
          )}

          {store.state === "connected" && account && (
            <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 overflow-hidden">
                {account.picture ? (
                  <img src={account.picture} alt={account.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-[color:var(--gold)]">
                    {account.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm truncate">{account.name}</p>
                <p className="text-xs text-[color:var(--muted-foreground)] truncate">{account.email}</p>
                <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
                  Conectada em {new Date(account.connectedAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => void ensureFreshToken(session.userId)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
                  title="Renovar token"
                >
                  <RefreshCw className="h-3 w-3" /> Renovar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#C53030]/50 px-3 py-1.5 text-[11px] text-[#C53030] hover:bg-[rgba(197,48,48,0.1)] transition"
                >
                  <LogOut className="h-3 w-3" /> Desconectar
                </button>
              </div>
            </div>
          )}

          {store.state === "error" && (
            <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#C53030]/50 bg-[rgba(197,48,48,0.1)] text-[#C53030]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-sm text-[color:var(--foreground)]">
                {store.error ?? "Falha na autenticação com o Google."}
              </p>
              <button
                type="button"
                onClick={onConnect}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm hover:border-[color:var(--gold)]/60 transition"
              >
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Escopos: Google Calendar · Google Meet · Perfil · E-mail
        </p>
        <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
          {GOOGLE_SCOPES.length} permissões solicitadas — nenhuma além do necessário para as integrações do Portal.
        </p>
      </div>

      {confirmingDisconnect && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-2xl">
            <h3 className="font-display text-lg mb-2">Desconectar conta Google</h3>
            <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
              Deseja remover esta conta Google do Portal Velox?
            </p>
            <p className="text-[11px] text-[color:var(--muted-foreground)] mt-3">
              As reuniões existentes não serão excluídas.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmingDisconnect(false)}
                className="flex-1 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onDisconnect}
                className="flex-1 rounded-full bg-[#C53030] px-4 py-2 text-sm text-white font-medium"
              >
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}