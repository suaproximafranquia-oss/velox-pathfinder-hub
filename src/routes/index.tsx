import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Layers,
  GraduationCap,
  Cpu,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ArrowRight,
  Building2,
  Handshake,
  LineChart,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const WHATSAPP_NUMBER = "5511999999999";

const quizQuestions = [
  {
    id: "objetivo",
    q: "Qual é o seu principal objetivo com uma franquia?",
    options: [
      "Criar uma segunda fonte de renda",
      "Substituir minha renda atual",
      "Ter meu próprio negócio",
      "Diversificar investimentos",
    ],
  },
  {
    id: "tempo",
    q: "Quanto tempo você pretende dedicar inicialmente?",
    options: ["Algumas horas por dia", "Meio período", "Tempo integral"],
  },
  {
    id: "experiencia",
    q: "Você possui experiência com vendas ou atendimento?",
    options: [
      "Sim, tenho experiência",
      "Tenho pouca experiência",
      "Não tenho, mas quero aprender",
    ],
  },
  {
    id: "perfil",
    q: "Como você se sente em relação ao empreendedorismo?",
    options: [
      "Já empreendo e quero crescer",
      "Quero começar meu primeiro negócio",
      "Ainda estou avaliando",
    ],
  },
  {
    id: "reserva",
    q: "Você possui reserva financeira para iniciar um projeto?",
    options: ["Sim", "Parcialmente", "Ainda preciso me organizar"],
  },
] as const;

