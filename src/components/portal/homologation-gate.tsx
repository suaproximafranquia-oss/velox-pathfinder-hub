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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050B18]">
      {/* Arte institucional preservada por inteiro (sem corte, sem zoom). */}
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${(background as { url: string }).url})` }}
        aria-hidden
      />
      {/* Apenas um leve escurecimento — a arte continua legível. */}
      <div className="absolute inset-0 bg-[#050B18]/35" aria-hidden />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12 lg:justify-end lg:pr-[7%]">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-[#D8B25A]/35 bg-[#050B18]/75 p-10 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur-[2px]"
      >
        <div className="mb-8 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-[#D8B25A]/40 text-[#D8B25A]">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#D8B25A]">Projeto Atlas</p>
            <h1 className="text-xl font-semibold text-white">Ambiente de Homologação</h1>
          </div>
        </div>
        <label className="mb-5 block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/60">
            Usuário
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="h-14 w-full rounded-lg border border-white/15 bg-white/5 px-4 text-base text-white outline-none focus:border-[#D8B25A]"
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/60">
            Senha
          </span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="h-14 w-full rounded-lg border border-white/15 bg-white/5 px-4 text-base text-white outline-none focus:border-[#D8B25A]"
          />
        </label>
        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          className="h-14 w-full rounded-lg bg-[#D8B25A] text-base font-semibold uppercase tracking-[0.2em] text-[#050B18] transition hover:opacity-90"
        >
          Entrar
        </button>
        <p className="mt-6 text-xs leading-relaxed text-white/50">
          Esta autenticação protege apenas o ambiente de homologação. Os acessos do CRM, da Central
          Administrativa e do Portal do Investidor permanecem inalterados.
        </p>
      </form>
      </div>
    </div>
  );
}