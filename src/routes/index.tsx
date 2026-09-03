/**
 * PORTAL INSTITUCIONAL DO GRUPO VELOX — raiz pública.
 *
 * A raiz NÃO é operacional: não tem Gateway, simulador, captação,
 * cadência ou Portal do Investidor. Ela apresenta as três empresas do
 * Grupo:
 *
 *   Velox Soluções Financeiras → leva ao ambiente /f (jornada oficial)
 *   Velox Solar                → formulário de interesse (vira card)
 *   Velox Seguros              → formulário de interesse (vira card)
 *
 * COMPATIBILIDADE: links antigos que apontavam para "/" com parâmetros
 * de contexto (`e`, `m`, `o`, `b`, `u`, `c`, `ch`, `lead`) continuam
 * funcionando — são redirecionados para "/f" com os MESMOS parâmetros.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { GroupLandingPage } from "@/components/group/landing/group-landing-page";


type GroupSearch = {
  e?: string;
  m?: string;
  o?: string;
  u?: string;
  c?: string;
  b?: string;
  ch?: string;
  lead?: string;
};

/**
 * A URL pode entregar valores já convertidos (ex.: `g=1` vira número).
 * A leitura normaliza tudo para texto — nenhum parâmetro se perde.
 */
const str = (v: unknown) => {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): GroupSearch => ({
    e: str(search.e),
    m: str(search.m),
    o: str(search.o),
    u: str(search.u),
    c: str(search.c),
    b: str(search.b),
    ch: str(search.ch),
    lead: str(search.lead),
  }),
  beforeLoad: ({ search }) => {
    const hasContext = Object.values(search as Record<string, unknown>).some(Boolean);
    if (hasContext) {
      throw redirect({ to: "/f", replace: true, search: search as never });
    }
  },
  head: () => ({
    meta: [
      { title: "Grupo Velox — Soluções Financeiras, Solar e Seguros" },
      {
        name: "description",
        content:
          "Portal institucional do Grupo Velox: conheça a Velox Soluções Financeiras, a Velox Solar e a Velox Seguros e acesse o ambiente de cada empresa.",
      },
      { property: "og:title", content: "Grupo Velox — institucional" },
      {
        property: "og:description",
        content:
          "As três empresas do Grupo Velox em um único lugar: Soluções Financeiras, Solar e Seguros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupHome,
});

/**
 * A origem institucional viaja na URL (`g=1`) e é gravada no
 * EntryContext pela home da unidade — sem mecanismo paralelo.
 */
/** Valor textual (não numérico) para a URL permanecer legível. */
const GROUP_SEARCH = { g: "grupo", o: "Portal Institucional do Grupo Velox" } as const;

const SERVICES = [
  {
    icon: Handshake,
    title: "Oportunidade",
    text: "Um modelo de negócio estruturado, com processo claro e acompanhamento próximo.",
  },
  {
    icon: Users2,
    title: "Consultores",
    text: "Times formados dentro do padrão Velox de atendimento e conduta.",
  },
  {
    icon: LineChart,
    title: "Investimento",
    text: "Faixas de entrada definidas com transparência, sem promessa de retorno rápido.",
  },
  {
    icon: GraduationCap,
    title: "Treinamento",
    text: "Formação inicial e continuada para operar com segurança desde o primeiro mês.",
  },
  {
    icon: ShieldCheck,
    title: "Suporte",
    text: "Estrutura central de apoio operacional, jurídico e de marketing.",
  },
  {
    icon: Award,
    title: "Reconhecimento",
    text: "Marca consolidada e presença regional relevante nas três frentes do Grupo.",
  },
];

type UnitKey = "financeira" | "solar" | "seguros";

const UNITS: Array<{
  key: UnitKey;
  name: string;
  icon: typeof Building2;
  bullets: string[];
  to: "/f" | "/s" | "/seg";
}> = [
  {
    key: "financeira",
    name: "Velox Soluções Financeiras",
    icon: Building2,
    bullets: ["Crédito e consórcio", "Carteira de clientes ativa", "Jornada completa do investidor"],
    to: "/f",
  },
  {
    key: "solar",
    name: "Velox Solar",
    icon: Sun,
    bullets: ["Energia solar", "Eficiência energética", "Projetos residenciais e empresariais"],
    to: "/s",
  },
  {
    key: "seguros",
    name: "Velox Seguros",
    icon: ShieldCheck,
    bullets: ["Proteção patrimonial", "Vida e previdência", "Seguros corporativos"],
    to: "/seg",
  },
];

function GroupHome() {
  return (
    <main className="min-h-screen bg-[#050b1a] text-white">
      <header className="mx-auto flex max-w-6xl items-center px-6 py-8">
        <span className="text-sm uppercase tracking-[0.4em] text-[#c9a961]">Grupo Velox</span>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-6">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Um grupo, três frentes de{" "}
          <span className="text-[#c9a961]">soluções para pessoas e empresas</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70">
          O Grupo Velox reúne operações independentes de soluções financeiras, energia solar e
          seguros. Escolha a empresa para conhecer o ambiente e as soluções de cada uma.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="#empresas"
            className="inline-flex items-center gap-2 rounded-full bg-[#c9a961] px-6 py-3 text-sm font-medium text-[#0b1b33] transition hover:opacity-90"
          >
            Seja um Franqueado
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <p className="self-center text-xs text-white/50">
            A escolha da empresa acontece antes de qualquer cadastro.
          </p>
        </div>

      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-xs uppercase tracking-[0.3em] text-white/40">O que sustenta a operação</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <article
                key={service.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <Icon className="h-6 w-6 text-[#c9a961]" aria-hidden />
                <h3 className="mt-4 text-base font-semibold">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{service.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="empresas" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-xs uppercase tracking-[0.3em] text-white/40">Empresas do Grupo</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {UNITS.map((unit) => {
            const Icon = unit.icon;
            return (
              <article
                key={unit.key}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <Icon className="h-6 w-6 text-[#c9a961]" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold">{unit.name}</h3>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-white/60">
                  {unit.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c9a961]" aria-hidden />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link
                  to={unit.to}
                  search={GROUP_SEARCH as never}
                  className="mt-5 inline-flex items-center gap-2 text-sm text-[#c9a961] transition hover:gap-3"
                >
                  Saiba mais
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/40">
        Grupo Velox · Soluções Financeiras, Solar e Seguros.
      </footer>
    </main>
  );
}
