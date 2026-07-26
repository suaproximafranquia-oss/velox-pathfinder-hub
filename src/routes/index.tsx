import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Compass, Building2, Newspaper, Sparkles, ShieldCheck, ArrowUpRight } from "lucide-react";
import heroImg from "@/assets/portal-hero.jpg.asset.json";
import executivosImg from "@/assets/portal-executivos.png.asset.json";
import sedeImg from "@/assets/portal-sede.jpg.asset.json";
import recepcaoImg from "@/assets/portal-recepcao.jpg.asset.json";
import experienciasImg from "@/assets/portal-experiencias.png.asset.json";
import fundadorImg from "@/assets/portal-fundador.png.asset.json";

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
  to?: string;
  href?: string;
  cta: string;
  status: "aberto" | "em-preparacao";
};

const MODULES: ModuleCard[] = [
  {
    key: "manual",
    eyebrow: "Módulo I",
    title: "Manual do Investidor",
    description:
      "Uma leitura editorial em 13 capítulos sobre a franquia Velox, seus valores e o modelo de negócio — sem pressão comercial.",
    icon: BookOpen,
    cover: recepcaoImg.url,
    to: "/manual",
    cta: "Iniciar a leitura",
    status: "aberto",
  },
  {
    key: "universo",
    eyebrow: "Módulo II",
    title: "Universo Velox",
    description:
      "O ecossistema de soluções, parceiros e frentes especializadas que compõem a operação Velox em todo o Brasil.",
    icon: Compass,
    cover: executivosImg.url,
    cta: "Em breve",
    status: "em-preparacao",
  },
  {
    key: "sede",
    eyebrow: "Módulo III",
    title: "Nossa Sede",
    description:
      "Um passeio institucional pela nossa sede, pelas unidades da rede e pela estrutura que sustenta cada franqueado.",
    icon: Building2,
    cover: sedeImg.url,
    cta: "Em breve",
    status: "em-preparacao",
  },
  {
    key: "noticias",
    eyebrow: "Módulo IV",
    title: "Notícias",
    description:
      "Comunicados institucionais, novidades da rede e movimentos relevantes do mercado financeiro para franqueados e investidores.",
    icon: Newspaper,
    cover: fundadorImg.url,
    cta: "Em breve",
    status: "em-preparacao",
  },
  {
    key: "experiencias",
    eyebrow: "Módulo V",
    title: "Experiências",
    description:
      "Encontros, treinamentos, celebrações e momentos que marcam a jornada dos franqueados dentro do ecossistema Velox.",
    icon: Sparkles,
    cover: experienciasImg.url,
    cta: "Em breve",
    status: "em-preparacao",
  },
];

function PortalHome() {
  return (
    <div className="min-h-screen">
      <PortalHeader />
      <main>
        <Hero />
        <ModulesGrid />
        <ClosingBand />
      </main>
      <PortalFooter />
    </div>
  );
}