const faqs = [
  {
    q: "Preciso entender de mercado financeiro?",
    a: "Não. A capacitação existe justamente para desenvolver o conhecimento necessário ao longo da jornada como franqueado.",
  },
  {
    q: "Preciso largar meu emprego?",
    a: "Não necessariamente. Muitos franqueados iniciam a operação como segunda fonte de renda e vão ajustando a dedicação conforme o negócio se desenvolve.",
  },
  {
    q: "Existe garantia de faturamento?",
    a: "Não existe garantia de resultado. O desempenho depende da dedicação, execução e desenvolvimento do franqueado dentro do modelo apresentado.",
  },
  {
    q: "Vou ter suporte?",
    a: "Sim. Existe treinamento inicial, universidade corporativa, suporte operacional e consultoria contínua de desenvolvimento do negócio.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <Nav />
      <Hero />
      <About />
      <HowItWorks />
      <ForWho />
      <Quiz />
      <Investment />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-6 ${className}`}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[var(--gold)]">
      <span className="h-px w-8 bg-[var(--gold)]" />
      {children}
    </span>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--navy-deep)]/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2 text-[var(--navy-foreground)]">
          <div className="grid h-8 w-8 place-items-center rounded-sm bg-[var(--gold)] text-[var(--gold-foreground)] font-display text-lg font-bold">
            V
          </div>
          <span className="font-display text-lg tracking-wide">VELOX</span>
        </a>
        <a
          href="#contato"
          className="hidden rounded-sm border border-[var(--gold)] px-4 py-2 text-sm font-medium text-[var(--gold)] transition hover:bg-[var(--gold)] hover:text-[var(--gold-foreground)] sm:inline-flex"
        >
          Falar com especialista
        </a>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[var(--navy-deep)] text-[var(--navy-foreground)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 80% 0%, oklch(0.78 0.12 85 / 0.18), transparent 60%), radial-gradient(50% 40% at 0% 100%, oklch(0.35 0.1 260 / 0.5), transparent 60%)",
        }}
      />
      <Container className="relative py-24 md:py-32">
        <div className="max-w-3xl">
          <SectionLabel>Manual do Investidor</SectionLabel>
          <h1 className="mt-6 font-display text-4xl leading-[1.1] tracking-tight md:text-6xl">
            Antes de investir em uma franquia, entenda exatamente como funciona.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            Um manual completo para você conhecer o modelo Velox, entender a operação,
            os desafios e tomar uma decisão consciente.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#quiz"
              className="inline-flex items-center justify-center gap-2 rounded-sm bg-[var(--gold)] px-6 py-3.5 text-sm font-semibold text-[var(--gold-foreground)] transition hover:bg-[var(--gold-soft)]"
            >
              Quero entender a franquia Velox
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#sobre"
              className="inline-flex items-center justify-center rounded-sm border border-white/20 px-6 py-3.5 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
            >
              Conhecer o modelo
            </a>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, label: "Transparência" },
              { icon: Building2, label: "Modelo consolidado" },
              { icon: Handshake, label: "Suporte contínuo" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-white/70">
                <Icon className="h-5 w-5 text-[var(--gold)]" />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function About() {
  return (
    <section id="sobre" className="border-b border-border bg-background py-24 md:py-32">
      <Container>
        <div className="grid gap-16 md:grid-cols-[1fr_1.2fr] md:items-start">
          <div>
            <SectionLabel>Sobre a Velox</SectionLabel>
            <h2 className="mt-6 font-display text-3xl leading-tight text-[var(--navy-deep)] md:text-4xl">
              Soluções financeiras conectadas por consultoria de confiança.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
            <p>
              A Velox atua no segmento de soluções financeiras, conectando clientes às
              melhores oportunidades através de uma rede de parceiros homologados.
            </p>
            <p>
              O franqueado atua como um{" "}
              <span className="font-semibold text-foreground">consultor financeiro empresarial</span>
              , identificando necessidades reais dos clientes e direcionando as soluções mais
              adequadas para cada perfil.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, t: "Autoridade" },
                { icon: LineChart, t: "Crescimento" },
                { icon: Handshake, t: "Parceria" },
              ].map(({ icon: Icon, t }) => (
                <div
                  key={t}
                  className="rounded-sm border border-border bg-card p-5"
                >
                  <Icon className="h-5 w-5 text-[var(--navy)]" />
                  <div className="mt-3 text-sm font-medium text-foreground">{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  const cards = [
    {
      icon: Layers,
      title: "Diversidade de produtos",
      body: "Consignado, financiamento, consórcio, seguros, energia solar, capital de giro e outras soluções financeiras integradas.",
    },
    {
      icon: Building2,
      title: "Sem estoque",
      body: "O negócio opera com intermediação de soluções financeiras. Não há necessidade de manter produtos físicos.",
    },
    {
      icon: GraduationCap,
      title: "Suporte e capacitação",
      body: "Treinamento inicial, universidade corporativa, suporte operacional e consultoria contínua de desenvolvimento.",
    },
    {
      icon: Cpu,
      title: "Tecnologia",
      body: "Sistemas proprietários, plataformas digitais, ferramentas de gestão e acompanhamento de indicadores em tempo real.",
    },
  ];
  return (
    <section className="bg-secondary py-24 md:py-32">
      <Container>
        <div className="max-w-2xl">
          <SectionLabel>Como funciona</SectionLabel>
          <h2 className="mt-6 font-display text-3xl leading-tight text-[var(--navy-deep)] md:text-4xl">
            Uma franquia Velox por dentro.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Os quatro pilares que estruturam a operação de cada franqueado.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group relative flex flex-col rounded-sm border border-border bg-card p-7 transition hover:border-[var(--gold)]"
            >
              <div className="grid h-11 w-11 place-items-center rounded-sm bg-[var(--navy-deep)] text-[var(--gold)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-display text-lg text-[var(--navy-deep)]">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ForWho() {
  const yes = [
    "Gostam de relacionamento",
    "Têm vontade de aprender",
    "Querem desenvolver um negócio próprio",
    "Possuem disciplina",
    "Entendem que resultados dependem da dedicação",
  ];
  const no = [
    "Procura dinheiro rápido sem esforço",
    "Acredita que comprar uma franquia elimina o trabalho",
    "Não tem disposição para aprender",
  ];
  return (
    <section className="bg-background py-24 md:py-32">
      <Container>
        <div className="max-w-2xl">
          <SectionLabel>A franquia é para quem?</SectionLabel>
          <h2 className="mt-6 font-display text-3xl leading-tight text-[var(--navy-deep)] md:text-4xl">
            Nem todo modelo serve para todo perfil. E isso é bom.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-sm border border-border bg-card p-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[var(--navy)]" />
              <h3 className="font-display text-xl text-[var(--navy-deep)]">
                Pode fazer sentido para pessoas que
              </h3>
            </div>
            <ul className="mt-6 space-y-3">
              {yes.map((i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-sm border border-border bg-secondary p-8">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-display text-xl text-[var(--navy-deep)]">
                Não é indicado para quem
              </h3>
            </div>
            <ul className="mt-6 space-y-3">
              {no.map((i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ nome: "", telefone: "", cidade: "" });
  const [sent, setSent] = useState(false);

  const total = quizQuestions.length;
  const showForm = step >= total;

  const current = quizQuestions[step];

  const message = useMemo(() => {
    const lines = [
      "Olá! Preenchi o Manual do Investidor Velox.",
      "",
      `Nome: ${form.nome}`,
      `Telefone: ${form.telefone}`,
      `Cidade: ${form.cidade}`,
      "",
      "Respostas:",
      ...quizQuestions.map((q, i) => `${i + 1}. ${q.q} → ${answers[q.id] ?? "-"}`),
    ];
    return encodeURIComponent(lines.join("\n"));
  }, [answers, form]);

  function pick(option: string) {
    setAnswers((a) => ({ ...a, [current.id]: option }));
    setStep((s) => s + 1);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.telefone || !form.cidade) return;
    setSent(true);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
  }

  return (
    <section
      id="quiz"
      className="relative overflow-hidden bg-[var(--navy-deep)] py-24 text-[var(--navy-foreground)] md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(50% 40% at 100% 0%, oklch(0.78 0.12 85 / 0.2), transparent 60%)",
        }}
      />
      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Autoavaliação</SectionLabel>
          <h2 className="mt-6 font-display text-3xl leading-tight md:text-4xl">
            Uma conversa começa pelo autoconhecimento.
          </h2>
          <p className="mt-4 text-white/70">
            Cinco perguntas rápidas para preparar uma conversa mais alinhada com o seu momento.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl rounded-sm border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          {!sent ? (
            <>
              <div className="mb-8 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-[var(--gold)] transition-all"
                    style={{ width: `${(Math.min(step, total) / total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/60">
                  {Math.min(step + (showForm ? 0 : 1), total)}/{total}
                </span>
              </div>

              {!showForm && current && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">
                    Pergunta {step + 1}
                  </p>
                  <h3 className="mt-3 font-display text-2xl leading-snug">{current.q}</h3>
                  <div className="mt-6 grid gap-3">
                    {current.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => pick(opt)}
                        className="group flex items-center justify-between rounded-sm border border-white/15 bg-white/[0.02] px-5 py-4 text-left text-sm text-white/85 transition hover:border-[var(--gold)] hover:bg-white/[0.06] hover:text-white"
                      >
                        <span>{opt}</span>
                        <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                  {step > 0 && (
                    <button
                      onClick={() => setStep((s) => s - 1)}
                      className="mt-6 text-xs text-white/50 transition hover:text-white/80"
                    >
                      ← Voltar
                    </button>
                  )}
                </div>
              )}

              {showForm && (
                <form id="contato" onSubmit={submit} className="space-y-5">
                  <div>
                    <p className="text-sm text-white/80">
                      Obrigado por compartilhar essas informações. Essas respostas ajudam
                      nossa equipe a entender melhor seu momento e conduzir uma conversa mais
                      personalizada.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <Field
                      label="Nome completo"
                      value={form.nome}
                      onChange={(v) => setForm((f) => ({ ...f, nome: v }))}
                    />
                    <Field
                      label="Telefone (WhatsApp)"
                      value={form.telefone}
                      onChange={(v) => setForm((f) => ({ ...f, telefone: v }))}
                      type="tel"
                    />
                    <Field
                      label="Cidade"
                      value={form.cidade}
                      onChange={(v) => setForm((f) => ({ ...f, cidade: v }))}
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-[var(--gold)] px-6 py-3.5 text-sm font-semibold text-[var(--gold-foreground)] transition hover:bg-[var(--gold-soft)]"
                  >
                    Enviar e conversar no WhatsApp
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-center text-xs text-white/50">
                    Seus dados são utilizados apenas para contato consultivo.
                  </p>
                </form>
              )}
            </>
          ) : (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--gold)]" />
              <h3 className="mt-4 font-display text-2xl">Recebemos suas informações.</h3>
              <p className="mt-2 text-sm text-white/70">
                Nossa equipe entrará em contato pelo WhatsApp em breve.
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60">
        {label}
      </span>
      <input
        type={type}
        required
        value={value}
        maxLength={120}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--gold)]"
      />
    </label>
  );
}

