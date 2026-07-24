import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  PlayCircle,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Lightbulb,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Journey,
});

const WHATSAPP_NUMBER = "5517997727337";

type Step = {
  id: string;
  eyebrow: string;
  title: string;
  message: string;
  content?: string[];
  flow?: string[];
  reflection?: string;
  videoLabel?: string;
  question?: string;
  options?: string[];
  feedback?: Record<string, string>;
  defaultFeedback?: string;
};

const steps: Step[] = [
  {
    id: "motivo",
    eyebrow: "Etapa 01 · O ponto de partida",
    title: "Antes de escolher uma franquia, precisamos entender o motivo dessa decisão.",
    message:
      "Muitas pessoas procuram uma franquia porque desejam mudar sua realidade financeira, conquistar autonomia ou construir um patrimônio próprio. Mas antes de escolher qualquer negócio, é importante entender o que você realmente está buscando.",
    reflection:
      "Não existe motivo certo ou errado. Existe o motivo verdadeiro — e é dele que nasce uma decisão sólida.",
    videoLabel: "Boas-vindas do especialista Velox",
    question: "Qual o principal motivo que fez você buscar uma franquia?",
    options: [
      "Quero construir meu próprio negócio",
      "Quero uma segunda fonte de renda",
      "Quero substituir minha renda atual",
      "Quero investir em algo próprio",
    ],
    defaultFeedback:
      "Entender sua motivação é o primeiro passo para avaliar se uma franquia combina com seu momento.",
  },
  {
    id: "conceito",
    eyebrow: "Etapa 02 · O que é uma franquia",
    title: "Franquia não é comprar um negócio pronto.",
    message:
      "É comum imaginar que uma franquia é um negócio que funciona sozinho. Na prática, ela é um caminho estruturado — mas o resultado depende de quem a conduz.",
    content: [
      "Uma franquia entrega marca reconhecida no mercado.",
      "Entrega um modelo já validado e testado.",
      "Entrega processos, ferramentas e tecnologia.",
      "Entrega treinamento e suporte contínuo.",
      "Mas o resultado final depende da execução do franqueado.",
    ],
    reflection:
      "Franquia é método + execução. Sem execução, nenhum método entrega resultado.",
    question: "Você entende que uma franquia exige dedicação e participação ativa?",
    options: ["Sim, quero construir algo", "Quero entender melhor", "Ainda tenho dúvidas"],
    defaultFeedback:
      "Ótimo. Reconhecer o papel ativo do franqueado é o que separa expectativa de realidade.",
  },
  {
    id: "papel",
    eyebrow: "Etapa 03 · O papel do franqueado",
    title: "O franqueado Velox não é um investidor passivo.",
    message:
      "Dentro da operação, o franqueado atua como consultor financeiro, gestor de relacionamento e responsável pelo desenvolvimento comercial da sua região.",
    content: [
      "Consultor: entende necessidades e apresenta soluções.",
      "Relacionamento: constrói confiança com clientes.",
      "Comercial: desenvolve e expande a operação local.",
    ],
    videoLabel: "O dia a dia de um franqueado Velox",
    question: "Qual característica mais combina com você?",
    options: [
      "Gosto de vendas e relacionamento",
      "Gosto de aprender novos mercados",
      "Tenho perfil administrativo",
      "Ainda estou descobrindo meu perfil",
    ],
    defaultFeedback:
      "Autoconhecimento é uma vantagem competitiva. Todo perfil pode se desenvolver com método.",
  },
  {
    id: "mercado",
    eyebrow: "Etapa 04 · O mercado que vamos atuar",
    title: "Conhecendo o mercado de soluções financeiras.",
    message:
      "A Velox conecta pessoas e empresas a soluções financeiras que já fazem parte do cotidiano. Não vendemos promessas de ganho — atuamos com necessidades reais do mercado.",
    content: [
      "Crédito para pessoas e empresas.",
      "Consórcios de bens e serviços.",
      "Seguros de vida, patrimônio e proteção.",
      "Financiamentos imobiliários e veiculares.",
      "Energia solar e eficiência energética.",
      "Capital de giro e soluções empresariais.",
    ],
    reflection:
      "Trabalhar com soluções que as pessoas já buscam é diferente de tentar criar demanda do zero.",
    question: "Com qual desses mercados você mais se identifica hoje?",
    options: [
      "Crédito e capital de giro",
      "Consórcios e financiamentos",
      "Seguros e proteção",
      "Energia solar e sustentabilidade",
    ],
    defaultFeedback:
      "Bom sinal. Identificar afinidade com um mercado ajuda no início da operação.",
  },
  {
    id: "operacao",
    eyebrow: "Etapa 05 · A operação na prática",
    title: "Como funciona uma operação Velox.",
    message:
      "Toda operação segue uma lógica simples, replicável e centrada no cliente. Esse é o método que sustenta o modelo.",
    flow: [
      "Cliente possui uma necessidade financeira.",
      "Franqueado identifica essa necessidade.",
      "Apresenta as soluções disponíveis.",
      "Realiza acompanhamento do processo.",
      "Constrói relacionamento de longo prazo.",
    ],
    videoLabel: "Fluxo de uma operação Velox",
    reflection:
      "Negócios que se sustentam são construídos em ciclos — não em vendas isoladas.",
    question: "Você se sente confortável em conduzir esse ciclo com clientes?",
    options: ["Sim, é o que eu quero fazer", "Preciso me desenvolver nisso", "Ainda tenho receio"],
    defaultFeedback:
      "Perfeito. Esse ciclo é ensinado, treinado e acompanhado pela rede.",
  },
  {
    id: "conhecimento",
    eyebrow: "Etapa 06 · Conhecimento técnico",
    title: "Preciso entender de mercado financeiro para começar?",
    message:
      "A resposta honesta é: não é obrigatório ter experiência prévia. O que é obrigatório é a vontade de aprender de forma contínua.",
    content: [
      "Treinamento inicial estruturado.",
      "Capacitação técnica em produtos e processos.",
      "Universidade corporativa com trilhas de aprendizado.",
      "Suporte próximo da rede e do time central.",
    ],
    reflection:
      "Aprendizado contínuo não é um custo — é a principal vantagem de quem entra em um mercado novo.",
    question: "Você está disposto a aprender uma nova atividade?",
    options: [
      "Sim, estou pronto para estudar",
      "Sim, com apoio e método",
      "Ainda tenho resistência",
    ],
    defaultFeedback:
      "Essa disposição é justamente o que diferencia um franqueado bem-sucedido.",
  },
  {
    id: "dedicacao",
    eyebrow: "Etapa 07 · Tempo de dedicação",
    title: "Todo negócio depende do envolvimento de quem o conduz.",
    message:
      "O tempo dedicado no início influencia diretamente na velocidade de desenvolvimento da operação. Não existe fórmula única, mas existe uma verdade: quanto mais presença, mais tração.",
    reflection:
      "Nenhum negócio cresce sozinho. Ele cresce na mesma proporção da energia colocada nele.",
    question: "Quanto tempo você pretende dedicar ao projeto?",
    options: [
      "Algumas horas por dia (paralelo)",
      "Meio período",
      "Tempo integral",
    ],
    defaultFeedback:
      "Ter clareza sobre o tempo disponível é essencial para desenhar o plano correto de início.",
  },
  {
    id: "investimento",
    eyebrow: "Etapa 08 · Investimento inicial",
    title: "Investimento consciente é diferente de olhar apenas o preço.",
    message:
      "Uma decisão de franquia envolve mais do que um valor de entrada. Envolve organização, planejamento e visão de médio prazo.",
    content: [
      "Taxa de franquia — o direito de usar a marca e o modelo.",
      "Estrutura — o que é necessário para operar com qualidade.",
      "Ferramentas — tecnologia, sistemas e apoio operacional.",
      "Custos operacionais — a rotina financeira do negócio.",
      "Organização pessoal — reserva e planejamento do investidor.",
    ],
    reflection:
      "O objetivo não é te empurrar um valor. É te preparar para uma decisão consciente.",
    question: "Como está sua preparação financeira hoje?",
    options: [
      "Tenho o investimento disponível",
      "Tenho parte e estou me organizando",
      "Ainda preciso estruturar",
    ],
    defaultFeedback:
      "Transparência sobre o momento financeiro evita frustrações e acelera boas decisões.",
  },
  {
    id: "perfilSim",
    eyebrow: "Etapa 09 · Quem deve considerar",
    title: "Quem deve considerar uma franquia?",
    message:
      "Existem características que aparecem com frequência entre franqueados que se desenvolvem bem no modelo Velox.",
    content: [
      "Busca autonomia e não teto.",
      "Tem disciplina para seguir um método.",
      "Gosta de relacionamento e de pessoas.",
      "Quer aprender continuamente.",
      "Aceita desafios como parte do jogo.",
    ],
    reflection: "Você não precisa ter todas — precisa estar disposto a desenvolvê-las.",
    question: "Com quantas dessas características você se identifica?",
    options: [
      "Com todas ou quase todas",
      "Com algumas delas",
      "Com poucas, mas quero desenvolver",
    ],
    defaultFeedback: "Autoconhecimento honesto vale mais do que respostas ideais.",
  },
  {
    id: "perfilNao",
    eyebrow: "Etapa 10 · Quando não é o momento",
    title: "Ser transparente também é parte da nossa jornada.",
    message:
      "Uma franquia não é para todo mundo — e tudo bem. Preferimos que você entenda isso agora, e não depois.",
    content: [
      "Não é indicado para quem busca dinheiro rápido.",
      "Não é indicado para quem não quer se envolver.",
      "Não é indicado para quem não deseja aprender.",
      "Não é indicado para quem espera resultado sem execução.",
    ],
    reflection:
      "Se algum desses pontos incomodou, é sinal de honestidade — não de eliminação.",
    question: "Depois de ler isso, como você se sente?",
    options: [
      "Mais seguro para seguir",
      "Preciso refletir com calma",
      "Percebi que não é o meu momento",
    ],
    defaultFeedback:
      "Qualquer resposta aqui é válida. Clareza é sempre melhor do que ilusão.",
  },
];

