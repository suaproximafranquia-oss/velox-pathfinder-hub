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
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            aria-label="Usuário"
            placeholder="Usuário"
            className="absolute border-0 bg-[#070C12] bg-[length:1em_1em] bg-[position:0.75em_center] bg-no-repeat pl-[2.35em] pr-[0.7em] text-[#EFE3C4] outline-none focus:outline-none focus-visible:outline-none placeholder:text-[#8C93A1]"
            style={{
              left: "27.6%",
              top: "52.2%",
              width: "17.4%",
              height: "5%",
              fontSize: "clamp(11px, 1.15vw, 17px)",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21a8 8 0 0 0-16 0'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E\")",
            }}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            aria-label="Senha"
            placeholder="Senha"
            className="absolute border-0 bg-[#070C12] bg-[length:1em_1em] bg-[position:0.75em_center] bg-no-repeat pl-[2.35em] pr-[0.7em] text-[#EFE3C4] outline-none focus:outline-none focus-visible:outline-none placeholder:text-[#8C93A1]"
            style={{
              left: "27.6%",
              top: "59.5%",
              width: "17.4%",
              height: "5%",
              fontSize: "clamp(11px, 1.15vw, 17px)",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='11' x='3' y='11' rx='2' ry='2'/%3E%3Cpath d='M7 11V7a5 5 0 0 1 10 0v4'/%3E%3C/svg%3E\")",
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