function Investment() {
  const items = [
    "Taxa de franquia",
    "Implantação",
    "Ferramentas",
    "Estrutura opcional",
    "Custos operacionais",
  ];
  return (
    <section className="bg-background py-24 md:py-32">
      <Container>
        <div className="grid gap-16 md:grid-cols-2 md:items-start">
          <div>
            <SectionLabel>Investimento e transparência</SectionLabel>
            <h2 className="mt-6 font-display text-3xl leading-tight text-[var(--navy-deep)] md:text-4xl">
              Uma decisão consciente começa conhecendo todos os pontos do negócio.
            </h2>
            <p className="mt-6 text-muted-foreground">
              A Velox apresenta todos os custos envolvidos antes da decisão. Nada fica
              subentendido — para que você possa avaliar com clareza.
            </p>
          </div>
          <div className="rounded-sm border border-border bg-card p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--gold)]">
              Composição do investimento
            </p>
            <ul className="mt-6 divide-y divide-border">
              {items.map((i, idx) => (
                <li key={i} className="flex items-center gap-4 py-4">
                  <span className="font-display text-sm text-[var(--gold)]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium text-foreground">{i}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">
              Valores detalhados são apresentados na conversa com o especialista.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-secondary py-24 md:py-32">
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <SectionLabel>Perguntas frequentes</SectionLabel>
            <h2 className="mt-6 font-display text-3xl leading-tight text-[var(--navy-deep)] md:text-4xl">
              As dúvidas que ouvimos com mais frequência.
            </h2>
          </div>
          <div className="mt-12 divide-y divide-border rounded-sm border border-border bg-card">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                  >
                    <span className="font-display text-base text-[var(--navy-deep)] md:text-lg">
                      {f.q}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-[var(--gold)] transition ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground">
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-[var(--navy-deep)] py-24 text-[var(--navy-foreground)] md:py-32">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Próximo passo</SectionLabel>
          <h2 className="mt-6 font-display text-3xl leading-tight md:text-5xl">
            Agora que você entende melhor o modelo, o próximo passo é conversar.
          </h2>
          <p className="mt-6 text-white/70 md:text-lg">
            Cada pessoa possui um momento diferente. Nossa função é apresentar a
            oportunidade com transparência para que você avalie se faz sentido para
            seus objetivos.
          </p>
          <a
            href="#quiz"
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-sm bg-[var(--gold)] px-8 py-4 text-sm font-semibold text-[var(--gold-foreground)] transition hover:bg-[var(--gold-soft)]"
          >
            Conversar com especialista
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[var(--navy-deep)] py-10 text-sm text-white/50">
      <Container className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-sm bg-[var(--gold)] text-[var(--gold-foreground)] font-display text-xs font-bold">
            V
          </div>
          <span className="font-display tracking-wide text-white/80">VELOX</span>
        </div>
        <p>© {new Date().getFullYear()} Velox. Manual do Investidor.</p>
      </Container>
    </footer>
  );
}
