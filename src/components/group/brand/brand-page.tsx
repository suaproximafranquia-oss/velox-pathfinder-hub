/**
 * INVÓLUCRO VISUAL COMPARTILHADO DAS PÁGINAS INSTITUCIONAIS DAS MARCAS
 * (`/financeira`, `/solar`, `/seguradora`).
 *
 * Uma única estrutura, três narrativas: cada marca traz seu logo, sua
 * cor de destaque, suas soluções e seu texto — mas todas pertencem à
 * mesma família visual da landing do Grupo (`/`).
 *
 * Isolamento: nenhuma dependência de ambiente operacional. Sem login,
 * sem Portal do Investidor, sem cadência, sem CRM. A captação usa o
 * formulário oficial `unit-interest-form.tsx`, que grava apenas na
 * carteira institucional (`group_unit_leads`).
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Menu, X } from "lucide-react";
import { UnitInterestForm } from "@/components/group/unit-interest-form";
import { GroupReveal } from "@/components/group/landing/group-reveal";
import { assetUrl } from "@/lib/assets/registry";
import { BRAND_SECTIONS, type BrandContent } from "./brand-content";

const groupLogo = assetUrl("logo-velox");

export function BrandPage({ brand }: { brand: BrandContent }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const accent = brand.accent;

  return (
    <main className="min-h-screen bg-[#050b1a] text-white antialiased">
      {/* ---------------------------- cabeçalho ---------------------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "border-b border-white/10 bg-[#050b1a]/90 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 md:px-10">
          <div className="flex items-center gap-4">
            <img
              src={brand.logo}
              alt={brand.name}
              className="h-9 w-auto object-contain md:h-10"
            />
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            {BRAND_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => go(section.id)}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {section.label}
              </button>
            ))}
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Grupo Velox
            </Link>
          </nav>

          <button
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open ? (
          <div className="border-t border-white/10 bg-[#050b1a]/95 px-6 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              {BRAND_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => go(section.id)}
                  className="text-left text-sm text-white/70"
                >
                  {section.label}
                </button>
              ))}
              <Link to="/" className="text-left text-sm text-white/45">
                ← Voltar ao Grupo Velox
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      {/* ------------------------------- hero ------------------------------ */}
      <section id="inicio" className="relative scroll-mt-20 overflow-hidden pt-28 md:pt-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 md:grid-cols-2 md:px-10 md:pb-24">
          <GroupReveal>
            <p
              className="text-xs uppercase tracking-[0.3em]"
              style={{ color: accent }}
            >
              {brand.hero.eyebrow}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl lg:text-6xl">
              {brand.hero.titleLead}
              <br />
              <span style={{ color: accent }}>{brand.hero.titleAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/65">
              {brand.hero.lead}
            </p>
            <button
              onClick={() => go("quero-conhecer")}
              className="mt-9 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-[#050b1a] transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              Quero conhecer
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </GroupReveal>

          <GroupReveal delay={120}>
            <div className="relative overflow-hidden rounded-3xl border border-white/10">
              <img
                src={brand.hero.image}
                alt={brand.hero.imageAlt}
                width={1600}
                height={1000}
                className="h-[320px] w-full object-cover md:h-[460px]"
                decoding="async"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050b1a] via-transparent to-transparent" />
            </div>
          </GroupReveal>
        </div>
      </section>

      {/* ------------------------------ intro ------------------------------ */}
      <section className="border-t border-white/5 bg-[#070d1f] py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center md:px-10">
          <GroupReveal>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {brand.intro.title}
            </h2>
            <div className="mt-6 space-y-5">
              {brand.intro.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-white/60">
                  {paragraph}
                </p>
              ))}
            </div>
          </GroupReveal>
        </div>
      </section>

      {/* ---------------------------- soluções ----------------------------- */}
      <section id="solucoes" className="scroll-mt-20 bg-[#050b1a] py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <GroupReveal className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {brand.solutions.title}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/55">
              {brand.solutions.subtitle}
            </p>
          </GroupReveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {brand.solutions.items.map((item, i) => (
              <GroupReveal key={item.name} delay={i * 70}>
                <article
                  className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25"
                  style={{ borderTopColor: accent, borderTopWidth: 2 }}
                >
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{item.text}</p>
                </article>
              </GroupReveal>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- como atuamos -------------------------- */}
      <section id="como-atuamos" className="scroll-mt-20 bg-[#070d1f] py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <GroupReveal className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {brand.pillars.title}
            </h2>
          </GroupReveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {brand.pillars.items.map((item, i) => (
              <GroupReveal key={item.title} delay={i * 70}>
                <div className="h-full rounded-2xl border border-white/10 bg-[#0b1226] p-6">
                  <Check className="h-5 w-5" style={{ color: accent }} aria-hidden />
                  <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{item.text}</p>
                </div>
              </GroupReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- showcase ---------------------------- */}
      <section className="bg-[#050b1a] py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 md:grid-cols-2 md:px-10">
          <GroupReveal>
            <div className="overflow-hidden rounded-3xl border border-white/10">
              <img
                src={brand.showcase.image}
                alt={brand.showcase.imageAlt}
                width={1200}
                height={800}
                loading="lazy"
                decoding="async"
                className="h-[300px] w-full object-cover md:h-[420px]"
              />
            </div>
          </GroupReveal>
          <GroupReveal delay={100}>
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>
              {brand.showcase.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {brand.showcase.title}
            </h2>
            <div className="mt-5 space-y-4">
              {brand.showcase.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-white/60">
                  {paragraph}
                </p>
              ))}
            </div>
          </GroupReveal>
        </div>
      </section>

      {/* ------------------------------ números ---------------------------- */}
      <section className="border-y border-white/5 bg-[#070d1f] py-14">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 text-center sm:grid-cols-3 md:px-10">
          {brand.numbers.map((item, i) => (
            <GroupReveal key={item.label} delay={i * 80}>
              <p className="text-3xl font-semibold md:text-4xl" style={{ color: accent }}>
                {item.value}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
                {item.label}
              </p>
            </GroupReveal>
          ))}
        </div>
      </section>

      {/* ---------------------------- formulário --------------------------- */}
      <section
        id="quero-conhecer"
        className="relative scroll-mt-20 overflow-hidden bg-[#050b1a] py-20 md:py-28"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{ background: `linear-gradient(to bottom, ${brand.accentSoft}, transparent)` }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl items-start gap-10 px-6 md:grid-cols-2 md:px-10">
          <GroupReveal>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {brand.cta.title}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
              {brand.cta.text}
            </p>
            <p className="mt-6 text-xs text-white/35">
              Seus dados são usados apenas para o contato sobre a {brand.shortName}.
            </p>
          </GroupReveal>
          <GroupReveal delay={120}>
            <UnitInterestForm
              unit={brand.key}
              fromGroup
              origin={`Página institucional ${brand.name}`}
            />
          </GroupReveal>
        </div>
      </section>

      {/* ------------------------------ rodapé ----------------------------- */}
      <footer className="border-t border-white/10 bg-[#040915] py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 text-center md:flex-row md:justify-between md:px-10 md:text-left">
          <img src={groupLogo} alt="Grupo Velox" className="h-8 w-auto object-contain" />
          <Link to="/" className="text-xs uppercase tracking-[0.18em] text-white/50 hover:text-white">
            Conheça o Grupo Velox
          </Link>
          <div className="text-xs text-white/40">
            <p>{brand.name} · Empresa do Grupo Velox.</p>
            <p className="mt-1">Sede · São José do Rio Preto · SP</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
