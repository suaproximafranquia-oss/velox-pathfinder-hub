import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  GraduationCap,
  Cpu,
  ShieldCheck,
  Layers,
  CheckCircle2,
  XCircle,
  BookOpen,
  Compass,
  HeartHandshake,
  Users,
  Building2,
  ArrowRight,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-6">
      <div className="font-display text-4xl text-gold-shimmer leading-none">{value}</div>
      <div className="mt-3 text-sm text-[color:var(--muted-foreground)] leading-snug">{label}</div>
    </div>
  );
}

function IconCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 h-full">
      <Icon className="h-6 w-6 text-[color:var(--gold)] mb-4" />
      <h3 className="font-display text-lg mb-2">{title}</h3>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">{children}</p>
    </div>
  );
}

// --- 2. Propósito
function PropositoBody() {
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Toda decisão de investimento carrega uma dose de incerteza. Quanto
        maior a clareza sobre o negócio, menor essa incerteza — e mais
        confortável fica a conversa que vem depois.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <IconCard icon={BookOpen} title="Leitura, não abordagem">
          Você lê no seu ritmo. Nada aqui força uma resposta imediata.
        </IconCard>
        <IconCard icon={Compass} title="Orientação, não venda">
          O material foi pensado para orientar — mesmo que a resposta seja não.
        </IconCard>
        <IconCard icon={HeartHandshake} title="Respeito ao seu tempo">
          Cada capítulo cobre um único tema. Sem repetição, sem excesso.
        </IconCard>
      </div>
      <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-6">
        <p className="text-sm leading-relaxed">
          Ao final, se fizer sentido, existirá um convite para conversar com um
          especialista. Se não fizer, você terá economizado horas de reuniões —
          e essa também é uma vitória.
        </p>
      </div>
    </>
  );
}

// --- 3. Velox
function VeloxBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-1">
        <Stat
          value="+1.400"
          label="unidades comercializadas em todo o Brasil"
        />
      </div>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A Velox nasceu para simplificar o acesso a soluções financeiras.
        Conectamos pessoas e empresas a produtos oferecidos por parceiros
        homologados, com uma metodologia própria de atendimento consultivo.
      </p>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-3">
          Propósito
        </p>
        <p className="text-base leading-relaxed">
          Levar soluções financeiras a mais pessoas — com transparência,
          orientação e proximidade.
        </p>
      </div>
    </>
  );
}

// --- 4. Modelo
function ModeloBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <IconCard icon={Layers} title="Sem estoque">
          O produto é a solução financeira. Não há mercadoria a comprar,
          armazenar ou revender.
        </IconCard>
        <IconCard icon={Building2} title="Formato flexível">
          A operação pode ser conduzida em home office ou em loja física — o
          formato acompanha o momento do franqueado.
        </IconCard>
        <IconCard icon={ShieldCheck} title="Parceiros homologados">
          Bancos, seguradoras, financeiras e demais instituições passam por
          homologação antes de integrar o portfólio.
        </IconCard>
        <IconCard icon={HeartHandshake} title="Relação consultiva">
          O franqueado atua como consultor — escuta a necessidade e apresenta
          a solução mais adequada dentre as disponíveis.
        </IconCard>
      </div>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed italic">
        O ativo do franqueado é o relacionamento e a confiança que constrói
        com cada cliente ao longo do tempo.
      </p>
    </>
  );
}

