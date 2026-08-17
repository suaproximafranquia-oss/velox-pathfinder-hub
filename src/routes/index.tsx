import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  Building2,
  BookMarked,
  Users,
  Calculator,
  ArrowUpRight,
  ArrowRight,
  Loader2,
} from "lucide-react";
// Overlays pesados (Simulador e Identificação) saem do pacote inicial da
// Home: o navegador baixa o Hero primeiro e busca estes módulos em segundo
// plano, assim que a página fica ociosa. Comportamento idêntico ao anterior.
const SimulatorModal = lazy(() =>
  import("@/components/simulator/simulator-modal").then((m) => ({ default: m.SimulatorModal })),
);
const GatewayOverlay = lazy(() =>
  import("@/components/portal/gateway-overlay").then((m) => ({ default: m.GatewayOverlay })),
);
const PhoneRegistryOverlay = lazy(() =>
  import("@/components/portal/phone-registry-overlay").then((m) => ({
    default: m.PhoneRegistryOverlay,
  })),
);
import heroImg from "@/assets/velox-sede-hero.png.asset.json";
import manualCoverImg from "@/assets/portal-manual-cover.png.asset.json";
import materialInstitucionalImg from "@/assets/portal-material-institucional.png.asset.json";
import sedeFachadaImg from "@/assets/portal-sede-fachada.png.asset.json";
import revistaImg from "@/assets/portal-revista-velox.png.asset.json";
import experienciasImg from "@/assets/portal-experiencias.png.asset.json";
import simuladorImg from "@/assets/portal-simulador.jpg.asset.json";
import {
  hasPortalSession,
  setJourneyStatus,
  trackSessionNavigation,
  getResumePoint,
  getPortalSession,
  promotePortalSession,
} from "@/lib/portal-session";
import { isPortalUnlocked } from "@/lib/portal-verification";
import { loadLeads } from "@/lib/leads";
import { getDigitalJourney } from "@/lib/portal-journey";

/**
 * WhatsApp informado no Gateway — usado apenas para a confirmação.
 * Durante a Jornada Digital não existe Lead: o número vem da jornada.
 */
function sessionPhone(investorId: string | null | undefined): string {
  if (!investorId) return "";
  return (
    loadLeads().find((lead) => lead.id === investorId)?.whatsapp ??
    getDigitalJourney()?.phone ??
    ""
  );
}
import { PortalOverlayShell } from "@/components/portal/portal-overlay-shell";
import { InvestorNewsFeed } from "@/components/portal/investor-news-feed";
import { readEntryContext, writeEntryContext } from "@/lib/portal-entry";
import { getPortalModule, type PortalModuleKey } from "@/lib/portal-modules";
import { setActiveOverlay } from "@/lib/portal-overlay";
import { setResponsibleExecutiveSlug } from "@/lib/responsible-executive";
import { clearResponsibleExecutive } from "@/lib/responsible-executive";

type HomeSearch = {
  /** Executivo responsável (link personalizado). */
  e?: string;
  /** Módulo a abrir sobre a Home após o Gateway. */
  m?: string;
  /** Origem da visita. */
  o?: string;
  /** Unidade. */
  u?: string;
  /** Campanha. */
  c?: string;
  /** Marca/operação de origem (`financeira`, `solar`, `seguros`). */
  b?: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    e: str(search.e),
    m: str(search.m),
    o: str(search.o),
    u: str(search.u),
    c: str(search.c),
    b: str(search.b),
  }),
  head: () => ({
    meta: [
      { title: "Portal Velox — Ecossistema institucional Velox Soluções Financeiras" },
      {
        name: "description",
        content:
          "Portal Velox: a porta de entrada do ecossistema Velox — Manual do Investidor, Universo Velox, Nossa Estrutura, Notícias, Experiências e Área Executiva em uma única plataforma.",
      },
      { property: "og:title", content: "Portal Velox — Ecossistema institucional" },
      {
        property: "og:description",
        content:
          "Recepção institucional da Velox Soluções Financeiras. Conheça o Manual do Investidor, o Universo Velox, nossa sede, notícias e experiências.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: heroImg.url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: heroImg.url },
    ],
    links: [{ rel: "preload", as: "image", href: heroImg.url }],
  }),
  component: PortalHome,
});

