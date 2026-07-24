import {
  Building2,
  Sparkles,
  Handshake,
  Users,
  GraduationCap,
  Cpu,
  ShieldCheck,
  Layers,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Clock,
  MapPin,
  Sun,
  Sunset,
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

// --- 2. Velox
function VeloxBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat value="+10" label="anos conectando pessoas às soluções financeiras certas" />
        <Stat value="+100" label="unidades franqueadas em operação no Brasil" />
        <Stat value="+40" label="parceiros homologados no portfólio" />
      </div>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A Velox nasceu para simplificar o acesso a soluções financeiras.
        Conectamos pessoas e empresas aos produtos certos por meio de
        parceiros homologados — bancos, seguradoras, financeiras e
        cooperativas — sob uma metodologia própria de atendimento.
      </p>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-3">
          Propósito
        </p>
        <p className="text-base leading-relaxed">
          Democratizar o acesso a soluções financeiras com transparência,
          orientação e proximidade — tratando cada cliente pelo nome.
        </p>
      </div>
    </>
  );
}

// --- 3. Mercado
function MercadoBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat value="R$ 4,2 tri" label="em crédito no Brasil em 2024 — mercado em expansão" />
        <Stat value="65%" label="dos brasileiros ainda não têm um consultor financeiro de confiança" />
        <Stat value="+7% a.a." label="de crescimento consistente no crédito consignado" />
      </div>
      <p className="text-base leading-relaxed">
        O brasileiro busca crédito, seguros e planejamento — mas tem
        dificuldade em enxergar as opções. Não faltam produtos; falta
        <span className="text-[color:var(--foreground)]"> orientação</span>.
        É nesse ponto que uma franquia Velox se posiciona.
      </p>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed italic">
        Fontes: dados públicos do Banco Central e ABEFIN (2024). Valores
        contextualizados; peça ao consultor a versão detalhada.
      </p>
    </>
  );
}

// --- 4. Modelo
function ModeloBody() {
  const steps = [
    { n: "01", t: "Cliente chega", d: "Pessoa ou empresa precisando de uma solução financeira." },
    { n: "02", t: "Franqueado escuta", d: "Diagnóstico consultivo — sem empurrar produto." },
    { n: "03", t: "Velox direciona", d: "Metodologia + tecnologia identificam o melhor parceiro homologado." },
    { n: "04", t: "Solução entregue", d: "Parceiro fecha a operação. Franqueado recebe comissão." },
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
      <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-5">
        <p className="text-sm leading-relaxed">
          <span className="text-[color:var(--gold)] font-medium">Sem estoque, sem loja física obrigatória.</span>{" "}
          O produto é a solução financeira. O ativo é o relacionamento.
        </p>
      </div>
    </>
  );
}

// --- 5. Diferenciais
function DiferenciaisBody() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <IconCard icon={GraduationCap} title="Treinamento contínuo">
        Universidade Velox com trilhas de formação, atualizações mensais e
        mentoria de negócio ao longo da jornada.
      </IconCard>
      <IconCard icon={Cpu} title="Tecnologia proprietária">
        Plataforma que conecta franqueado, cliente e parceiros — CRM,
        simuladores e dashboard de performance.
      </IconCard>
      <IconCard icon={Layers} title="Portfólio amplo">
        Consignado, financiamento, consórcio, seguros, energia solar e
        capital de giro — a mesma base de clientes, várias frentes.
      </IconCard>
      <IconCard icon={ShieldCheck} title="Suporte próximo">
        Consultoria de negócio dedicada, suporte operacional e uma rede de
        franqueados que troca experiências toda semana.
      </IconCard>
    </div>
  );
}

// --- 6. Perfil
function PerfilBody() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-[color:var(--gold)]" />
            <h3 className="font-display text-lg">Faz sentido para você se…</h3>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed">
            <li>• Gosta de conversar e construir relacionamentos.</li>
            <li>• Tem disciplina para seguir uma metodologia.</li>
            <li>• Está disposto a aprender algo novo.</li>
            <li>• Entende que resultados vêm da dedicação.</li>
            <li>• Quer construir um negócio de médio-longo prazo.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-5 w-5 text-[color:var(--muted-foreground)]" />
            <h3 className="font-display text-lg text-[color:var(--muted-foreground)]">
              Talvez ainda não seja o momento se…
            </h3>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            <li>• Busca retorno rápido e sem esforço.</li>
            <li>• Espera que a franquia opere sozinha.</li>
            <li>• Não tem disponibilidade para aprender.</li>
            <li>• Está passando por um momento financeiro apertado.</li>
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

