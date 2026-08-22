import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  getSession,
  signInWithCloud,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { markCrmActivity, isCrmSessionExpired } from "@/lib/crm/session";
import { crmCssVars, resolveCrmBranding } from "@/lib/crm/theme";
import { findCrmTheme, getUserCrmTheme } from "@/lib/crm/themes";
import { onSync } from "@/lib/sync-bus";
import { ModuleAccessDenied } from "@/components/executive/module-access-guard";
import { useModuleAccess } from "@/hooks/use-workspace-permissions";

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
  const [themeId, setThemeId] = useState(() => getUserCrmTheme(null));
  const theme = useMemo(() => findCrmTheme(themeId), [themeId]);
  const branding = useMemo(
    () => resolveCrmBranding({ colors: theme.colors }),
    [theme],
  );
  const themeVars = useMemo(
    () =>
      ({
        ...crmCssVars(branding),
        // O tema aplica somente características visuais (cores, bordas,
        // sombras, textura). A imagem do card é preview de galeria e
        // NUNCA é renderizada sobre a área operacional do CRM.
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }) as React.CSSProperties,
    [branding, theme],
  );

  useEffect(() => {
    const s = getSession();
    if (s && !isCrmSessionExpired()) {
      markCrmActivity();
      setSession(s);
      setThemeId(getUserCrmTheme(s.userId));
      // Reabre a sessão real do backend neste navegador antes das leituras.
      void import("@/lib/auth-bearer").then(({ getAccessToken }) => getAccessToken());
    }
    setReady(true);
  }, []);

  // Troca de tema aplicada instantaneamente, sem recarregar o CRM.
  useEffect(() => {
    if (!session) return;
    return onSync(() => setThemeId(getUserCrmTheme(session.userId)), ["theme"]);
  }, [session]);

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

  /**
   * ATUALIZAÇÃO ESTRUTURAL §1 — a autorização do CRM vem do servidor e é
   * reavaliada continuamente: revogar o módulo bloqueia a sessão aberta,
   * sem depender de recarregamento.
   */
  const crmAllowed = useModuleAccess(
    session?.userId ?? "",
    session?.activeRole ?? "executivo",
    "crm",
  );

  if (!ready) return null;

  if (!session) {
    return (
      <div className="crm-root" data-crm-theme={theme.id} style={themeVars}>
        <CrmLogin
          companyName={branding.companyName}
          onSuccess={(s) => {
            markCrmActivity();
            setThemeId(getUserCrmTheme(s.userId));
            setSession(s);
          }}
        />
      </div>
    );
  }

  const initials = session.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  // COMANDO 3B §3/§11 — sem permissão individual, nenhum componente ou
  // dado do CRM é carregado, mesmo em acesso direto por URL.
  if (!crmAllowed) {
    return <ModuleAccessDenied moduleKey="crm" />;
  }

  return (
    <div
      style={themeVars}
      data-crm-theme={theme.id}
      className="crm-root flex h-screen w-full flex-col overflow-hidden bg-[color:var(--crm-background)] text-[color:var(--crm-foreground)]"
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.companyName} className="h-5 w-auto" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[color:var(--crm-accent-soft)] text-[11px] font-semibold text-[color:var(--crm-accent)]">
              C
            </span>
          )}
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="hidden truncate text-xs text-[color:var(--crm-muted)] sm:inline">
            · {branding.tagline}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-[color:var(--crm-muted)] sm:inline">
            {session.name}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--crm-hover)] text-[11px] font-medium text-[color:var(--crm-muted)]">
            {initials}
          </span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">{children(session)}</div>
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
          <h1
            style={{ fontFamily: "inherit" }}
            className="text-lg font-semibold tracking-tight"
          >
            {companyName}
          </h1>
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