type ModuleCard = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  cover: string;
  /** Módulo interno correspondente no registro oficial do Portal. */
  moduleKey?: PortalModuleKey;
  href?: string;
  cta: string;
  status: "aberto" | "em-preparacao" | "em-desenvolvimento";
};

const MODULES: ModuleCard[] = [
  {
    key: "manual",
    eyebrow: "Módulo I",
    title: "Manual do Investidor",
    description:
      "Uma leitura editorial, em treze capítulos, sobre a franquia Velox, seus valores e o modelo de negócio — no ritmo do leitor, sem pressão comercial.",
    icon: BookOpen,
    cover: manualCoverImg.url,
    moduleKey: "manual",
    cta: "Iniciar a leitura",
    status: "aberto",
  },
  {
    key: "universo",
    eyebrow: "Módulo II",
    title: "Material Institucional de Apresentação",
    description:
      "Apresentação institucional completa da Velox: história, modelo de negócio, ecossistema de soluções, parceiros e frentes especializadas em todo o Brasil.",
    icon: Compass,
    cover: materialInstitucionalImg.url,
    moduleKey: "universo",
    cta: "Iniciar leitura",
    status: "aberto",
  },
  {
    key: "modulo-vi",
    eyebrow: "Módulo III",
    title: "Simulador Inteligente de Potencial de Receita",
    description:
      "Monte diferentes cenários comerciais e descubra uma estimativa do potencial de receita da sua futura operação.",
    icon: Calculator,
    cover: simuladorImg.url,
    moduleKey: "simulador",
    cta: "Iniciar simulação",
    status: "aberto",
  },
  {
    key: "sede",
    eyebrow: "Módulo IV",
    title: "Nossa Estrutura",
    description:
      "Um panorama institucional da Velox: a matriz, os bastidores, os vídeos e as unidades da rede que sustentam nossa operação em todo o país.",
    icon: Building2,
    cover: sedeFachadaImg.url,
    cta: "Em breve",
    status: "em-preparacao",
  },
  {
    key: "revista",
    eyebrow: "Módulo V",
    title: "Revista Velox",
    description:
      "Notícias, comunicados, conteúdos institucionais e novidades da rede reunidos em uma publicação viva do universo Velox.",
    icon: BookMarked,
    cover: revistaImg.url,
    cta: "Em breve",
    status: "em-preparacao",
  },
  {
    key: "cultura",
    eyebrow: "Módulo VI",
    title: "Cultura Velox",
    description:
      "As pessoas, os encontros e os momentos que constroem a identidade da Velox e a jornada de quem faz parte da rede.",
    icon: Users,
    cover: experienciasImg.url,
    cta: "Em breve",
    status: "em-preparacao",
  },
];