// --- 7. Investimento
function InvestimentoBody() {
  const rows = [
    { item: "Taxa de franquia", value: "Sob consulta", desc: "Direito de operar a marca, metodologia e portfólio Velox." },
    { item: "Implantação", value: "Sob consulta", desc: "Treinamento inicial, materiais e acompanhamento das primeiras semanas." },
    { item: "Estrutura", value: "Flexível", desc: "Home office ou ponto físico — você escolhe o formato do seu momento." },
    { item: "Capital de giro", value: "Recomendado", desc: "Reserva para os primeiros meses até a operação ganhar tração." },
    { item: "Royalties", value: "Transparente", desc: "Percentual claro sobre resultado, apresentado antes de qualquer decisão." },
  ];
  return (
    <>
      <div className="rounded-2xl border border-[color:var(--border)] overflow-hidden">
        {rows.map((r, i) => (
          <div
            key={r.item}
            className={`grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:gap-6 p-5 ${
              i > 0 ? "border-t border-[color:var(--border)]" : ""
            } bg-[color:var(--card)]/30`}
          >
            <div>
              <p className="font-medium">{r.item}</p>
              <p className="text-sm text-[color:var(--muted-foreground)] mt-1 leading-relaxed">
                {r.desc}
              </p>
            </div>
            <div className="text-sm text-[color:var(--gold)] font-medium sm:text-right sm:min-w-[140px]">
              {r.value}
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
        Preferimos apresentar os valores exatos na conversa com o consultor —
        junto com o simulador de retorno e as condições atualizadas de cada
        formato. É a forma mais honesta de você entender o que se aplica ao
        seu caso.
      </p>
    </>
  );
}

// --- 8. Implantação
function ImplantacaoBody() {
  const weeks = [
    { w: "Semana 1", t: "Alinhamento e setup", d: "Assinatura, acessos à plataforma, kit institucional e cronograma personalizado." },
    { w: "Semana 2–3", t: "Treinamento inicial", d: "Imersão em produtos, metodologia de atendimento e uso das ferramentas." },
    { w: "Semana 4", t: "Ativação de mercado", d: "Estratégia de captação, primeiros contatos assistidos e apoio consultivo." },
    { w: "Mês 2 em diante", t: "Operação com suporte", d: "Ritmo de negócio, acompanhamento mensal e trilhas contínuas de evolução." },
  ];
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-[color:var(--border)]" />
      {weeks.map((w) => (
        <div key={w.w} className="relative pb-8 last:pb-0">
          <div className="absolute -left-[19px] top-1.5 h-3 w-3 rounded-full bg-[color:var(--gold)] ring-4 ring-[color:var(--background)]" />
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">{w.w}</p>
          <p className="font-medium mt-1">{w.t}</p>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-1 leading-relaxed">{w.d}</p>
        </div>
      ))}
    </div>
  );
}

// --- 9. Rotina
function RotinaBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <IconCard icon={Sun} title="Manhã">
          Análise de agenda, retorno de clientes ativos e reuniões consultivas
          — presenciais ou por vídeo.
        </IconCard>
        <IconCard icon={Sunset} title="Tarde">
          Prospecção qualificada, envio de propostas, acompanhamento de
          operações em andamento com os parceiros.
        </IconCard>
        <IconCard icon={CalendarDays} title="Semana">
          Encontro com a equipe de suporte Velox, treinamentos e
          participações na comunidade de franqueados.
        </IconCard>
        <IconCard icon={Clock} title="Mês">
          Fechamento de resultados, planejamento do próximo ciclo e ajustes de
          rota com a consultoria de negócio.
        </IconCard>
      </div>
      <p className="text-sm text-[color:var(--muted-foreground)] italic leading-relaxed">
        Não é uma agenda mágica. É uma agenda real — que funciona quando
        cumprida com consistência.
      </p>
    </>
  );
}

// --- 10. FAQ
function FaqBody() {
  const items = [
    {
      q: "Preciso entender de mercado financeiro para começar?",
      a: "Não. A capacitação inicial da Universidade Velox foi desenhada exatamente para desenvolver esse conhecimento — inclusive para quem está começando do zero.",
    },
    {
      q: "Preciso largar meu emprego atual?",
      a: "Não necessariamente. Muitos franqueados começam a operação como segunda fonte de renda e migram integralmente conforme o negócio ganha tração.",
    },
    {
      q: "Existe garantia de faturamento?",
      a: "Não. Nenhuma franquia séria garante resultado. O que a Velox garante é metodologia, suporte, tecnologia e portfólio. O desempenho depende da execução do franqueado.",
    },
    {
      q: "Preciso de ponto físico?",
      a: "Não é obrigatório. Você pode começar em home office e, conforme a operação crescer, avaliar uma estrutura física. A Velox orienta o formato mais adequado ao seu momento.",
    },
    {
      q: "Como funciona o suporte no dia a dia?",
      a: "Você tem um consultor de negócio dedicado, plataforma tecnológica com equipe de sustentação, e acesso à comunidade de franqueados para troca contínua de experiências.",
    },
    {
      q: "Qual o tempo médio para começar a operar?",
      a: "Entre 30 e 45 dias entre a assinatura e a primeira operação assistida — desde que o cronograma de treinamento seja cumprido.",
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

export function ChapterBody({ slug }: { slug: string }) {
  switch (slug) {
    case "velox":
      return <VeloxBody />;
    case "mercado":
      return <MercadoBody />;
    case "modelo":
      return <ModeloBody />;
    case "diferenciais":
      return <DiferenciaisBody />;
    case "perfil":
      return <PerfilBody />;
    case "investimento":
      return <InvestimentoBody />;
    case "implantacao":
      return <ImplantacaoBody />;
    case "rotina":
      return <RotinaBody />;
    case "faq":
      return <FaqBody />;
    default:
      return null;
  }
}
