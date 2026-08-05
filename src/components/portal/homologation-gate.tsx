/**
 * Tela de Proteção do ambiente de homologação (Etapa 2 §8).
 *
 * Envolve toda a aplicação. Enquanto o acesso não é liberado, nenhuma
 * rota é renderizada. Após autenticar, a sessão permanece ativa no
 * navegador e a experiência segue exatamente como antes.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Lock, Loader2 } from "lucide-react";
import background from "@/assets/atlas-homologacao-bg.png.asset.json";
import { isHomologationUnlocked, signInHomologation } from "@/lib/homologation-guard";

export function HomologationGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnlocked(isHomologationUnlocked());
    setChecked(true);
  }, []);

  // Durante a verificação (SSR/hidratação) nada é exposto.
  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050B18]">
        <Loader2 className="h-5 w-5 animate-spin text-[#D8B25A]" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (signInHomologation(username, password)) {
      setUnlocked(true);
      setError(null);
      return;
    }
    setError("Usuário ou senha inválidos.");
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[#050B18] bg-cover bg-center px-6 py-12"
      style={{ backgroundImage: `url(${(background as { url: string }).url})` }}
    >
      <div className="absolute inset-0 bg-[#050B18]/70" aria-hidden />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl border border-[#D8B25A]/30 bg-[#050B18]/80 p-8 backdrop-blur-md"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D8B25A]/40 text-[#D8B25A]">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#D8B25A]">Projeto Atlas</p>
            <h1 className="text-lg font-semibold text-white">Ambiente de Homologação</h1>
          </div>
        </div>
        <label className="mb-4 block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-white/60">
            Usuário
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#D8B25A]"
          />
        </label>
        <label className="mb-5 block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-white/60">
            Senha
          </span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white outline-none focus:border-[#D8B25A]"
          />
        </label>
        {error ? <p className="mb-4 text-xs text-red-300">{error}</p> : null}
        <button
          type="submit"
          className="h-11 w-full rounded-lg bg-[#D8B25A] text-sm font-semibold uppercase tracking-[0.2em] text-[#050B18] transition hover:opacity-90"
        >
          Entrar
        </button>
        <p className="mt-5 text-[11px] leading-relaxed text-white/45">
          Esta autenticação protege apenas o ambiente de homologação. Os acessos do CRM, da Central
          Administrativa e do Portal do Investidor permanecem inalterados.
        </p>
      </form>
    </div>
  );
}