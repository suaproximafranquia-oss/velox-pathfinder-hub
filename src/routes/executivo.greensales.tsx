/**
 * POC GreenSales — incorporação e diagnóstico de renderização.
 *
 * Nenhuma automação, OCR, captura de tela, scraping, cópia de cookies,
 * token ou credencial é implementada aqui. O iframe usa apenas o
 * comportamento normal do navegador e a sessão do próprio usuário.
 *
 * DIAGNÓSTICO (rodada atual):
 * O GreenSales é um SPA Vue cujo layout do CRM é calculado em unidades de
 * viewport e posicionamento absoluto/fixo relativo à janela:
 *   .acoes  { position: fixed; height: 75px }
 *   .base   { position: absolute; top: 76px; height: calc(100vh - 76px) }
 *   .colx   { height: calc(100vh - 76px); overflow-y: hidden }
 *   .Menu   { position: fixed; height: 101vh }
 * Dentro de um iframe, `100vh` é a altura DO IFRAME — não a da janela do
 * Chrome. Com o iframe antigo (h-[70vh] dentro do container central de
 * 1152px do shell), a área útil das colunas ficava reduzida a poucas
 * dezenas de pixels depois de descontar barra de ações (75px), cabeçalho
 * da coluna (60px) e paginação: o container rolável existia (por isso a
 * barra de rolagem aparecia e crescia com o volume de dados), mas os
 * cards ficavam recortados por `overflow:hidden`, dando a impressão de
 * "área vazia". Os dados sempre chegaram (POST /lead/list 200).
 *
 * CORREÇÃO: o módulo passa a oferecer um viewport equivalente ao do
 * Chrome — modo Tela cheia (iframe = 100vw x 100vh, sem ancestrais que
 * recortem) e modo Ancorado em full-bleed com altura real da janela.
 * Opcionalmente aplica-se um viewport lógico maior com `zoom out` via
 * transform scale, sem tocar em nada do GreenSales.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldAlert,
  Sprout,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";

const ORIGIN = "https://adm.greennsales.com.br";
const TARGETS = [
  { key: "crm", label: "CRM /velox/crm/2", url: `${ORIGIN}/velox/crm/2` },
  { key: "login", label: "Login", url: `${ORIGIN}/adm/login` },
] as const;
const ZOOMS = [1, 0.9, 0.8, 0.67] as const;

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
  const [target, setTarget] = useState<(typeof TARGETS)[number]["key"]>("crm");
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [box, setBox] = useState({ w: 0, h: 0, winW: 0, winH: 0 });
  const frame = useRef<HTMLIFrameElement | null>(null);
  const holder = useRef<HTMLDivElement | null>(null);

  const targetUrl = TARGETS.find((t) => t.key === target)!.url;

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
  }, [attempt, target]);

  // Diagnóstico de dimensões. NÃO usa polling: um setInterval que chama
  // setState recria o objeto de estado a cada tick, re-renderiza o módulo e
  // reescreve o tamanho do iframe — era isso que fazia o SPA do GreenSales
  // recalcular layout continuamente ("piscando"). Agora só medimos em
  // eventos reais (resize da janela / mudança de modo) e apenas quando o
  // valor muda de fato.
  const measure = useCallback(() => {
    const r = holder.current?.getBoundingClientRect();
    const next = {
      w: Math.round(r?.width ?? 0),
      h: Math.round(r?.height ?? 0),
      winW: window.innerWidth,
      winH: window.innerHeight,
    };
    setBox((prev) =>
      prev.w === next.w && prev.h === next.h && prev.winW === next.winW && prev.winH === next.winH
        ? prev
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, fullscreen, session]);

  useEffect(() => {
    let raf = 0;
    function onResize() {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [measure]);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (!session) return null;

  // O iframe recebe um viewport lógico maior e é reduzido por scale,
  // mantendo 100% da área visível preenchida.
  const logicalW = box.w ? Math.round(box.w / zoom) : 0;
  const logicalH = box.h ? Math.round(box.h / zoom) : 0;

  // O iframe é único e vive sempre na MESMA posição da árvore React: alternar
  // tela cheia apenas troca classes do container, nunca desmonta o iframe.
  // A `key` muda somente quando o usuário pede Recarregar ou troca de destino.
  const iframeEl = (
    <iframe
      key={`${attempt}-${target}`}
      ref={frame}
      title="Ambiente GreenSales"
      src={targetUrl}
      onLoad={() => setStatus("carregado")}
      allow="clipboard-read; clipboard-write; fullscreen"
      style={{
        width: logicalW ? `${logicalW}px` : "100%",
        height: logicalH ? `${logicalH}px` : "100%",
        border: 0,
        transform: zoom === 1 ? undefined : `scale(${zoom})`,
        transformOrigin: "top left",
        display: "block",
      }}
    />
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-xl border">
        {TARGETS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTarget(t.key)}
            className={
              "px-3 py-2 text-xs cursor-pointer " +
              (t.key === target ? "bg-[color:var(--accent)]" : "opacity-70")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="inline-flex overflow-hidden rounded-xl border">
        {ZOOMS.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            title="Viewport lógico entregue ao GreenSales"
            className={
              "px-2.5 py-2 text-xs cursor-pointer " +
              (z === zoom ? "bg-[color:var(--accent)]" : "opacity-70")
            }
          >
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer"
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        {fullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
      </button>
      <button
        type="button"
        onClick={() => setAttempt((v) => v + 1)}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" /> Recarregar
      </button>
      <a
        href={targetUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
      >
        <ExternalLink className="h-4 w-4" /> Abrir direto (comparação)
      </a>
    </div>
  );

  const diagnostics = (
    <p className="text-[11px] text-muted-foreground">
      Janela do Chrome {box.winW}×{box.winH} · viewport entregue ao GreenSales{" "}
      {logicalW}×{logicalH} (100vh interno = {logicalH}px) · área visível {box.w}×{box.h}.
      Quanto maior a altura, mais cards do pipeline cabem — o CRM calcula as colunas em{" "}
      <code>calc(100vh - 76px)</code>.
    </p>
  );

  return (
    <ExecutiveShell session={session} title="GreenSales" fullBleed>
      <div
        className={cn(
          "space-y-4",
          fullscreen && "fixed inset-0 z-[200] flex flex-col gap-0 space-y-0 bg-background p-2",
        )}
      >
        <header
          className={cn(
            "flex flex-wrap items-center justify-between gap-3",
            fullscreen && "shrink-0 border-b pb-2",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Sprout className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">GreenSales</h1>
              <p className="text-sm text-muted-foreground">
                Incorporação técnica. Nenhuma automação, captura ou credencial é utilizada.
              </p>
            </div>
          </div>
          {controls}
        </header>

        <div
          className={
            fullscreen
              ? "hidden"
              : status === "carregado"
              ? "rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm"
              : status === "bloqueado"
                ? "rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm"
                : "rounded-xl border px-4 py-3 text-sm text-muted-foreground"
          }
        >
          {status === "carregando" && "Testando o carregamento do ambiente GreenSales…"}
          {status === "carregado" && (
            <span>
              Carregamento confirmado. Para o CRM, use <strong>Tela cheia</strong>: o
              GreenSales dimensiona o pipeline pela altura do iframe, não pela da janela.
            </span>
          )}
          {status === "bloqueado" && (
            <span className="inline-flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Teste de incorporação não foi possível: o ambiente GreenSales não respondeu
              dentro do Portal (política de segurança do site de origem). Nenhuma proteção
              foi contornada — use “Abrir direto”.
            </span>
          )}
        </div>

        <div
          ref={holder}
          className={cn(
            "relative overflow-hidden bg-background",
            fullscreen ? "min-h-0 flex-1" : "rounded-2xl border",
          )}
          style={fullscreen ? undefined : { height: "calc(100vh - 260px)", minHeight: 560 }}
        >
          {iframeEl}
        </div>
        <div className={fullscreen ? "shrink-0 border-t pt-1" : undefined}>{diagnostics}</div>
      </div>
    </ExecutiveShell>
  );
}
