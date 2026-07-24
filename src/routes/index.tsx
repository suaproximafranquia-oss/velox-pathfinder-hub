import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeft, ShieldCheck, PlayCircle, CheckCircle2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Journey,
});

const WHATSAPP_NUMBER = "5517997727337";

type Step = {
  id: string;
  eyebrow: string;
  message: string;
  question: string;
  options: string[];
  videoUrl?: string;
  videoLabel?: string;
};

const steps: Step[] = [
  {
    id: "objetivo",
    eyebrow: "Etapa 1 · Alinhamento inicial",
    message:
      "Antes de conhecer uma franquia, é importante entender se esse modelo combina com o seu momento.",
    question: "Qual é o seu principal objetivo buscando uma franquia?",
    options: [
      "Criar uma segunda fonte de renda",
      "Ter meu próprio negócio",
      "Substituir minha renda atual",
      "Estou avaliando possibilidades",
    ],
    videoLabel: "Boas-vindas do consultor",
  },
  {
    id: "dedicacao",
    eyebrow: "Etapa 2 · Dedicação",
    message:
      "Empreender exige decisão e dedicação. A franquia oferece um caminho estruturado, mas o desenvolvimento depende da energia colocada pelo franqueado.",
    question: "Quanto tempo você pretende dedicar inicialmente ao negócio?",
    options: ["Algumas horas por dia", "Meio período", "Tempo integral"],
  },
  {
    id: "experiencia",
    eyebrow: "Etapa 3 · Experiência",
    message:
      "A experiência ajuda, mas ninguém nasce sabendo. O aprendizado acontece através da prática, treinamento e acompanhamento.",
    question: "Você possui experiência com vendas ou atendimento?",
    options: [
      "Sim, tenho experiência",
      "Tenho pouca experiência",
      "Não tenho, mas quero aprender",
    ],
  },
  {
    id: "financeiro",
    eyebrow: "Etapa 4 · Mercado financeiro",
    message:
      "O mercado financeiro faz parte da vida de todas as pessoas. A Velox conecta clientes a soluções que já fazem parte do cotidiano.",
    question: "Você já teve contato com produtos financeiros?",
    options: ["Sim, já utilizei vários", "Tenho algum conhecimento", "Tenho pouco conhecimento"],
    videoLabel: "Como funciona o mercado Velox",
  },
  {
    id: "preparacao",
    eyebrow: "Etapa 5 · Preparação financeira",
    message: "Uma franquia precisa estar alinhada com a sua realidade financeira.",
    question: "Como está sua preparação financeira para iniciar um negócio?",
    options: [
      "Tenho o investimento disponível",
      "Tenho parte do valor e estou me organizando",
      "Ainda preciso estruturar minha situação",
    ],
  },
  {
    id: "decisao",
    eyebrow: "Etapa 6 · Decisão consciente",
    message:
      "A Velox não busca vender um sonho. Busca apresentar uma oportunidade real para pessoas preparadas.",
    question: "O que mais pesa na sua decisão de investir?",
    options: [
      "Segurança do negócio",
      "Retorno financeiro",
      "Suporte e treinamento",
      "Medo de tomar uma decisão errada",
    ],
  },
  {
    id: "relacionamento",
    eyebrow: "Etapa 7 · Relacionamento",
    message:
      "A franquia entrega uma metodologia, mas o relacionamento com clientes é construído pelo franqueado.",
    question: "Você gosta de trabalhar com pessoas e criar relacionamentos?",
    options: [
      "Sim, gosto muito",
      "Tenho facilidade, mas preciso desenvolver",
      "Ainda é uma dificuldade",
    ],
  },
  {
    id: "desafios",
    eyebrow: "Etapa 8 · Perfil de desafios",
    message:
      "Todos os negócios possuem desafios. A diferença está em ter estrutura para enfrentá-los.",
    question: "Como você encara desafios?",
    options: [
      "Gosto de desafios",
      "Enfrento quando necessário",
      "Prefiro ambientes mais previsíveis",
    ],
  },
  {
    id: "expectativa",
    eyebrow: "Etapa 9 · Suporte esperado",
    message:
      "A Velox possui uma rede estruturada e suporte para auxiliar o desenvolvimento do franqueado.",
    question: "O que você espera encontrar em uma franquia?",
    options: ["Treinamento", "Suporte constante", "Marca reconhecida", "Ferramentas e tecnologia"],
    videoLabel: "Estrutura de suporte Velox",
  },
  {
    id: "apoio",
    eyebrow: "Etapa 10 · Rede de apoio",
    message:
      "Cada investidor possui uma história diferente. Por isso a análise precisa ser individual.",
    question: "Você pretende iniciar sozinho ou possui alguém para apoiar sua decisão?",
    options: ["Vou iniciar sozinho", "Tenho apoio da família", "Tenho sócio ou parceiro"],
  },
  {
    id: "regiao",
    eyebrow: "Etapa 11 · Sua região",
    message: "Chegar primeiro em uma região pode representar uma oportunidade de desenvolvimento.",
    question: "Você já pensou em empreender na sua própria cidade ou região?",
    options: ["Sim", "Ainda não", "Estou avaliando"],
  },
];

