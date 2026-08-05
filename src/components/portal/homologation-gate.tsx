/**
 * Tela de Proteção do ambiente de homologação (Etapa 2 §8).
 *
 * Envolve toda a aplicação. Enquanto o acesso não é liberado, nenhuma
 * rota é renderizada. Após autenticar, a sessão permanece ativa no
 * navegador e a experiência segue exatamente como antes.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
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

  const bgUrl = (background as { url: string }).url;

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#050B18]">
      {/* Landing Page institucional: a própria arte é a interface de acesso. */}
      <div
        className="relative w-full max-w-[min(100vw,150vh)]"
        style={{ aspectRatio: "1536 / 1024" }}
      >
        <img
          src={bgUrl}
          alt="Projeto Atlas — Ambiente Seguro de Homologação, Corporate Workspace"
          className="absolute inset-0 h-full w-full object-contain"
        />

        <form onSubmit={submit} className="absolute inset-0">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            aria-label="Usuário"
            placeholder="Usuário"
            className="absolute border-0 text-[#EFE3C4] outline-none placeholder:text-[#8C93A1]"
            style={{
              left: "24%",
              top: "53.8%",
              width: "22.6%",
              height: "4.5%",
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
            className="absolute border-0 text-[#EFE3C4] outline-none placeholder:text-[#8C93A1]"
            style={{
              left: "24%",
              top: "61.2%",
              width: "22.6%",
              height: "4.5%",
              background: "#070C12",
              fontSize: "clamp(11px, 1.15vw, 17px)",
            }}
          />
          <button
            type="submit"
            aria-label="Entrar"
            className="absolute rounded-[10px] bg-transparent text-transparent transition hover:bg-white/10"
            style={{ left: "19.1%", top: "68.2%", width: "29%", height: "5.6%" }}
          >
            Entrar
          </button>
          {error ? (
            <p
              className="absolute text-center text-red-300"
              style={{
                left: "19.1%",
                top: "74.6%",
                width: "29%",
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
