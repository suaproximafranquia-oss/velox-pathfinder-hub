import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { ExecutiveSession } from "@/lib/executive-auth";
import {
  getGoogleStore,
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

  const tone =
    store.state === "connected" ? "#34A853" : store.state === "error" ? "#E0A458" : "#8A94A6";
  const label =
    store.state === "connected"
      ? `Google conectado${store.account?.email ? ` · ${store.account.email}` : ""}`
      : store.state === "error"
        ? "Google · reconectar conta"
        : "Google · conta não conectada";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => navigate({ to: "/executivo/perfil" })}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] hover:border-[color:var(--gold)]/40 transition"
    >
      <GoogleGlyph tone={tone} />
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[color:var(--navy-deep)]"
        style={{ background: tone }}
      />
    </button>
  );
}