function PortalHome() {
  const navigate = useNavigate();
  const search = Route.useSearch() as HomeSearch;
  /** Único overlay ativo por vez — regra oficial do Portal. */
  const [active, setActive] = useState<{
    key: "gateway" | PortalModuleKey;
    title: string;
    src?: string;
  } | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [resume, setResume] = useState<{ module: PortalModuleKey; title: string } | null>(null);
  /** Overlays secundários entram em cena assim que a Home fica ociosa. */
  const [overlaysReady, setOverlaysReady] = useState(false);
  /**
   * COMANDO 4E §24/§30 — a identificação cadastral libera o Portal
   * imediatamente. A segunda tela existe apenas para conferência do
   * número em entradas institucionais e nunca bloqueia o acesso.
   */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const refreshUnlocked = useCallback(() => {
    setUnlocked(isPortalUnlocked(getPortalSession()?.investorId ?? null));
  }, []);

  useEffect(() => {
    refreshUnlocked();
  }, [refreshUnlocked]);

  /**
   * A liberação do Portal vive no servidor. Consultamos ao abrir, ao
   * voltar para a aba e em intervalos curtos: se o Executivo liberar o
   * acesso pelo CRM, o bloqueio some sozinho — sem F5, sem novo login.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let alive = true;
    const sync = async () => {
      const id = getPortalSession()?.investorId ?? null;
      if (!id) return;
      const { refreshPortalAccess } = await import("@/lib/portal-access");
      await refreshPortalAccess(id, { force: true });
      if (!alive) return;
      refreshUnlocked();
      if (isPortalUnlocked(id)) setConfirmOpen(false);
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 20_000);
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshUnlocked]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => setOverlaysReady(true), { timeout: 2000 })
      : window.setTimeout(() => setOverlaysReady(true), 600);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, []);

  const closeActive = useCallback(() => {
    setActive(null);
    setActiveOverlay(null);
    // Continuidade: ao voltar para a Home, o último módulo fica disponível
    // para retomada imediata.
    const point = getResumePoint();
    const mod = getPortalModule(point?.module);
    setResume(mod ? { module: mod.key, title: mod.title } : null);
  }, []);

  /** Abre um módulo interno como overlay — a URL permanece na Home. */
  const openModule = useCallback((key: PortalModuleKey) => {
    const mod = getPortalModule(key);
    if (!mod) return;
    const investorId = getPortalSession()?.investorId ?? null;
    // Bloqueio oficial: qualquer módulo diferente do Manual exige a
    // confirmação do WhatsApp.
    if (key !== "manual" && !isPortalUnlocked(investorId)) {
      // Antes de bloquear, confirmamos com o servidor: a liberação pode
      // ter sido concedida agora mesmo em outro dispositivo.
      void (async () => {
        const { refreshPortalAccess } = await import("@/lib/portal-access");
        await refreshPortalAccess(investorId, { force: true });
        if (isPortalUnlocked(investorId)) {
          setUnlocked(true);
          writeEntryContext({ pendingModule: null });
          setActive({ key, title: mod.title, src: mod.panelSrc });
          setActiveOverlay(key);
          setJourneyStatus(key === "simulador" ? "simulador" : "portal");
          trackSessionNavigation(key, mod.title);
          return;
        }
        writeEntryContext({ pendingModule: key });
        setActive(null);
        setActiveOverlay(null);
        setConfirmOpen(true);
      })();
      return;
    }
    writeEntryContext({ pendingModule: null });
    setActive({ key, title: mod.title, src: mod.panelSrc });
    setActiveOverlay(key);
    setJourneyStatus(key === "simulador" ? "simulador" : key === "manual" ? "manual" : "portal");
    trackSessionNavigation(key, mod.title);
  }, []);

  /** Abre o Gateway encerrando qualquer outro overlay ativo. */
  const openGateway = useCallback((title: string | null) => {
    setPendingTitle(title);
    setActive({ key: "gateway", title: "Identificação do investidor" });
    setActiveOverlay("gateway");
  }, []);

  /**
   * Contexto de entrada (link personalizado, campanha, QR Code ou rota
   * interna acessada diretamente): apenas define contexto e módulo
   * pendente — nunca navegação. Em seguida a URL volta a ser a Home.
   */
  useEffect(() => {
    const hasParams = Boolean(search.e || search.m || search.o || search.u || search.c || search.b);
    if (hasParams) {
      const ctx = writeEntryContext({
        executiveSlug: search.e ?? readEntryContext().executiveSlug,
        unit: search.u ?? readEntryContext().unit,
        origin: search.o ?? readEntryContext().origin,
        campaign: search.c ?? readEntryContext().campaign,
        brand: search.b ?? readEntryContext().brand,
        pendingModule: (getPortalModule(search.m)?.key ??
          (search.e ? "manual" : null)) as PortalModuleKey | null,
      });
      if (ctx.executiveSlug) setResponsibleExecutiveSlug(ctx.executiveSlug);
      // Campanhas patrocinadas não são personalizadas: o lead pertence ao
      // Executivo Padrão do workspace.
      if (ctx.campaign === "anuncio" && !search.e) clearResponsibleExecutive();
      navigate({ to: "/", search: {}, replace: true });
      return;
    }

    const ctx = readEntryContext();
    if (!ctx.pendingModule) return;
    if (hasPortalSession()) {
      openModule(ctx.pendingModule);
    } else {
      openGateway(getPortalModule(ctx.pendingModule)?.title ?? null);
    }
  }, [navigate, openGateway, openModule, search]);

  /** Continuidade: retoma o contexto da jornada anterior. */
  useEffect(() => {
    if (!hasPortalSession()) return;
    const point = getResumePoint();
    const mod = getPortalModule(point?.module);
    if (mod) setResume({ module: mod.key, title: mod.title });
  }, []);

  // Ao desmontar a Home, nenhum overlay pode permanecer registrado.
  useEffect(() => () => setActiveOverlay(null), []);

  return (
    <div className="min-h-screen">
      <PortalHeader />
      <main>
        <Hero />
        {resume && !active && (
          <ResumeBanner
            title={resume.title}
            onResume={() => openModule(resume.module)}
            onDismiss={() => setResume(null)}
          />
        )}
        <ModulesGrid
          unlocked={unlocked}
          onOpen={(m) => {
            const mod = getPortalModule(m.moduleKey);
            if (!mod) return;
            if (!hasPortalSession()) {
              writeEntryContext({ pendingModule: mod.key });
              openGateway(mod.title);
              return;
            }
            openModule(mod.key);
          }}
        />
        <InvestorNewsFeed />
      </main>
      <PortalFooter />
      <ModulePanel
        panel={active?.src ? { src: active.src, title: active.title } : null}
        onClose={closeActive}
      />
      <Suspense fallback={null}>
        {(overlaysReady || active?.key === "simulador") && (
          <SimulatorModal open={active?.key === "simulador"} onClose={closeActive} />
        )}
        {(overlaysReady || active?.key === "gateway") && (
          <GatewayOverlay
            open={active?.key === "gateway"}
            moduleTitle={pendingTitle}
            onClose={() => {
              closeActive();
              writeEntryContext({ pendingModule: null });
            }}
            onDone={() => {
              const pending = readEntryContext().pendingModule ?? "manual";
              refreshUnlocked();
              openModule(pending);
            }}
          />
        )}
        {confirmOpen && (
          <PhoneRegistryOverlay
            open={confirmOpen}
            investorId={getPortalSession()?.investorId ?? ""}
            investorName={getPortalSession()?.name ?? "Visitante"}
            phone={sessionPhone(getPortalSession()?.investorId)}
            onClose={() => {
              setConfirmOpen(false);
              writeEntryContext({ pendingModule: null });
            }}
            onContinue={() => {
              setConfirmOpen(false);
              // O relacionamento comercial nasce com a identificação.
              promotePortalSession();
              setUnlocked(true);
              const pending = readEntryContext().pendingModule;
              if (pending) openModule(pending);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

function ResumeBanner({
  title,
  onResume,
  onDismiss,
}: {
  title: string;
  onResume: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="border-b" style={{ borderColor: "var(--paper-edge)" }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10">
        <p className="text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          <span className="portal-eyebrow mr-3">Continuar jornada</span>
          Você estava em <strong className="font-medium">{title}</strong>.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
            style={{ background: "var(--brand-orange)", color: "#fff" }}
          >
            Retomar
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]"
          >
            Agora não
          </button>
        </div>
      </div>
    </section>
  );
}

function PortalHeader() {
  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-7xl items-center px-6 py-6 md:px-10">
        <Link to="/" className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center border portal-serif text-lg"
            style={{ borderColor: "var(--brand-orange)", color: "var(--brand-orange)" }}
          >
            V
          </span>
          <span className="flex flex-col leading-tight">
            <span className="portal-eyebrow">Velox</span>
            <span className="portal-serif text-lg">Portal Velox</span>
          </span>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden -mt-[88px]">
      {/* Fotografia institucional como cenário integral */}
      <div aria-hidden className="absolute inset-0">
        <img
          src={heroImg.url}
          alt=""
          fetchPriority="high"
          decoding="sync"
          className="h-full w-full object-cover portal-hero-ken"
          style={{ objectPosition: "46% 68%" }}
        />
        {/* Camadas editoriais: profundidade, iluminação e vinheta */}
        {/* Overlay institucional Velox — degradê navy + toque quente para leitura sem esconder a foto */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--brand-blue-deep) 34%, transparent) 0%, color-mix(in oklab, var(--brand-blue-deep) 26%, transparent) 45%, color-mix(in oklab, var(--brand-blue-deep) 32%, transparent) 78%, color-mix(in oklab, var(--brand-blue-deep) 62%, transparent) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(75% 70% at 15% 62%, color-mix(in oklab, var(--ink) 48%, transparent), transparent 75%), radial-gradient(55% 55% at 92% 18%, color-mix(in oklab, var(--brand-orange) 12%, transparent), transparent 65%)",
          }}
        />
        {/* Faixa de continuidade — funde a base do Hero com o fundo institucional da Home */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-56"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, color-mix(in oklab, var(--brand-blue-deep) 45%, transparent) 45%, color-mix(in oklab, var(--brand-blue-deep) 88%, transparent) 82%, var(--brand-blue-deep) 100%)",
          }}
        />
        <div aria-hidden className="absolute inset-0 portal-grid opacity-[0.08]" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-6 pb-24 pt-40 md:px-10 md:pb-32 md:pt-52 min-h-[92vh]">
        <div className="max-w-3xl">
          <div className="flex items-center gap-4">
            <span
              className="portal-rule"
              aria-hidden
              style={{ background: "var(--brand-orange)" }}
            />
            <span
              className="portal-eyebrow"
              style={{
                color: "rgba(255,255,255,0.95)",
                textShadow: "0 1px 2px rgba(6,12,28,0.35)",
              }}
            >
              Ecossistema Velox · Edição MMXXVI
            </span>
          </div>
          <h1
            className="portal-serif mt-8 text-balance"
            style={{
              fontSize: "clamp(3rem, 8vw, 7rem)",
              color: "#ffffff",
              textShadow:
                "0 2px 32px color-mix(in oklab, var(--ink) 45%, transparent), 0 1px 2px rgba(6,12,28,0.35)",
            }}
          >
            Portal <span style={{ color: "var(--brand-orange)" }}>Velox</span>.
          </h1>
          <p
            className="portal-serif mt-6 italic"
            style={{
              fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)",
              color: "rgba(255,255,255,0.98)",
              textShadow: "0 1px 2px rgba(6,12,28,0.35)",
            }}
          >
            Uma única plataforma para acessar tudo o que a Velox oferece.
          </p>
          <p
            className="mt-8 max-w-[56ch] text-base leading-relaxed md:text-lg"
            style={{
              color: "rgba(255,255,255,0.94)",
              textShadow: "0 1px 2px rgba(6,12,28,0.3)",
            }}
          >
            O Portal Velox reúne, em um só lugar, o Manual do Investidor, o Universo institucional,
            nossa sede, comunicados e experiências da rede — uma recepção editorial construída para
            franqueados, investidores e parceiros.
          </p>
        </div>

        {/* Rodapé editorial do Hero */}
        <div
          className="mt-20 flex flex-wrap items-end justify-between gap-6 border-t pt-6 text-[11px] uppercase tracking-[0.24em]"
          style={{
            borderColor: "rgba(255,255,255,0.32)",
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 1px 2px rgba(6,12,28,0.35)",
          }}
        >
          <span>Sede Velox · São José do Rio Preto · SP</span>
          <span className="hidden md:inline">Role para percorrer o Portal</span>
          <span aria-hidden className="portal-hero-scroll" />
        </div>
      </div>
    </section>
  );
}

