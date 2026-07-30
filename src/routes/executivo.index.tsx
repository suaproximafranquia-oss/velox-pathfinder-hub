import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { getSession, signInWithCloud } from "@/lib/executive-auth";
import { WORKSPACE } from "@/config/workspace";

export const Route = createFileRoute("/executivo/")({
  head: () => ({
    meta: [
      { title: "Atlas Platform — Acesso corporativo" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExecutiveLoginPage,
});

function ExecutiveLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s) navigate({ to: "/executivo/home" });
  }, [navigate]);

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
      navigate({ to: "/executivo/home" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)] bg-grain px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir Portal Velox em nova aba"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Portal Velox
          </a>
        </div>
        <div className="text-center mb-8">
          {WORKSPACE.workspaceLogoUrl ? (
            <img
              src={WORKSPACE.workspaceLogoUrl}
              alt={WORKSPACE.workspaceName}
              className="mx-auto mb-4 h-10 w-auto object-contain"
            />
          ) : null}
          <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)] mb-2">
            {WORKSPACE.workspaceTagline}
          </p>
          <h1 className="font-display text-2xl md:text-3xl tracking-wide">
            {WORKSPACE.workspaceName}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            Acesso corporativo restrito à equipe autorizada.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-6 space-y-5"
        >
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
              placeholder="nome@empresa.com.br"
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
          <p className="text-[11px] text-[color:var(--muted-foreground)]/70 text-center leading-relaxed">
            Autenticação local — nenhum dado é enviado para servidores externos.
          </p>
        </form>
        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]/70">
          {WORKSPACE.poweredBy}
        </p>
      </div>
    </div>
  );
}