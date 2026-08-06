import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, LogOut, RefreshCw } from "lucide-react";
import type { ExecutiveSession } from "@/lib/executive-auth";
import {
  connectGoogleAccount,
  canManageGoogleAccount,
  disconnectGoogleAccount,
  getGoogleStore,
  isGoogleAccountConnected,
  refreshGoogleStore,
  subscribeGoogleStore,
  friendlyGoogleMessage,
  googleIssues,
  needsGoogleReauth,
  reconnectGoogleAccount,
  testGoogleService,
  GOOGLE_ACCOUNT_CONNECTORS,
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

function formatSync(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * CONTA GOOGLE — cartão único.
 *
 * Calendar, Meet, Drive e Gmail pertencem à mesma conta: o pareamento é
 * feito uma única vez e permanece ativo. Nenhuma mensagem técnica é
 * exibida — apenas o estado da conta em linguagem natural.
 */
export function GoogleWorkspaceCard({ session }: { session: ExecutiveSession }) {
  const [store, setStore] = useState<GoogleStore>(() => getGoogleStore(session.userId));
  const [busy, setBusy] = useState<"connect" | "disconnect" | "test" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const sync = useCallback(() => setStore(getGoogleStore(session.userId)), [session.userId]);

  useEffect(() => {
    const off = subscribeGoogleStore(session.userId, sync);
    void refreshGoogleStore(session.userId);
    return off;
  }, [session.userId, sync]);

  const actor = { userId: session.userId, userName: session.name, userRole: session.activeRole };
  const connected = isGoogleAccountConnected(store);
  const email = store.account?.email ?? null;
  const canManage = canManageGoogleAccount(session.activeRole);
  const issues = googleIssues(store);
  const reauth = needsGoogleReauth(store);

  async function handleConnect() {
    setMessage(null);
    setTestOk(null);
    setBusy("connect");
    try {
      const next = reauth ? await reconnectGoogleAccount(actor) : await connectGoogleAccount(actor);
      if (next.state === "error") {
        setMessage(next.error ?? "Não foi possível concluir a conexão com o Google. Tente novamente.");
      }
    } catch (err) {
      setMessage(friendlyGoogleMessage(err));
    } finally {
      setBusy(null);
    }
  }

  /** Verificação real: uma chamada à API do Google por serviço. */
  async function handleTest() {
    setMessage(null);
    setBusy("test");
    try {
      const results = await Promise.all(
        GOOGLE_ACCOUNT_CONNECTORS.map(async (id) => ({ id, ...(await testGoogleService(id)) })),
      );
      const failed = results.filter((r) => !r.ok);
      setTestOk(failed.length === 0);
      setMessage(
        failed.length === 0
          ? "Conexão validada: o Google respondeu com sucesso para agenda, arquivos e e-mail."
          : failed.map((f) => f.message).join(" "),
      );
      await refreshGoogleStore(session.userId);
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    setMessage(null);
    setBusy("disconnect");
    try {
      await disconnectGoogleAccount(actor);
    } catch {
      setMessage("Não foi possível desconectar a conta agora. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg mb-3">Conta Google</h2>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60">
            <GoogleIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base">
              {connected
                ? (email ?? "Conta Google conectada")
                : reauth
                  ? "Autorização do Google expirada"
                  : "Nenhuma conta conectada"}
            </p>
            <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed mt-1">
              {connected
                ? "Agenda, reuniões, documentos e e-mails do Portal usam esta conta automaticamente."
                : "Conecte sua conta para que agenda, reuniões, documentos e e-mails funcionem automaticamente."}
            </p>
            <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
              Última sincronização: {formatSync(store.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              {connected ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Conectada
                </>
              ) : reauth ? (
                <>
                  <AlertTriangle className="h-3 w-3 text-amber-400" /> Reconexão necessária
                </>
              ) : (
                <>
                  <Info className="h-3 w-3" /> Não conectada
                </>
              )}
            </span>
            {canManage ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleTest()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] transition hover:border-[color:var(--gold)] disabled:opacity-50"
              >
                {busy === "test" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Testar conexão
              </button>
            ) : null}
            {!canManage ? null : connected ? (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void handleConnect()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-4 py-1.5 text-[11px] text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-50"
                >
                  {busy === "connect" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <GoogleIcon className="h-3 w-3" />
                  )}
                  Trocar conta
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void handleDisconnect()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:border-red-400/50 hover:text-red-400 transition disabled:opacity-50"
                >
                  {busy === "disconnect" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <LogOut className="h-3 w-3" />
                  )}
                  Desconectar
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleConnect()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-4 py-1.5 text-[11px] text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-50"
              >
                {busy === "connect" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <GoogleIcon className="h-3 w-3" />
                )}
                {reauth ? "Reconectar conta Google" : "Conectar conta Google"}
              </button>
            )}
          </div>
        </div>

        {message && (
          <p className={"mt-4 text-[11px] " + (testOk ? "text-emerald-500" : "text-amber-400")}>
            {message}
          </p>
        )}

        {!connected && issues.length > 0 && (
          <ul className="mt-3 space-y-1 text-[11px] text-[color:var(--muted-foreground)]">
            {issues.map((i) => (
              <li key={i}>· {i}</li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
          {canManage
            ? "A autorização é feita uma única vez e permanece ativa para todo o Portal. Só será solicitada novamente se o acesso for revogado no Google ou desconectado aqui."
            : "Esta é a Conta Google corporativa do Portal, usada por agenda, reuniões, arquivos e e-mails. A gestão é feita pela administração."}
        </p>
      </div>
    </section>
  );
}