function PortalHeader() {
  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
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
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#modulos" className="text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
            Módulos
          </a>
          <Link to="/manual" className="text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
            Manual
          </Link>
          <Link
            to="/executivo"
            className="inline-flex items-center gap-1.5 border px-4 py-2 text-xs uppercase tracking-[0.22em] transition-colors"
            style={{ borderColor: "var(--paper-edge)", color: "var(--foreground)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Área Executiva
          </Link>
        </nav>
        <Link
          to="/executivo"
          className="md:hidden inline-flex items-center gap-1.5 border px-3 py-2 text-[11px] uppercase tracking-[0.22em]"
          style={{ borderColor: "var(--paper-edge)" }}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Executivo
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 portal-grid opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-10 h-[36rem] w-[36rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "color-mix(in oklab, var(--brand-orange) 55%, transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-0 h-[32rem] w-[32rem] rounded-full opacity-25 blur-3xl"
        style={{ background: "color-mix(in oklab, var(--brand-blue) 55%, transparent)" }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 md:grid-cols-12 md:gap-16 md:px-10 md:pb-28 md:pt-24">
        <div className="md:col-span-7">
          <div className="flex items-center gap-4">
            <span className="portal-rule" aria-hidden />
            <span className="portal-eyebrow">Ecossistema Velox · Edição MMXXVI</span>
          </div>
          <h1
            className="portal-serif mt-8 text-balance"
            style={{ fontSize: "clamp(2.75rem, 7vw, 6rem)" }}
          >
            Portal <span style={{ color: "var(--brand-orange)" }}>Velox</span>.
          </h1>
          <p className="portal-serif mt-6 italic text-[color:var(--muted-foreground)]" style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)" }}>
            Uma única plataforma para acessar tudo o que a Velox oferece.
          </p>
          <p className="mt-8 max-w-[56ch] text-base leading-relaxed text-[color:var(--muted-foreground)] md:text-lg">
            O Portal Velox reúne, em um só lugar, o Manual do Investidor,
            o Universo institucional, nossa sede, comunicados e experiências
            da rede — além do acesso reservado à Área Executiva. Uma recepção
            editorial construída para franqueados, investidores e parceiros.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/manual"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm uppercase tracking-[0.2em] transition-transform hover:-translate-y-0.5"
              style={{
                background: "var(--brand-blue-deep)",
                color: "var(--primary-foreground)",
              }}
            >
              Ler o Manual do Investidor
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <a
              href="#modulos"
              className="inline-flex items-center gap-2 border px-6 py-3 text-sm uppercase tracking-[0.2em]"
              style={{ borderColor: "var(--paper-edge)" }}
            >
              Explorar módulos
            </a>
          </div>
        </div>

        <div className="md:col-span-5">
          <figure
            className="relative overflow-hidden border"
            style={{
              borderColor: "var(--paper-edge)",
              boxShadow: "0 40px 90px -32px color-mix(in oklab, var(--ink) 55%, transparent)",
            }}
          >
            <img
              src={heroImg.url}
              alt="Sede institucional Velox Soluções Financeiras"
              className="h-full w-full object-cover"
            />
            <figcaption
              className="absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-3 text-[11px] uppercase tracking-[0.24em]"
              style={{ background: "color-mix(in oklab, var(--graphite) 78%, transparent)", color: "var(--paper)" }}
            >
              <span>Sede Velox</span>
              <span>São José do Rio Preto · SP</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function ModulesGrid() {
  return (
    <section id="modulos" className="relative border-y" style={{ borderColor: "var(--paper-edge)" }}>
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="portal-eyebrow">Sumário do Portal</span>
            <h2 className="portal-serif mt-3 text-4xl md:text-5xl">Módulos do ecossistema Velox.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            Cada módulo é uma frente institucional independente. O Portal
            garante que todos convivam em uma mesma experiência — coerente,
            editorial e sem ruído comercial.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <ModuleTile key={m.key} module={m} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleTile({ module: m }: { module: ModuleCard }) {
  const Icon = m.icon;
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
          {m.status === "em-preparacao" && (
            <span
              className="border px-2 py-1 text-[10px] uppercase tracking-[0.22em]"
              style={{ borderColor: "color-mix(in oklab, var(--paper) 40%, transparent)", color: "var(--paper)" }}
            >
              Em preparação
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

  if (m.to) {
    return (
      <Link to={m.to} aria-label={m.title} className="block h-full focus:outline-none">
        {inner}
      </Link>
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

function ClosingBand() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div
          className="grid gap-10 border p-10 md:grid-cols-[1.4fr_1fr] md:p-14"
          style={{
            borderColor: "var(--paper-edge)",
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--brand-blue-deep) 96%, transparent), color-mix(in oklab, var(--ink) 92%, transparent))",
            color: "var(--paper)",
          }}
        >
          <div>
            <span className="portal-eyebrow" style={{ color: "color-mix(in oklab, var(--paper) 75%, transparent)" }}>
              Acesso corporativo
            </span>
            <h3 className="portal-serif mt-4 text-3xl md:text-4xl">
              Já é parte da Velox? Acesse a Área Executiva.
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-relaxed" style={{ color: "color-mix(in oklab, var(--paper) 80%, transparent)" }}>
              Login reservado a franqueados, gestores e administradores da
              rede. Todo o ambiente operacional Velox — KPI Manager, Brain
              Analytics, Relatórios, Base de Conhecimento e IA Corporativa —
              permanece intacto e disponível.
            </p>
          </div>
          <div className="flex flex-col items-start justify-center gap-3 md:items-end">
            <Link
              to="/executivo"
              className="inline-flex items-center gap-2 border px-6 py-3 text-sm uppercase tracking-[0.22em]"
              style={{
                borderColor: "color-mix(in oklab, var(--paper) 40%, transparent)",
                color: "var(--paper)",
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              Entrar na Área Executiva
            </Link>
            <span className="text-xs" style={{ color: "color-mix(in oklab, var(--paper) 60%, transparent)" }}>
              Autenticação local · uso interno
            </span>
          </div>
        </div>
      </div>
    </section>
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