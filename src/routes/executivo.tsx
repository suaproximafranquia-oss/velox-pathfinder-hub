import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { getSession, signIn } from "@/lib/executive-auth";

export const Route = createFileRoute("/executivo")({
  head: () => ({
    meta: [
      { title: "Central do Executivo — Velox" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExecutiveLoginPage,
});

function ExecutiveLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (s) navigate({ to: "/executivo/dashboard" });
  }, [navigate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const s = signIn(username, password);
    if (!s) {
      setError("Usuário ou senha inválidos.");
      return;
    }
    navigate({ to: "/executivo/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)] bg-grain px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link
            to="/"
            title="Retornando ao Manual do Investidor"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Manual
          </Link>
        </div>
        <div className="text-center mb-8">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--gold)]/40 text-[color:var(--gold)] font-display mb-4">
            V
          </span>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)] mb-2">
            Acesso restrito
          </p>
          <h1 className="font-display text-2xl md:text-3xl">Central do Executivo</h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
            Ambiente destinado à equipe Velox.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-6 space-y-5"
        >
          <div>
            <label className="block text-xs uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-4 py-3 text-sm outline-none focus:border-[color:var(--gold)]/50"
              autoComplete="username"
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
          {error && <p className="text-sm text-red-400/90">{error}</p>}
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-6 py-3 text-sm font-medium text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition"
          >
            <Lock className="h-4 w-4" /> Entrar
          </button>
          <p className="text-[11px] text-[color:var(--muted-foreground)]/70 text-center leading-relaxed">
            Ambiente de demonstração — acesso restrito à equipe Velox.
          </p>
        </form>
      </div>
    </div>
  );
}