// --- 5. Produtos
function ProdutosBody() {
  const categorias = [
    { t: "Crédito", d: "Diversas modalidades de crédito para pessoas físicas e jurídicas, oferecidas por instituições parceiras." },
    { t: "Seguros", d: "Proteção patrimonial, pessoal e para pequenos negócios, dentro do portfólio homologado." },
    { t: "Consórcios", d: "Alternativa de aquisição planejada, apresentada de forma consultiva ao cliente." },
    { t: "Investimentos e planejamento", d: "Encaminhamento a soluções de planejamento financeiro por parceiros especializados." },
  ];
  return (
    <>
      <div className="space-y-3">
        {categorias.map((c) => (
          <div
            key={c.t}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
          >
            <p className="font-display text-lg mb-1">{c.t}</p>
            <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">{c.d}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed italic">
        O portfólio é revisado continuamente — categorias específicas e
        condições são apresentadas em detalhe na conversa com um especialista.
      </p>
    </>
  );
}

// --- 6. Operação
function OperacaoBody() {
  const steps = [
    { n: "01", t: "Cliente chega", d: "Uma pessoa ou empresa procura orientação para uma necessidade financeira." },
    { n: "02", t: "Franqueado escuta", d: "Diagnóstico consultivo, sem induzir a nenhum produto específico." },
    { n: "03", t: "Portfólio é consultado", d: "As soluções homologadas mais adequadas são identificadas para o caso." },
    { n: "04", t: "Parceiro entrega", d: "A operação é concretizada com a instituição parceira. O franqueado é remunerado por operação." },
  ];
  return (
    <>
      <div className="space-y-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex gap-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
          >
            <span className="font-display text-2xl text-[color:var(--gold)] w-10 shrink-0">
              {s.n}
            </span>
            <div>
              <p className="font-medium mb-1">{s.t}</p>
              <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
                {s.d}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-[color:var(--muted-foreground)] italic leading-relaxed">
        Não existe uma rotina única. Cada operação possui sua própria
        dinâmica, respeitando a realidade do franqueado e do seu mercado.
      </p>
    </>
  );
}

// --- 7. Investimento
function InvestimentoBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/5 p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
            Franquia Home Office
          </p>
          <p className="font-display text-3xl">R$ 17.900</p>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-3 leading-relaxed">
            Formato inicial recomendado para quem começa sem a estrutura de um
            ponto físico.
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/5 p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
            Franquia Loja Física
          </p>
          <p className="font-display text-3xl">R$ 29.900</p>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-3 leading-relaxed">
            Formato para quem opta por operar com um ponto comercial próprio
            desde o início.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:gap-6 p-5 bg-[color:var(--card)]/30">
          <div>
            <p className="font-medium">Implantação</p>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-1 leading-relaxed">
              Investimento único, referente ao processo de implantação da
              unidade. Durante a apresentação comercial, é detalhado tudo o
              que está incluso nesta etapa.
            </p>
          </div>
          <div className="text-sm text-[color:var(--gold)] font-medium sm:text-right sm:min-w-[140px]">
            R$ 1.480
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:gap-6 p-5 bg-[color:var(--card)]/30 border-t border-[color:var(--border)]">
          <div>
            <p className="font-medium">Royalties</p>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-1 leading-relaxed">
              Valor fixo mensal, independentemente do faturamento — o que
              torna o custo previsível para o franqueado.
            </p>
          </div>
          <div className="text-sm text-[color:var(--gold)] font-medium sm:text-right sm:min-w-[140px]">
            R$ 497 / mês
          </div>
        </div>
      </div>

      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
        Estes são os valores oficiais praticados. Condições comerciais
        específicas, formas de pagamento e demais detalhes são apresentados
        na conversa com um especialista.
      </p>
    </>
  );
}

// --- 8. Treinamento
function TreinamentoBody() {
  const passos = [
    { t: "Assinatura do contrato", d: "Formalização da relação entre a Velox e o novo franqueado." },
    { t: "Implantação", d: "Preparação da unidade e organização dos elementos necessários para o início." },
    { t: "Treinamento obrigatório", d: "Duas semanas de formação estruturada — condição para o início da operação." },
    { t: "Início da operação", d: "Concluído o treinamento, o franqueado inicia oficialmente sua atuação." },
  ];
  return (
    <>
      <div className="relative pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-px bg-[color:var(--border)]" />
        {passos.map((p, i) => (
          <div key={p.t} className="relative pb-8 last:pb-0">
            <div className="absolute -left-[19px] top-1.5 h-3 w-3 rounded-full bg-[color:var(--gold)] ring-4 ring-[color:var(--background)]" />
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
              Etapa {String(i + 1).padStart(2, "0")}
            </p>
            <p className="font-medium mt-1">{p.t}</p>
            <p className="text-sm text-[color:var(--muted-foreground)] mt-1 leading-relaxed">{p.d}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-[color:var(--muted-foreground)] italic leading-relaxed">
        O treinamento é condição para o início da operação — uma escolha da
        Velox para preservar a qualidade do atendimento entregue ao cliente.
      </p>
    </>
  );
}

// --- 9. Suporte
function SuporteBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <IconCard icon={Users} title="Consultor de negócios">
          Cada franqueado é acompanhado por um consultor de negócios, com
          contato contínuo ao longo da operação.
        </IconCard>
        <IconCard icon={GraduationCap} title="Universidade Corporativa">
          Trilhas de formação, atualizações e conteúdos técnicos disponíveis
          para o desenvolvimento contínuo do franqueado.
        </IconCard>
        <IconCard icon={Cpu} title="Estrutura tecnológica">
          Plataforma que apoia o dia a dia da operação e a relação com os
          parceiros homologados.
        </IconCard>
        <IconCard icon={ShieldCheck} title="Rede de franqueados">
          Comunidade ativa de franqueados que compartilha experiência,
          práticas e aprendizados.
        </IconCard>
      </div>
    </>
  );
}

// --- 10. Perfil
function PerfilBody() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-[color:var(--gold)]" />
            <h3 className="font-display text-lg">Costuma se dar bem quem…</h3>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed">
            <li>• Gosta de conversar e construir relacionamentos.</li>
            <li>• Tem disciplina para seguir uma metodologia.</li>
            <li>• Está disposto a aprender continuamente.</li>
            <li>• Entende que resultados vêm da dedicação.</li>
            <li>• Enxerga o negócio no médio e longo prazo.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-5 w-5 text-[color:var(--muted-foreground)]" />
            <h3 className="font-display text-lg text-[color:var(--muted-foreground)]">
              Talvez não seja o momento se…
            </h3>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            <li>• Busca retorno rápido e sem esforço.</li>
            <li>• Espera que a franquia opere sozinha.</li>
            <li>• Não tem disponibilidade para se preparar.</li>
            <li>• Está passando por um momento financeiro delicado.</li>
          </ul>
        </div>
      </div>
      <p className="text-sm italic text-[color:var(--muted-foreground)] leading-relaxed">
        Não existe resposta certa. Existe o momento certo — e ele é diferente
        para cada pessoa.
      </p>
    </>
  );
}