const finalStepEyebrow = "Etapa 11 · Vamos entender o seu momento";
const concludeStepEyebrow = "Etapa 12 · Próximo passo";

function Journey() {
  const total = steps.length + 2; // + form + conclusion
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ nome: "", whatsapp: "", cidade: "", objetivo: "" });
  const [started, setStarted] = useState(false);

  const progress = useMemo(
    () => Math.round(((current + (started ? 1 : 0)) / total) * 100),
    [current, started, total],
  );

  const isForm = current === steps.length;
  const isConclusion = current === steps.length + 1;
  const step = current < steps.length ? steps[current] : null;
  const currentAnswer = step ? answers[step.id] : undefined;

  function next() {
    if (current < steps.length + 1) setCurrent(current + 1);
  }
  function back() {
    if (current > 0) setCurrent(current - 1);
  }

  const objetivoOptions = [
    "Construir meu próprio negócio",
    "Ter uma segunda fonte de renda",
    "Substituir minha renda atual",
    "Investir em algo próprio",
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCurrent(steps.length + 1);
  }

  function sendWhatsapp() {
    const linhas = [
      "Olá! Concluí a jornada do Manual do Investidor Velox e gostaria de conversar com um especialista.",
      "",
      `Nome: ${form.nome}`,
      `WhatsApp: ${form.whatsapp}`,
      `Cidade/Estado: ${form.cidade}`,
      `Objetivo principal: ${form.objetivo}`,
      "",
      "Respostas da jornada:",
      ...steps
        .filter((s) => s.question)
        .map((s, i) => `${i + 1}. ${s.question} → ${answers[s.id] ?? "—"}`),
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
            Uma jornada para você <span className="text-[var(--gold)]">entender antes de decidir</span>.
          </h1>
          <p className="mt-6 max-w-xl text-base text-white/70 sm:text-lg">
            Nas próximas etapas você vai conhecer o que é uma franquia, como funciona a operação Velox,
            quais responsabilidades existem e qual perfil combina com esse modelo. Uma jornada
            educativa, sem venda agressiva.
          </p>
          <div className="mt-8 grid w-full max-w-md grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {[
              { t: "12 etapas", d: "Conteúdo guiado" },
              { t: "~6 min", d: "De aprendizado" },
              { t: "Transparente", d: "Educação, não venda" },
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

            <h2 className="mt-4 font-[var(--font-display)] text-2xl leading-snug text-white sm:text-3xl">
              {step.title}
            </h2>

            <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
              {step.message}
            </p>

            {step.videoLabel && <VideoSlot label={step.videoLabel} />}

            {step.content && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--gold-soft)]">
                  <BookOpen className="h-3.5 w-3.5" /> Conteúdo
                </div>
                <ul className="mt-3 space-y-2.5">
                  {step.content.map((c) => (
                    <li key={c} className="flex gap-3 text-sm text-white/80">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step.flow && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--gold-soft)]">
                  <BookOpen className="h-3.5 w-3.5" /> Fluxo da operação
                </div>
                <ol className="mt-4 space-y-3">
                  {step.flow.map((f, i) => (
                    <li key={f} className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 text-xs font-semibold text-[var(--gold)]">
                        {i + 1}
                      </span>
                      <span className="pt-1 text-sm text-white/80">{f}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {step.reflection && (
              <div className="mt-6 flex gap-3 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.06] p-5">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
                <p className="text-sm italic leading-relaxed text-white/85">{step.reflection}</p>
              </div>
            )}

            {step.question && step.options && (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                <h3 className="text-base font-medium text-white sm:text-lg">{step.question}</h3>
                <div className="mt-4 grid gap-2.5">
                  {step.options.map((opt) => {
                    const selected = currentAnswer === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setAnswers((a) => ({ ...a, [step.id]: opt }))}
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

                {currentAnswer && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-[var(--navy-deep)]/60 px-4 py-3 text-sm text-white/75 animate-in fade-in duration-500">
                    <span className="mr-1 font-semibold text-[var(--gold-soft)]">Reflexão:</span>
                    {step.feedback?.[currentAnswer] ?? step.defaultFeedback}
                  </div>
                )}
              </div>
            )}

            <NavButtons
              onBack={current > 0 ? back : undefined}
              onNext={next}
              nextDisabled={!!step.question && !currentAnswer}
              nextLabel="Continuar jornada"
            />
          </article>
        )}

        {isForm && (
          <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-soft)]">
              {finalStepEyebrow}
            </span>
            <h2 className="mt-4 font-[var(--font-display)] text-2xl leading-snug text-white sm:text-3xl">
              Agora vamos entender o seu momento.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
              Você percorreu o conteúdo educativo. Para personalizar a próxima etapa,
              precisamos de algumas informações rápidas.
            </p>

            <VideoSlot label="Mensagem do consultor antes da conversa" />

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
                  label="Cidade / Estado"
                  value={form.cidade}
                  onChange={(v) => setForm((f) => ({ ...f, cidade: v }))}
                  placeholder="Ex.: São José do Rio Preto / SP"
                />
                <Field
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))}
                  placeholder="(DDD) 9 0000-0000"
                  type="tel"
                />

                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-white/60">
                    Objetivo principal
                  </span>
                  <div className="mt-2 grid gap-2">
                    {objetivoOptions.map((opt) => {
                      const selected = form.objetivo === opt;
                      return (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setForm((f) => ({ ...f, objetivo: opt }))}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                            selected
                              ? "border-[var(--gold)] bg-[var(--gold)]/10 text-white"
                              : "border-white/10 bg-white/[0.02] text-white/80 hover:border-white/30"
                          }`}
                        >
                          <span>{opt}</span>
                          <CheckCircle2
                            className={`h-4 w-4 ${selected ? "text-[var(--gold)]" : "text-white/20"}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!form.nome || !form.whatsapp || !form.cidade || !form.objetivo}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-semibold text-[var(--gold-foreground)] shadow-lg shadow-[var(--gold)]/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Concluir jornada <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-white/50">
                <ShieldCheck className="h-3.5 w-3.5" /> Suas informações são usadas apenas para
                preparar sua conversa com o especialista.
              </p>
            </form>

            <NavButtons onBack={back} onNext={() => {}} hideNext />
          </article>
        )}

        {isConclusion && (
          <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-soft)]">
              {concludeStepEyebrow}
            </span>
            <h2 className="mt-4 font-[var(--font-display)] text-3xl leading-snug text-white sm:text-4xl">
              Parabéns por concluir essa jornada, {form.nome.split(" ")[0] || "investidor"}.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
              Agora você já possui uma visão mais clara sobre franquias, operação e o modelo Velox.
              O próximo passo é conversar com um especialista para tirar dúvidas específicas e
              avaliar se esse modelo faz sentido para você.
            </p>

            <VideoSlot label="Mensagem final do especialista Velox" />

            <div className="mt-6 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/[0.06] p-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-soft)]">
                O que levar para essa conversa
              </div>
              <ul className="mt-3 space-y-2 text-sm text-white/85">
                <li>• Perguntas específicas que surgiram durante a jornada.</li>
                <li>• Seu momento atual — pessoal, profissional e financeiro.</li>
                <li>• A expectativa realista sobre tempo e dedicação.</li>
              </ul>
            </div>

            <button
              onClick={sendWhatsapp}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-4 text-sm font-semibold text-[var(--gold-foreground)] shadow-lg shadow-[var(--gold)]/20 transition hover:brightness-105"
            >
              Conversar pelo WhatsApp <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-white/50">
              <ShieldCheck className="h-3.5 w-3.5" /> Suas respostas serão levadas para o especialista.
            </p>

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