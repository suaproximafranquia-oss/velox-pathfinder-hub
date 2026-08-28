import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { ExecutiveSession } from "@/lib/executive-auth";
import {
  getGoogleStore,
  canManageGoogleAccount,
  isGoogleAccountConnected,
  refreshGoogleStore,
  subscribeGoogleStore,
  type GoogleStore,
} from "@/lib/google-workspace";

function GoogleGlyph({ tone }: { tone: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill={tone}
        d="M21.4 12.8c0-.6-.1-1-.1-1.5H12v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12S6.8 21.4 12 21.4c6.9 0 9.5-4.8 9.5-8.6z"
      />
    </svg>
  );
}

/**
 * Indicador global do Google Workspace no shell — reflete o estado real
 * da conta conectada do executivo (Calendar, Meet, Drive e Gmail).
 */
export function GoogleStatusIndicator({ session }: { session: ExecutiveSession }) {
  const navigate = useNavigate();
  const [store, setStore] = useState<GoogleStore>(() => getGoogleStore(session.userId));
  const sync = useCallback(() => setStore(getGoogleStore(session.userId)), [session.userId]);

  useEffect(() => {
    const off = subscribeGoogleStore(session.userId, sync);
    void refreshGoogleStore(session.userId);
    return off;
  }, [session.userId, sync]);

  const connected = isGoogleAccountConnected(store);
  const canManage = canManageGoogleAccount(session.activeRole);
  const tone = connected ? "#34A853" : "#E0533D";
  const label = connected
    ? `Google conectado${store.account?.email ? ` · ${store.account.email}` : ""}`
    : "Google desconectado";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={!canManage}
      onClick={() => {
        if (canManage) void navigate({ to: "/f/executivo/configuracoes" });
      }}
      className={
        "relative inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-2.5 py-1 transition " +
        (canManage ? "hover:border-[color:var(--gold)]/40" : "cursor-default")
      }
    >
      <GoogleGlyph tone={tone} />
      <span className="hidden sm:inline text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
        {connected ? "Google conectado" : "Google desconectado"}
      </span>
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: tone }}
      />
    </button>
  );
}
