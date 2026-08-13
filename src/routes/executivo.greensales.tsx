/**
 * POC GreenSales — teste técnico de incorporação.
 *
 * Objetivo único desta etapa: verificar se o ambiente de login do
 * GreenSales pode ser carregado dentro do Portal. Nenhuma automação,
 * captura, OCR, importação de Lead ou armazenamento de credencial é
 * implementado aqui — e nenhuma proteção do GreenSales é contornada.
 *
 * Arquitetura FUTURA (documentada, não implementada):
 *   GreenSales → sessão autorizada → navegador automatizado no servidor
 *   → CRM → aba "Novos" → identificação do Lead → visualização →
 *   captura → extração → Portal Velox → Lead criado/atualizado.
 * O módulo futuro será exclusivo do Administrador e qualquer credencial
 * será criptografada, nunca exibida em log, texto puro ou frontend.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, ShieldAlert, Sprout } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";

const TARGET = "https://adm.greennsales.com.br/adm/login";

export const Route = createFileRoute("/executivo/greensales")({
  head: () => ({
    meta: [
      { title: "POC GreenSales — Atlas Platform" },
      {
        name: "description",
        content:
          "Teste técnico e temporário de incorporação do ambiente GreenSales dentro do Portal Velox.",
      },
      { property: "og:title", content: "POC GreenSales — Atlas Platform" },
      {
        property: "og:description",
        content: "Validação de carregamento do ambiente GreenSales dentro do Portal Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GreenSalesPoc,
});

type Status = "carregando" | "carregado" | "bloqueado";

function GreenSalesPoc() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [status, setStatus] = useState<Status>("carregando");
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      void navigate({ to: "/entrar" });
      return;
    }
    if (current.activeRole !== "super_admin") {
      void navigate({ to: "/executivo/home" });
      return;
    }
    setSession(current);
  }, [navigate]);

  // Quando o destino bloqueia a incorporação, o navegador não dispara
  // `load` com conteúdo utilizável. A janela de espera evita concluir o
  // teste antes da resposta real do servidor remoto.
  useEffect(() => {
    setStatus("carregando");
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === "carregando" ? "bloqueado" : s));
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session}>
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Sprout className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">GreenSales</h1>
              <p className="text-sm text-muted-foreground">
                Teste técnico temporário de incorporação. Nenhuma automação, captura ou
                credencial é utilizada nesta etapa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAttempt((v) => v + 1)}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" /> Repetir teste
            </button>
            <a
              href={TARGET}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <ExternalLink className="h-4 w-4" /> Abrir em nova aba
            </a>
          </div>
        </header>

        <div
          className={
            status === "carregado"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm"
              : status === "bloqueado"
                ? "rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm"
                : "rounded-xl border px-4 py-3 text-sm text-muted-foreground"
          }
        >
          {status === "carregando" && "Testando o carregamento do ambiente GreenSales…"}
          {status === "carregado" && "POC GreenSales — carregamento confirmado."}
          {status === "bloqueado" && (
            <span className="inline-flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Teste de incorporação não foi possível: o ambiente GreenSales não respondeu
              dentro do Portal (política de segurança do site de origem). Nenhuma proteção
              foi contornada — use “Abrir em nova aba”.
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-background">
          <iframe
            key={attempt}
            ref={frame}
            title="Ambiente GreenSales"
            src={TARGET}
            onLoad={() => setStatus("carregado")}
            referrerPolicy="no-referrer"
            className="h-[70vh] w-full"
          />
        </div>
      </div>
    </ExecutiveShell>
  );
}
