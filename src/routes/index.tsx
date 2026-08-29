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
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Award,
  Building2,
  Check,
  GraduationCap,
  Handshake,
  LineChart,
  ShieldCheck,
  Sun,
  Users2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { registrarInteresseUnidade } from "@/lib/group/unit-leads.functions";

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

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

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
const GROUP_SEARCH = { g: "1", o: "Portal Institucional do Grupo Velox" } as const;

const STATS = [
  { value: "+800", label: "unidades no país" },
  { value: "+400 mil", label: "clientes atendidos" },
  { value: "R$ 16 Bi", label: "em volume intermediado" },
];

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
  status: string | null;
}> = [
  {
    key: "financeira",
    name: "Velox Soluções Financeiras",
    icon: Building2,
    bullets: ["Crédito e consórcio", "Carteira de clientes ativa", "Jornada completa do investidor"],
    status: null,
  },
  {
    key: "solar",
    name: "Velox Solar",
    icon: Sun,
    bullets: ["Energia solar", "Eficiência energética", "Projetos residenciais e empresariais"],
    status: "Conteúdo institucional em preparação",
  },
  {
    key: "seguros",
    name: "Velox Seguros",
    icon: ShieldCheck,
    bullets: ["Proteção patrimonial", "Vida e previdência", "Seguros corporativos"],
    status: "Conteúdo institucional em preparação",
  },
];

const RANGE_OPTIONS = [
  { value: "10_20", label: "De R$ 10 mil a R$ 20 mil" },
  { value: "20_30", label: "De R$ 20 mil a R$ 30 mil" },
  { value: "acima_30", label: "Acima de R$ 30 mil" },
] as const;

function GroupHome() {
  const [formUnit, setFormUnit] = useState<"solar" | "seguros" | null>(null);

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

        <dl className="mt-14 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <dt className="text-3xl font-semibold text-[#c9a961]">{stat.value}</dt>
              <dd className="mt-1 text-sm text-white/60">{stat.label}</dd>
            </div>
          ))}
        </dl>
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
                {unit.status ? (
                  <p className="mt-4 rounded-lg border border-[#c9a961]/30 bg-[#c9a961]/5 px-3 py-2 text-[11px] text-[#c9a961]">
                    {unit.status}
                  </p>
                ) : null}
                {unit.key === "financeira" ? (
                  <Link
                    to="/f"
                    search={GROUP_SEARCH as never}
                    className="mt-5 inline-flex items-center gap-2 text-sm text-[#c9a961] transition hover:gap-3"
                  >
                    Saiba mais
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormUnit(unit.key as "solar" | "seguros")}
                    className="mt-5 inline-flex items-center gap-2 self-start text-sm text-[#c9a961] transition hover:gap-3"
                  >
                    Saiba mais
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/40">
        Grupo Velox · Soluções Financeiras, Solar e Seguros.
      </footer>

      {formUnit ? <UnitInterestForm unit={formUnit} onClose={() => setFormUnit(null)} /> : null}
    </main>
  );
}

function UnitInterestForm({
  unit,
  onClose,
}: {
  unit: "solar" | "seguros";
  onClose: () => void;
}) {
  const submit = useServerFn(registrarInteresseUnidade);
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    city: "",
    investmentRange: "" as "" | (typeof RANGE_OPTIONS)[number]["value"],
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function send() {
    if (!form.investmentRange) {
      toast.error("Selecione a faixa de investimento.");
      return;
    }
    setSending(true);
    try {
      await submit({
        data: {
          unit,
          name: form.name,
          whatsapp: form.whatsapp,
          email: form.email || null,
          city: form.city || null,
          investmentRange: form.investmentRange,
          origin: "Portal Institucional do Grupo Velox",
          campaign: null,
        },
      });
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar agora.");
    } finally {
      setSending(false);
    }
  }

  const unitName = unit === "solar" ? "Velox Solar" : "Velox Seguros";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1428] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#c9a961]">{unitName}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Quero conhecer a operação</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-white/50">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {done ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-white/70">
              Recebemos seu interesse. Um responsável do Grupo Velox entrará em contato pelo
              WhatsApp informado.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[#c9a961] px-5 py-2.5 text-sm font-medium text-[#0b1b33]"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Seu nome completo"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
            <input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              inputMode="tel"
              placeholder="WhatsApp com DDD"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              inputMode="email"
              placeholder="E-mail"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Cidade"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
            <div className="space-y-2 pt-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                Quanto pretende investir
              </p>
              {RANGE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                    form.investmentRange === option.value
                      ? "border-[#c9a961] bg-[#c9a961]/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  <input
                    type="radio"
                    name="range"
                    className="accent-[#c9a961]"
                    checked={form.investmentRange === option.value}
                    onChange={() => setForm({ ...form, investmentRange: option.value })}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={sending}
              onClick={() => void send()}
              className="mt-2 w-full rounded-full bg-[#c9a961] px-5 py-3 text-sm font-medium text-[#0b1b33] disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar interesse"}
            </button>
            <p className="text-[11px] text-white/40">
              Seus dados são usados apenas para contato sobre a {unitName}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
