/**
 * Tela de Proteção do ambiente de homologação (Etapa 2 §8).
 *
 * Envolve toda a aplicação. Enquanto o acesso não é liberado, nenhuma
 * rota é renderizada. Após autenticar, a sessão permanece ativa no
 * navegador e a experiência segue exatamente como antes.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import background from "@/assets/atlas-homologacao-bg-wide.png.asset.json";
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

  const bgUrl = (background as { url: string }).url;

  return (
    <div className="relative flex h-screen min-h-screen w-full items-center justify-center overflow-hidden bg-[#050B18]">
      {/* Landing Page institucional: a própria arte é a interface de acesso.
          A arte cobre 100% da viewport (comportamento cover), sem faixas laterais. */}
      <div
        className="relative"
        style={{
          width: "max(100vw, calc(100vh * 1831 / 859))",
          height: "max(100vh, calc(100vw * 859 / 1831))",
        }}
      >
        <img
          src={bgUrl}
          alt="Projeto Atlas — Ambiente Seguro de Homologação, Corporate Workspace"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <form onSubmit={submit} className="absolute inset-0">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            aria-label="Usuário"
            placeholder="Usuário"
            className="absolute border-0 text-[#EFE3C4] outline-none focus:outline-none focus-visible:outline-none placeholder:text-[#8C93A1]"
            style={{
              left: "27.6%",
              top: "52.2%",
              width: "17.4%",
              height: "5%",
              background: "#070C12",
              fontSize: "clamp(11px, 1.15vw, 17px)",
            }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            aria-label="Senha"
            placeholder="Senha"
            className="absolute border-0 text-[#EFE3C4] outline-none focus:outline-none focus-visible:outline-none placeholder:text-[#8C93A1]"
            style={{
              left: "27.6%",
              top: "59.5%",
              width: "17.4%",
              height: "5%",
              background: "#070C12",
              fontSize: "clamp(11px, 1.15vw, 17px)",
            }}
          />
          <button
            type="submit"
            aria-label="Entrar"
            className="absolute rounded-[10px] bg-transparent text-transparent transition hover:bg-white/10"
            style={{ left: "26.8%", top: "66.1%", width: "19%", height: "5.7%" }}
          >
            Entrar
          </button>
          {error ? (
            <p
              className="absolute text-center text-red-300"
              style={{
                left: "26.8%",
                top: "78%",
                width: "19%",
                fontSize: "clamp(10px, 0.95vw, 14px)",
              }}
            >
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