// --- 11. FAQ
function FaqBody() {
  const items = [
    {
      q: "Preciso entender de mercado financeiro para começar?",
      a: "Não. O treinamento obrigatório foi desenhado para preparar franqueados de diferentes origens, inclusive quem nunca atuou neste mercado.",
    },
    {
      q: "Preciso largar meu emprego atual?",
      a: "Não necessariamente. Muitos franqueados iniciam a operação em paralelo à ocupação atual e migram integralmente à medida que o negócio ganha maturidade.",
    },
    {
      q: "Existe garantia de faturamento?",
      a: "Não. Nenhuma franquia séria garante resultado. O que a Velox oferece é metodologia, treinamento, portfólio homologado e suporte contínuo — o desempenho depende da execução do franqueado.",
    },
    {
      q: "Preciso de ponto físico?",
      a: "Não é obrigatório. Existe o formato home office e o formato loja física — a escolha acompanha o momento e o perfil do franqueado.",
    },
    {
      q: "Como funciona o suporte após o início da operação?",
      a: "O franqueado é acompanhado por um consultor de negócios e tem acesso à Universidade Corporativa, ao suporte operacional e à comunidade de franqueados.",
    },
    {
      q: "O que exatamente está incluso na implantação?",
      a: "Durante a apresentação comercial, um especialista Velox detalha item a item o que compõe o valor de implantação — para que não reste nenhuma dúvida antes de qualquer decisão.",
    },
  ];
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((it, i) => (
        <AccordionItem key={i} value={`item-${i}`} className="border-[color:var(--border)]">
          <AccordionTrigger className="text-left font-medium hover:text-[color:var(--gold)] hover:no-underline">
            {it.q}
          </AccordionTrigger>
          <AccordionContent className="text-[color:var(--muted-foreground)] leading-relaxed">
            {it.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// --- 12. Autoavaliação
const QUIZ = [
  {
    q: "Você está buscando construir um negócio de médio/longo prazo?",
    opts: ["Sim, com essa clareza", "Ainda estou avaliando", "Busco retorno rápido"],
  },
  {
    q: "Você tem disponibilidade para se dedicar ao treinamento de duas semanas?",
    opts: ["Sim, sem restrições", "Com alguma organização, sim", "Hoje seria difícil"],
  },
  {
    q: "Você se sente confortável em conduzir conversas consultivas com clientes?",
    opts: ["Sim, é algo que gosto", "Posso desenvolver", "Não é meu perfil"],
  },
  {
    q: "Seu momento financeiro permite iniciar um investimento com previsibilidade?",
    opts: ["Sim, com tranquilidade", "Precisaria planejar", "Não neste momento"],
  },
  {
    q: "Você está aberto a seguir uma metodologia estruturada?",
    opts: ["Sim, faz sentido para mim", "Depende do formato", "Prefiro autonomia total"],
  },
] as const;

function AutoavaliacaoBody() {
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUIZ.map(() => null));

  const answeredCount = answers.filter((a) => a !== null).length;
  const completed = answeredCount === QUIZ.length;

  const score = useMemo(() => {
    const total = answers.reduce<number>((acc, a) => acc + (a === 0 ? 2 : a === 1 ? 1 : 0), 0);
    return total; // 0..10
  }, [answers]);

  const summary = useMemo(() => {
    if (!completed) return null;
    if (score >= 8)
      return "Suas respostas indicam bastante aderência ao perfil que costuma se adaptar bem ao modelo Velox. Uma conversa com um especialista tende a ser produtiva.";
    if (score >= 5)
      return "Existem pontos de aderência importantes e outros que merecem ser conversados. Um especialista pode ajudar a esclarecer o que ainda restar de dúvida.";
    return "Talvez este não seja o momento ideal para você — e reconhecer isso já é uma decisão consciente. Se quiser conversar mesmo assim, o convite segue aberto.";
  }, [completed, score]);

  return (
    <>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
        Nenhuma resposta é enviada. O objetivo é apenas oferecer uma leitura
        pessoal antes de qualquer conversa.
      </p>

      <div className="space-y-6">
        {QUIZ.map((item, qi) => (
          <fieldset
            key={qi}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
          >
            <legend className="px-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
              Pergunta {qi + 1}
            </legend>
            <p className="font-medium mb-4">{item.q}</p>
            <div className="grid gap-2">
              {item.opts.map((opt, oi) => {
                const active = answers[qi] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[qi] = oi;
                        return next;
                      })
                    }
                    className={
                      "text-left rounded-xl border px-4 py-3 text-sm transition-colors " +
                      (active
                        ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 text-[color:var(--foreground)]"
                        : "border-[color:var(--border)] bg-[color:var(--card)]/30 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/30")
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/5 p-6">
        {completed ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
              Sua leitura pessoal
            </p>
            <p className="text-base leading-relaxed">{summary}</p>
            <div className="mt-5">
              <Link
                to="/manual/proximos-passos"
                preload="intent"
                className="group inline-flex items-center gap-3 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-6 py-3 text-sm font-medium text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition-all duration-300"
              >
                Ir para o capítulo final
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
            Responda as {QUIZ.length} perguntas para ver sua leitura pessoal.
            {answeredCount > 0 && ` (${answeredCount}/${QUIZ.length})`}
          </p>
        )}
      </div>
    </>
  );
}

export function ChapterBody({ slug }: { slug: string }) {
  switch (slug) {
    case "proposito":
      return <PropositoBody />;
    case "velox":
      return <VeloxBody />;
    case "modelo":
      return <ModeloBody />;
    case "produtos":
      return <ProdutosBody />;
    case "operacao":
      return <OperacaoBody />;
    case "investimento":
      return <InvestimentoBody />;
    case "treinamento":
      return <TreinamentoBody />;
    case "suporte":
      return <SuporteBody />;
    case "perfil":
      return <PerfilBody />;
    case "faq":
      return <FaqBody />;
    case "autoavaliacao":
      return <AutoavaliacaoBody />;
    default:
      return null;
  }
}

// Sinaliza para a jornada que a autoavaliação controla seu próprio "continuar".
export function hidesContinueFor(slug: string): boolean {
  return slug === "autoavaliacao";
}