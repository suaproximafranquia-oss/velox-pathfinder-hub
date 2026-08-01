import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  getSession,
  signInWithCloud,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { markCrmActivity, isCrmSessionExpired } from "@/lib/crm/session";
import { crmCssVars, resolveCrmBranding } from "@/lib/crm/theme";

/**
 * Shell do CRM de Relacionamento.
 *
 * Reutiliza integralmente a autenticação existente: se já houver sessão
 * da Central do Executivo, o CRM abre direto. Caso contrário, solicita
 * o mesmo e-mail e senha já cadastrados — sem criar novos usuários.
 */
export function CrmShell({
  title,
  children,
}: {
  title: string;
  children: (session: ExecutiveSession) => ReactNode;
}) {
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [ready, setReady] = useState(false);
  const branding = useMemo(() => resolveCrmBranding(), []);
  const themeVars = useMemo(
    () => crmCssVars(branding) as React.CSSProperties,
    [branding],
  );

  useEffect(() => {
    const s = getSession();
    if (s && !isCrmSessionExpired()) {
      markCrmActivity();
      setSession(s);
    }
    setReady(true);
  }, []);

  // Preparação da regra de inatividade (~4h): apenas registra atividade.
  useEffect(() => {
    if (!session) return;
    const onActivity = () => markCrmActivity();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [session]);

  if (!ready) return null;

  if (!session) {
    return (
      <div style={themeVars}>
        <CrmLogin
          companyName={branding.companyName}
          onSuccess={(s) => {
            markCrmActivity();
            setSession(s);
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={themeVars}
      className="min-h-screen bg-[color:var(--crm-background)] text-[color:var(--crm-foreground)]"
    >
      <header className="border-b border-[color:var(--crm-border)] bg-[color:var(--crm-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.companyName} className="h-6 w-auto" />
            ) : null}
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium tracking-wide">{title}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--crm-muted)]">
                {branding.tagline}
              </span>
            </div>
          </div>
          <span className="text-xs text-[color:var(--crm-muted)]">
            {session.name}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children(session)}</main>
    </div>
  );
}

function CrmLogin({
  companyName,
  onSuccess,
}: {
  companyName: string;
  onSuccess: (s: ExecutiveSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const s = await signInWithCloud(email, password);
      if (!s) {
        setError("Credenciais inválidas. Verifique usuário e senha e tente novamente.");
        return;
      }
      onSuccess(s);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--crm-background)] text-[color:var(--crm-foreground)] px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-6 space-y-5"
      >
        <div className="text-center">
          <h1 className="text-xl font-medium tracking-wide">{companyName}</h1>
          <p className="mt-2 text-sm text-[color:var(--crm-muted)]">
            Utilize o mesmo acesso da Central do Executivo.
          </p>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-[color:var(--crm-muted)] mb-2">
            E-mail Corporativo
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-4 py-3 text-sm outline-none focus:border-[color:var(--crm-primary)]"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-[color:var(--crm-muted)] mb-2">
            Senha
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-4 py-3 text-sm outline-none focus:border-[color:var(--crm-primary)]"
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition disabled:opacity-60 bg-[color:var(--crm-primary)] text-[color:var(--crm-primary-foreground)]"
        >
          <Lock className="h-4 w-4" /> {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}