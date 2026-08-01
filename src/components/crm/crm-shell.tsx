import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  getSession,
  signInWithCloud,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { WORKSPACE } from "@/config/workspace";
import { markCrmActivity, isCrmSessionExpired } from "@/lib/crm/session";

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
      <CrmLogin
        onSuccess={(s) => {
          markCrmActivity();
          setSession(s);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] bg-grain">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--navy-deep)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm tracking-[0.18em]">{title}</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              {WORKSPACE.workspaceName}
            </span>
          </div>
          <span className="text-xs text-[color:var(--muted-foreground)]">
            {session.name}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children(session)}</main>
    </div>
  );
}

function CrmLogin({ onSuccess }: { onSuccess: (s: ExecutiveSession) => void }) {
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
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)] bg-grain px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-6 space-y-5"
      >
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)] mb-2">
            CRM de Relacionamento
          </p>
          <h1 className="font-display text-2xl tracking-wide">{WORKSPACE.workspaceName}</h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            Utilize o mesmo acesso da Central do Executivo.
          </p>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
            E-mail Corporativo
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-4 py-3 text-sm outline-none focus:border-[color:var(--gold)]/50"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
            Senha
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-4 py-3 text-sm outline-none focus:border-[color:var(--gold)]/50"
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-6 py-3 text-sm font-medium text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition"
        >
          <Lock className="h-4 w-4" /> {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}