function Journey() {
  const total = steps.length + 1; // + final contact step
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ nome: "", whatsapp: "", cidade: "" });
  const [started, setStarted] = useState(false);

  const progress = useMemo(() => Math.round(((current + (started ? 1 : 0)) / (total + 1)) * 100), [current, started, total]);

  const isFinal = current === steps.length;
  const step = !isFinal ? steps[current] : null;
  const currentAnswer = step ? answers[step.id] : undefined;

  function next() {
    if (current < steps.length) setCurrent(current + 1);
  }
  function back() {
    if (current > 0) setCurrent(current - 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const linhas = [
      "Olá, preenchi a jornada do Manual do Investidor Velox e gostaria de entender melhor a oportunidade.",
      "",
      `Nome: ${form.nome}`,
      `WhatsApp: ${form.whatsapp}`,
      `Cidade/Estado: ${form.cidade}`,
      "",
      "Respostas da jornada:",
      ...steps.map((s, i) => `${i + 1}. ${s.question} → ${answers[s.id] ?? "—"}`),
    ];
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(linhas.join("\n"))}`;
    window.open(url, "_blank");
  }

  if (!started) {
    return (
      <main className="min-h-screen bg-[var(--navy-deep)] text-[var(--navy-foreground)]">
        <Header />
        <section className="mx-auto flex max-w-3xl flex-col items-center px-5 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-[var(--gold-soft)]">
            <Sparkles className="h-3.5 w-3.5" /> Manual do Investidor
          </span>
          <h1 className="mt-6 font-[var(--font-display)] text-4xl leading-tight sm:text-6xl">
            Uma jornada para você <span className="text-[var(--gold)]">decidir com clareza</span>.
          </h1>
          <p className="mt-6 max-w-xl text-base text-white/70 sm:text-lg">
            Nas próximas etapas vamos conversar sobre o seu momento, seus objetivos e como a
            franquia Velox pode — ou não — fazer sentido para você. Sem pressa. Sem pressão.
          </p>
          <div className="mt-8 grid w-full max-w-md grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {[
              { t: "12 etapas", d: "Guiadas" },
              { t: "~4 min", d: "De reflexão" },
              { t: "Transparente", d: "Sem venda agressiva" },
            ].map((i) => (
              <div
                key={i.t}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
              >
                <div className="text-sm font-semibold text-[var(--gold-soft)]">{i.t}</div>
                <div className="text-xs text-white/60">{i.d}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setStarted(true)}
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-8 py-4 text-sm font-semibold text-[var(--gold-foreground)] shadow-lg shadow-[var(--gold)]/20 transition hover:brightness-105"
          >
            Iniciar minha jornada <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-4 flex items-center gap-2 text-xs text-white/50">
            <ShieldCheck className="h-3.5 w-3.5" /> Suas respostas ficam com você. Nada é enviado
            sem sua autorização.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--navy-deep)] text-[var(--navy-foreground)]">
      <Header />

      {/* Progress */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[var(--navy-deep)]/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-5 py-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>
              Etapa {Math.min(current + 1, total)} de {total}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-2xl px-5 pb-24 pt-8">
        {step && (
          <article
            key={step.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-soft)]">
              {step.eyebrow}
            </span>

            <p className="mt-4 font-[var(--font-display)] text-2xl leading-snug text-white sm:text-3xl">
              {step.message}
            </p>

            {step.videoLabel && <VideoSlot label={step.videoLabel} />}

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <h2 className="text-base font-medium text-white sm:text-lg">{step.question}</h2>
              <div className="mt-4 grid gap-2.5">
                {step.options.map((opt) => {
                  const selected = currentAnswer === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, [step.id]: opt }))
                      }
                      className={`group flex items-center justify-between rounded-xl border px-4 py-3.5 text-left text-sm transition ${
                        selected
                          ? "border-[var(--gold)] bg-[var(--gold)]/10 text-white"
                          : "border-white/10 bg-white/[0.02] text-white/80 hover:border-white/30 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span>{opt}</span>
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 transition ${
                          selected ? "text-[var(--gold)]" : "text-white/20"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <NavButtons
              onBack={current > 0 ? back : undefined}
              onNext={next}
              nextDisabled={!currentAnswer}
              nextLabel="Continuar"
            />
          </article>
        )}

        {isFinal && (
          <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-soft)]">
              Etapa 12 · Conversa personalizada
            </span>
            <p className="mt-4 font-[var(--font-display)] text-2xl leading-snug text-white sm:text-3xl">
              Agora conseguimos entender melhor o seu momento. O próximo passo é uma conversa
              personalizada para apresentar como funciona a operação Velox.
            </p>

            <VideoSlot label="Mensagem final do consultor" />

            <form
              onSubmit={handleSubmit}
              className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
            >
              <div className="grid gap-4">
                <Field
                  label="Nome completo"
                  value={form.nome}
                  onChange={(v) => setForm((f) => ({ ...f, nome: v }))}
                  placeholder="Como devemos te chamar?"
                />
                <Field
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))}
                  placeholder="(DDD) 9 0000-0000"
                  type="tel"
                />
                <Field
                  label="Cidade / Estado"
                  value={form.cidade}
                  onChange={(v) => setForm((f) => ({ ...f, cidade: v }))}
                  placeholder="Ex.: São José do Rio Preto / SP"
                />
              </div>

              <button
                type="submit"
                disabled={!form.nome || !form.whatsapp || !form.cidade}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-semibold text-[var(--gold-foreground)] shadow-lg shadow-[var(--gold)]/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Conversar com especialista <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-white/50">
                <ShieldCheck className="h-3.5 w-3.5" /> Você será direcionado ao WhatsApp com suas
                respostas.
              </p>
            </form>

            <NavButtons onBack={back} onNext={() => {}} hideNext />
          </article>
        )}
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Velox · Manual do Investidor
      </footer>
    </main>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--gold)]/15 text-[var(--gold)] ring-1 ring-[var(--gold)]/30">
          <span className="font-[var(--font-display)] text-lg font-bold">V</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Velox</div>
          <div className="text-[10px] uppercase tracking-widest text-white/50">
            Manual do Investidor
          </div>
        </div>
      </div>
      <div className="hidden items-center gap-2 text-xs text-white/50 sm:flex">
        <ShieldCheck className="h-3.5 w-3.5 text-[var(--gold-soft)]" /> Ambiente seguro
      </div>
    </header>
  );
}

function VideoSlot({ label }: { label: string }) {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
        <PlayCircle className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/50">Espaço reservado para vídeo do consultor</div>
      </div>
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continuar",
  hideNext,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  hideNext?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {onBack ? (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      ) : (
        <span />
      )}
      {!hideNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-semibold text-[var(--gold-foreground)] shadow-lg shadow-[var(--gold)]/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLabel} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[var(--gold)] focus:outline-none"
      />
    </label>
  );
}