import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Compass, Building2, BookMarked, Users, Calculator, ArrowUpRight, X } from "lucide-react";
import { SimulatorModal } from "@/components/simulator/simulator-modal";
import heroImg from "@/assets/velox-sede-hero.png.asset.json";
import manualCoverImg from "@/assets/portal-manual-cover.png.asset.json";
import materialInstitucionalImg from "@/assets/portal-material-institucional.png.asset.json";
import sedeFachadaImg from "@/assets/portal-sede-fachada.png.asset.json";
import revistaImg from "@/assets/portal-revista-velox.png.asset.json";
import experienciasImg from "@/assets/portal-experiencias.png.asset.json";
import simuladorImg from "@/assets/portal-simulador.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal Velox — Ecossistema institucional Velox Soluções Financeiras" },
      {
        name: "description",
        content:
          "Portal Velox: a porta de entrada do ecossistema Velox — Manual do Investidor, Universo Velox, Nossa Sede, Notícias, Experiências e Área Executiva em uma única plataforma.",
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
  panelSrc?: string;
  href?: string;
  cta: string;
  status: "aberto" | "em-preparacao" | "em-desenvolvimento";
  action?: "simulator";
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
    panelSrc: "/manual",
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
    panelSrc: "/universo",
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
    cta: "Iniciar simulação",
    status: "aberto",
    action: "simulator",
  },
  {
    key: "sede",
    eyebrow: "Módulo IV",
    title: "Nossa Sede",
    description:
      "Um convite para conhecer, em imagens e vídeo, a sede da Velox e as unidades que sustentam a rede em todo o país.",
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
  const [openPanel, setOpenPanel] = useState<{ src: string; title: string } | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  useEffect(() => {
    if (!openPanel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenPanel(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [openPanel]);

  return (
    <div className="min-h-screen">
      <PortalHeader />
      <main>
        <Hero />
        <ModulesGrid
          onOpen={(m) => {
            if (m.action === "simulator") setSimulatorOpen(true);
            else if (m.panelSrc) setOpenPanel({ src: m.panelSrc, title: m.title });
          }}
        />
      </main>
      <PortalFooter />
      <ModulePanel panel={openPanel} onClose={() => setOpenPanel(null)} />
      <SimulatorModal open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </div>
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
          className="h-full w-full object-cover portal-hero-ken"
        />
        {/* Camadas editoriais: profundidade, iluminação e vinheta */}
        {/* Overlay institucional Velox — degradê navy + toque quente para leitura sem esconder a foto */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--brand-blue-deep) 62%, transparent) 0%, color-mix(in oklab, var(--brand-blue-deep) 48%, transparent) 45%, color-mix(in oklab, var(--brand-blue-deep) 55%, transparent) 78%, color-mix(in oklab, var(--brand-blue-deep) 78%, transparent) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(75% 70% at 15% 62%, color-mix(in oklab, var(--ink) 62%, transparent), transparent 75%), radial-gradient(55% 55% at 92% 18%, color-mix(in oklab, var(--brand-orange) 14%, transparent), transparent 65%)",
          }}
        />
        {/* Faixa de continuidade — funde a base do Hero com o fundo institucional da Home */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, color-mix(in oklab, var(--brand-blue-deep) 40%, transparent) 55%, var(--paper) 100%)",
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
            O Portal Velox reúne, em um só lugar, o Manual do Investidor,
            o Universo institucional, nossa sede, comunicados e experiências
            da rede — uma recepção editorial construída para franqueados,
            investidores e parceiros.
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

function ModulesGrid({ onOpen }: { onOpen: (m: ModuleCard) => void }) {
  return (
    <section id="modulos" className="relative border-b" style={{ borderColor: "var(--paper-edge)" }}>
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="portal-eyebrow">Sumário do Portal</span>
            <h2 className="portal-serif mt-3 text-4xl md:text-5xl">Por onde você quer começar.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Reunimos aqui as diferentes portas de entrada do universo Velox.
            Escolha o que faz sentido para o seu momento — cada espaço foi
            pensado para receber você com clareza e sem pressa.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <ModuleTile key={m.key} module={m} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleTile({ module: m, onOpen }: { module: ModuleCard; onOpen: (m: ModuleCard) => void }) {
  const Icon = m.icon;
  const badge =
    m.status === "em-preparacao" ? "Em preparação" :
    m.status === "em-desenvolvimento" ? "Em desenvolvimento" :
    null;
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
          <span
            className="portal-eyebrow"
            style={{ color: "var(--paper)" }}
          >
            {m.eyebrow}
          </span>
          {badge && (
            <span
              className="border px-2 py-1 text-[10px] uppercase tracking-[0.22em]"
              style={{ borderColor: "color-mix(in oklab, var(--paper) 40%, transparent)", color: "var(--paper)" }}
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
          <span className="text-xs uppercase tracking-[0.22em]" style={{ color: m.status === "aberto" ? "var(--brand-blue-deep)" : "var(--muted-foreground)" }}>
            {m.cta}
          </span>
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ color: m.status === "aberto" ? "var(--brand-orange)" : "var(--muted-foreground)" }}
          />
        </div>
      </div>
    </article>
  );

  if (m.panelSrc) {
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
  if (m.action) {
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
  return (
    <div
      className={
        "fixed inset-0 z-[70] transition-opacity duration-500 " +
        (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
      }
      aria-hidden={!open}
    >
      {/* Backdrop com blur — mantém o Portal visível ao fundo */}
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: "color-mix(in oklab, var(--ink) 55%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      />
      {/* Painel central ~94% da tela */}
      <div
        className={
          "absolute inset-x-[3vw] top-[3vh] bottom-[3vh] overflow-hidden rounded-2xl border shadow-2xl transition-all duration-500 " +
          (open ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.98] opacity-0")
        }
        style={{
          borderColor: "color-mix(in oklab, var(--paper) 25%, transparent)",
          background: "var(--paper)",
          boxShadow: "0 60px 120px -30px color-mix(in oklab, var(--ink) 70%, transparent)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={panel?.title ?? ""}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition hover:scale-105"
          style={{
            borderColor: "color-mix(in oklab, var(--paper) 40%, transparent)",
            background: "color-mix(in oklab, var(--ink) 55%, transparent)",
            color: "var(--paper)",
          }}
        >
          <X className="h-5 w-5" />
        </button>
        {panel && (
          <iframe
            key={panel.src}
            src={panel.src}
            title={panel.title}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
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