function ModulesGrid({ onOpen, unlocked }: { onOpen: (m: ModuleCard) => void; unlocked: boolean }) {
  return (
    <section
      id="modulos"
      className="relative border-b"
      style={{ borderColor: "var(--paper-edge)" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="portal-eyebrow">Sumário do Portal</span>
            <h2 className="portal-serif mt-3 text-4xl md:text-5xl">Por onde você quer começar.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Reunimos aqui as diferentes portas de entrada do universo Velox. Escolha o que faz
            sentido para o seu momento — cada espaço foi pensado para receber você com clareza e sem
            pressa.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <ModuleTile
              key={m.key}
              module={m}
              onOpen={onOpen}
              locked={Boolean(m.moduleKey) && m.moduleKey !== "manual" && !unlocked}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleTile({
  module: m,
  onOpen,
  locked = false,
}: {
  module: ModuleCard;
  onOpen: (m: ModuleCard) => void;
  locked?: boolean;
}) {
  const Icon = m.icon;
  const badge = locked
    ? "Confirme seu WhatsApp"
    : m.status === "em-preparacao"
      ? "Em preparação"
      : m.status === "em-desenvolvimento"
        ? "Em desenvolvimento"
        : null;
  const inner = (
    <article className="portal-card group flex h-full flex-col">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={m.cover}
          alt=""
          aria-hidden
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, color-mix(in oklab, var(--graphite) 70%, transparent) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-3">
          <span className="portal-eyebrow" style={{ color: "var(--paper)" }}>
            {m.eyebrow}
          </span>
          {badge && (
            <span
              className="border px-2 py-1 text-[10px] uppercase tracking-[0.22em]"
              style={{
                borderColor: "color-mix(in oklab, var(--paper) 40%, transparent)",
                color: "var(--paper)",
              }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-6 py-6">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4" style={{ color: "var(--brand-orange)" }} />
          <h3 className="portal-serif text-2xl">{m.title}</h3>
        </div>
        <p className="text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          {m.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span
            className="text-xs uppercase tracking-[0.22em]"
            style={{
              color: m.status === "aberto" ? "var(--brand-blue-deep)" : "var(--muted-foreground)",
            }}
          >
            {m.cta}
          </span>
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{
              color: m.status === "aberto" ? "var(--brand-orange)" : "var(--muted-foreground)",
            }}
          />
        </div>
      </div>
    </article>
  );

  if (m.moduleKey) {
    return (
      <button
        type="button"
        onClick={() => onOpen(m)}
        aria-label={`Abrir ${m.title}`}
        className="block h-full w-full text-left focus:outline-none"
      >
        {inner}
      </button>
    );
  }
  if (m.href) {
    return (
      <a href={m.href} aria-label={m.title} className="block h-full focus:outline-none">
        {inner}
      </a>
    );
  }
  return (
    <div aria-label={m.title} className="block h-full opacity-95">
      {inner}
    </div>
  );
}

function ModulePanel({
  panel,
  onClose,
}: {
  panel: { src: string; title: string } | null;
  onClose: () => void;
}) {
  const open = Boolean(panel);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [panel?.src]);

  return (
    <PortalOverlayShell open={open} title={panel?.title ?? ""} onClose={onClose}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center gap-3 text-sm text-[color:var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando {panel?.title ?? "módulo"}...
        </div>
      )}
      {panel && (
        <iframe
          key={panel.src}
          src={panel.src}
          title={panel.title}
          onLoad={() => setLoaded(true)}
          className={
            "h-full w-full border-0 transition-opacity duration-500 " +
            (loaded ? "opacity-100" : "opacity-0")
          }
        />
      )}
    </PortalOverlayShell>
  );
}

function PortalFooter() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--paper-edge)" }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-xs text-[color:var(--muted-foreground)] md:flex-row md:items-center md:justify-between md:px-10">
        <span>© {new Date().getFullYear()} Velox Soluções Financeiras — Portal institucional.</span>
        <span className="portal-eyebrow">Powered by Atlas Platform</span>
      </div>
    </footer>
  );
}
