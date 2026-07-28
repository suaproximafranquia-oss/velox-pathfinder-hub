import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
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
  Briefcase,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getInterestsProfile,
  saveInterestsProfile,
  type AudienceProfile,
} from "@/lib/interests-profile";

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
        Toda decisão de investimento carrega uma dose de incerteza. Parte
        dessa incerteza é natural e sempre vai existir. Outra parte, no
        entanto, vem simplesmente da falta de informação — e essa nós podemos
        reduzir juntos, antes de qualquer conversa comercial.
      </p>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Foi por isso que criamos este Manual. Em vez de convidar você para
        uma reunião para só então explicar como o negócio funciona, decidimos
        organizar tudo por escrito. Assim, você chega em uma eventual
        conversa já sabendo o essencial — e usa o tempo do especialista para
        esclarecer o que realmente importa no seu caso.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <IconCard icon={BookOpen} title="Leitura, não abordagem">
          Você avança no seu ritmo, sem cronômetros, sem cadastros
          obrigatórios e sem cobranças. Se precisar pausar e voltar depois,
          o Manual continua aqui.
        </IconCard>
        <IconCard icon={Compass} title="Orientação, não venda">
          Nosso objetivo é que você entenda como o modelo funciona — mesmo
          que, ao final, a conclusão seja de que ele não é para você agora.
          Isso também é um resultado válido.
        </IconCard>
        <IconCard icon={HeartHandshake} title="Respeito ao seu tempo">
          Cada capítulo trata de um único tema, com a profundidade
          necessária para ser útil, mas sem exageros. A leitura completa
          leva poucos minutos.
        </IconCard>
      </div>
      <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-6">
        <p className="text-sm leading-relaxed">
          Ao final da leitura, se fizer sentido para você, haverá um convite
          para conversar com um especialista Velox. Se não fizer sentido,
          você terá economizado horas em reuniões e conquistado clareza
          sobre o próprio momento — e essa também é uma vitória.
        </p>
      </div>
    </>
  );
}

// --- 3. Velox
function VeloxBody() {
  const timeline: { year: string; title: string; d: string }[] = [
    {
      year: "Origem",
      title: "Fundação da Velox",
      d: "A Velox nasce da visão de seu fundador, Mário Sérgio, com a proposta de aproximar pessoas e empresas das soluções financeiras disponíveis no mercado por meio de um atendimento consultivo e transparente.",
    },
    {
      year: "Primeiros anos",
      title: "Consolidação da operação",
      d: "Estruturação do modelo de negócio, definição do portfólio de soluções e formação da base metodológica que orienta o atendimento ao cliente até hoje.",
    },
    {
      year: "Crescimento",
      title: "Expansão da rede de franquias",
      d: "Início da expansão nacional por meio do modelo de franquias, levando o atendimento consultivo Velox a diferentes regiões do país.",
    },
    {
      year: "Maturidade",
      title: "Desenvolvimento do ecossistema",
      d: "Ampliação do portfólio de parceiros homologados, fortalecimento da Universidade Corporativa, evolução da plataforma tecnológica e estruturação do suporte contínuo aos franqueados.",
    },
    {
      year: "Hoje",
      title: "+1.400 unidades comercializadas",
      d: "Uma rede consolidada, com presença nacional e quase uma década de atuação sustentando cada nova unidade que entra na operação.",
    },
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          value="+1.400"
          label="unidades comercializadas em todo o Brasil"
        />
        <Stat
          value="~10 anos"
          label="de atuação no mercado de soluções financeiras"
        />
        <Stat
          value="Nacional"
          label="presença por meio da rede de franquias"
        />
      </div>

      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A Velox é uma rede de franquias de soluções financeiras. Conectamos
        clientes — pessoas físicas e empresas — às soluções oferecidas por
        parceiros homologados, atuando de forma consultiva do primeiro
        contato até a concretização de cada operação.
      </p>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Na prática, o franqueado escuta a necessidade do cliente, identifica
        o cenário e direciona cada caso para a solução mais adequada dentro
        do portfólio homologado da rede. É um modelo consultivo, pensado
        para gerar proximidade, confiança e continuidade ao longo do tempo.
      </p>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-3">
          Origem
        </p>
        <h3 className="font-display text-xl mb-3">Como a Velox nasceu</h3>
        <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
          A Velox nasceu da visão de seu fundador, Mário Sérgio, ao
          identificar que grande parte das pessoas e empresas tomava
          decisões financeiras sem acesso a uma orientação clara e
          imparcial. A proposta desde o início foi organizar, em um único
          lugar, um atendimento consultivo capaz de reunir diferentes
          soluções por meio de parceiros especializados — sempre com o
          cliente no centro da conversa.
        </p>
        <p className="mt-4 text-sm text-[color:var(--muted-foreground)] leading-relaxed">
          Desde então, essa forma de trabalhar se traduziu em uma
          metodologia, em uma rede de parceiros homologados e em uma
          estrutura de suporte que hoje sustentam cada franqueado que
          entra na operação.
        </p>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-3">
          Nossa trajetória
        </p>
        <h3 className="font-display text-xl mb-3">
          Uma evolução construída no tempo
        </h3>
        <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
          Ao longo de quase uma década, a Velox amadureceu como marca,
          expandiu sua presença por diferentes regiões do país e
          consolidou um ecossistema de tecnologia, capacitação e suporte
          voltado para dar sustentação à operação de cada franqueado.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[color:var(--muted-foreground)] leading-relaxed">
          <li className="flex gap-3">
            <span className="text-[color:var(--gold)]">•</span>
            Crescimento consistente da rede de franquias em âmbito nacional.
          </li>
          <li className="flex gap-3">
            <span className="text-[color:var(--gold)]">•</span>
            Consolidação da marca Velox como referência em atendimento
            consultivo de soluções financeiras.
          </li>
          <li className="flex gap-3">
            <span className="text-[color:var(--gold)]">•</span>
            Ampliação do ecossistema de parceiros homologados, cobrindo
            diferentes categorias de solução.
          </li>
          <li className="flex gap-3">
            <span className="text-[color:var(--gold)]">•</span>
            Evolução da plataforma tecnológica que apoia o dia a dia da
            operação.
          </li>
          <li className="flex gap-3">
            <span className="text-[color:var(--gold)]">•</span>
            Fortalecimento da Universidade Corporativa e da estrutura de
            suporte contínuo aos franqueados.
          </li>
        </ul>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-4">
          Linha do tempo
        </p>
        <ol className="relative border-l border-[color:var(--gold)]/30 pl-6 space-y-6">
          {timeline.map((m) => (
            <li key={m.title} className="relative">
              <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--gold)]" />
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
                {m.year}
              </p>
              <p className="font-display text-lg mt-1">{m.title}</p>
              <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed mt-1">
                {m.d}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-3">
          Propósito
        </p>
        <p className="text-base leading-relaxed">
          Levar soluções financeiras a mais pessoas, em mais lugares, com
          transparência, orientação e proximidade — colocando o cliente no
          centro da conversa, não o produto.
        </p>
      </div>
    </>
  );
}

// --- 4. Modelo
function ModeloBody() {
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A Velox conecta clientes às soluções oferecidas por parceiros
        homologados, atuando de forma consultiva durante todo o processo.
        Na prática, é um negócio de serviço: não existe mercadoria a
        comprar, estoque para girar ou vitrine para renovar. O que o
        franqueado oferece é orientação — a capacidade de entender a
        necessidade de um cliente e conectá-la à solução certa, dentro de
        um portfólio já homologado pela rede.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <IconCard icon={Layers} title="Sem estoque">
          Como o produto é intangível, não há capital preso em mercadoria,
          nem risco de encalhe ou obsolescência. O investimento se concentra
          em estrutura, preparação e relacionamento.
        </IconCard>
        <IconCard icon={Building2} title="Formato flexível">
          A operação pode começar em home office, com estrutura enxuta, ou
          já em loja física. A escolha acompanha o momento financeiro, o
          perfil e a estratégia de mercado de cada franqueado.
        </IconCard>
        <IconCard icon={ShieldCheck} title="Parceiros homologados">
          A Velox atua por meio de uma ampla rede de parceiros homologados,
          incluindo bancos, seguradoras, administradoras de consórcio,
          empresas de energia solar, clubes de benefícios e outras
          instituições especializadas — permitindo oferecer soluções
          adequadas para diferentes perfis de clientes.
        </IconCard>
        <IconCard icon={HeartHandshake} title="Relação consultiva">
          O franqueado atua como consultor: primeiro entende o cenário do
          cliente e, só então, apresenta a solução mais adequada — o que
          tende a gerar indicação e recompra ao longo do tempo.
        </IconCard>
        <IconCard
          icon={Briefcase}
          title="Portfólio diversificado de soluções financeiras"
        >
          A Velox atua com um portfólio diversificado de soluções
          financeiras, capaz de atender diferentes perfis e necessidades
          de pessoas físicas e jurídicas. O diferencial do franqueado não
          está em oferecer um único produto, mas em compreender a
          realidade de cada cliente, realizar um diagnóstico consultivo e
          direcioná-lo para a solução mais adequada dentro do ecossistema
          da Velox e de seus parceiros homologados.
        </IconCard>
        <IconCard icon={ShieldCheck} title="Suporte contínuo da rede">
          O franqueado nunca opera sozinho. A Velox oferece consultoria
          de negócios dedicada, Universidade Corporativa, tecnologia
          proprietária e uma comunidade ativa de franqueados —
          sustentando a evolução da operação em cada fase.
        </IconCard>
      </div>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A remuneração acompanha essa lógica. O franqueado é remunerado por
        operação concretizada com o parceiro, dentro das condições
        comerciais praticadas por cada instituição. Não há metas impostas de
        forma artificial: existe uma metodologia de trabalho a ser seguida,
        e o resultado acompanha a consistência da execução.
      </p>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed italic">
        Em resumo: o ativo principal do franqueado é o relacionamento e a
        confiança que ele constrói com cada cliente ao longo do tempo.
      </p>
    </>
  );
}

// --- 5. Produtos
function ProdutosBody() {
  const categorias: { t: string; d: string; ex: string[] }[] = [
    {
      t: "Consórcios",
      d: "O consórcio é apresentado como uma alternativa de aquisição planejada, útil para clientes que preferem organizar a compra ao longo do tempo, sem os custos de uma operação de crédito tradicional.",
      ex: [
        "Imóveis",
        "Veículos",
        "Máquinas",
        "Equipamentos",
        "Serviços",
      ],
    },
    {
      t: "Seguros",
      d: "Através de seguradoras parceiras, o franqueado tem acesso a diferentes modalidades de seguros, o que permite atender tanto proteção pessoal e patrimonial quanto necessidades específicas de empresas.",
      ex: [
        "Seguro de vida",
        "Seguro automóvel",
        "Seguro residencial",
        "Seguro empresarial",
        "Seguro de responsabilidade civil",
        "Entre outras modalidades",
      ],
    },
    {
      t: "Energia solar e benefícios",
      d: "Além das soluções financeiras tradicionais, o portfólio inclui produtos oferecidos por parceiros de outros segmentos homologados pela Velox — como empresas de energia solar e clubes de benefícios — que ampliam a capacidade do franqueado de atender diferentes necessidades a partir de uma mesma base de clientes.",
      ex: [
        "Sistemas de energia solar por meio de parceiros",
        "Clubes de benefícios para pessoas físicas e empresas",
      ],
    },
    {
      t: "Crédito",
      d: "O portfólio de crédito é o mais amplo da operação. Ele reúne modalidades para pessoas físicas e jurídicas, com condições e prazos que variam conforme o perfil de cada cliente e a instituição parceira.",
      ex: [
        "Financiamentos",
        "Refinanciamentos",
        "Capital de giro",
        "Antecipação de recebíveis",
        "Crédito consignado",
        "Antecipação do FGTS",
        "Demais operações de crédito para PF e PJ",
      ],
    },
  ];
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        O portfólio da Velox é organizado em quatro grandes categorias. O
        objetivo dessa amplitude é simples: permitir que o franqueado atenda
        diferentes necessidades a partir de uma mesma base de clientes,
        aumentando estabilidade e diversificação ao longo do tempo.
      </p>
      <div className="space-y-3">
        {categorias.map((c) => (
          <div
            key={c.t}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
          >
            <p className="font-display text-lg mb-2">{c.t}</p>
            <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">{c.d}</p>
            {c.ex.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
                  Exemplos
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2 text-sm text-[color:var(--foreground)]/85">
                  {c.ex.map((e) => (
                    <li key={e} className="flex gap-2 leading-snug">
                      <span className="text-[color:var(--gold)]">•</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed italic">
        Os exemplos acima existem apenas para dar visibilidade ao tipo de
        operação realizada. O portfólio é revisado continuamente, e as
        condições comerciais específicas de cada parceiro são apresentadas
        em detalhe na conversa com um especialista.
      </p>
    </>
  );
}

// --- 6. Operação
function OperacaoBody() {
  const steps = [
    {
      n: "01",
      t: "Cliente chega",
      d: "Uma pessoa ou empresa procura orientação para resolver uma necessidade financeira. Pode ser uma demanda por crédito, um seguro, um planejamento — ou apenas uma dúvida que precisa de alguém para escutar.",
    },
    {
      n: "02",
      t: "Franqueado escuta",
      d: "O primeiro movimento não é oferecer produto. É entender o contexto: qual o objetivo do cliente, qual sua realidade financeira, qual o grau de urgência. Sem essa etapa, qualquer proposta é apenas um palpite.",
    },
    {
      n: "03",
      t: "Portfólio é consultado",
      d: "Com o cenário claro, o franqueado consulta o portfólio homologado e identifica quais soluções fazem mais sentido para o caso. Muitas vezes existem várias alternativas — e apresentá-las com transparência é parte do trabalho.",
    },
    {
      n: "04",
      t: "Parceiro entrega",
      d: "Quando o cliente escolhe uma solução, a operação é concretizada junto à instituição parceira responsável. É essa instituição que assume o produto financeiro em si. O franqueado é remunerado por operação, conforme as regras de cada parceiro.",
    },
  ];
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Na prática, a operação de uma franquia Velox segue um fluxo curto e
        muito humano. Todo o valor está na qualidade da conversa entre o
        franqueado e o cliente — o restante é apoio: sistema, portfólio,
        parceiros e processo.
      </p>
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
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Não existe uma rotina única. Alguns franqueados começam o dia
        prospectando, outros atendendo clientes já em fluxo, outros
        estruturando parcerias locais. O modelo respeita a realidade do
        mercado onde a unidade está — e o que se mantém constante é a
        postura consultiva com quem chega até você.
      </p>
    </>
  );
}

// --- 7. Investimento
function InvestimentoBody() {
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Aqui não há entrelinhas. Preferimos mostrar os valores oficiais
        antes de qualquer conversa, para que você avalie com tranquilidade
        se este é o momento certo para você. O que costuma ser detalhado ao
        vivo, na apresentação comercial, é o que compõe cada valor — não
        o valor em si.
      </p>
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
        Estes são os valores oficiais praticados hoje. Formas de pagamento,
        eventuais condições comerciais e o detalhamento completo de cada
        item são apresentados na conversa com um especialista — sempre por
        escrito e sem pressão para decisão imediata.
      </p>
    </>
  );
}

// --- 8. Treinamento
function TreinamentoBody() {
  const passos = [
    {
      t: "Assinatura do contrato",
      d: "É o momento em que a relação entre a Velox e o novo franqueado é formalizada. Todos os termos comerciais e operacionais são apresentados por escrito antes desta etapa.",
    },
    {
      t: "Implantação",
      d: "Fase de preparação da unidade. Envolve a organização dos elementos necessários para o início da operação — do acesso aos sistemas à orientação sobre os primeiros passos comerciais.",
    },
    {
      t: "Treinamento obrigatório",
      d: "Duas semanas de formação estruturada, cobrindo modelo de negócio, portfólio, atendimento consultivo, ferramentas e processos. Essa etapa é condição para o início da operação — sem ela, o franqueado não inicia atendimento.",
    },
    {
      t: "Início da operação",
      d: "Concluído o treinamento, o franqueado inicia oficialmente a atuação já com o acompanhamento do consultor de negócios e o suporte das áreas da Velox.",
    },
  ];
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Do contrato ao primeiro atendimento, existe um caminho estruturado.
        Ele foi desenhado para que ninguém precise começar no improviso — e
        para preservar a qualidade do que a rede entrega ao cliente final.
      </p>
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
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A duração aproximada até o início da operação depende da agenda de
        implantação e do próprio franqueado. O que não muda é a sequência:
        primeiro se aprende, depois se atende. Essa foi uma escolha
        institucional para proteger tanto o franqueado quanto o cliente
        final que confia na marca.
      </p>
    </>
  );
}

// --- 9. Suporte
function SuporteBody() {
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Concluído o treinamento, o franqueado inicia a operação — mas nunca
        sozinho. A partir daí passa a existir uma estrutura contínua de
        acompanhamento, cuja função é ajudar cada unidade a evoluir com
        consistência ao longo do tempo.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <IconCard icon={Users} title="Consultor de negócios">
          Cada franqueado é acompanhado por um consultor de negócios. Ele
          acompanha a evolução da unidade, apoia decisões do dia a dia,
          auxilia em estratégias comerciais, esclarece dúvidas operacionais
          e ajuda o franqueado a manter o foco no que gera resultado.
        </IconCard>
        <IconCard icon={GraduationCap} title="Universidade Corporativa">
          Ambiente estruturado de formação contínua. Reúne treinamentos
          técnicos, comerciais e operacionais, atualizações de portfólio e
          conteúdos que permitem ao franqueado (e à sua equipe) evoluir ao
          longo de toda a operação — não apenas no início.
        </IconCard>
        <IconCard icon={Cpu} title="Estrutura tecnológica">
          A plataforma tecnológica centraliza as ferramentas do dia a dia,
          organiza informações de atendimento e facilita o relacionamento
          com os parceiros homologados. Na prática, é o que reduz o esforço
          operacional e libera tempo para o que importa: o cliente.
        </IconCard>
        <IconCard icon={ShieldCheck} title="Rede Velox">
          O conhecimento da rede é compartilhado principalmente por meio da
          própria Velox — treinamentos, comunicados, reuniões, conteúdos
          institucionais e materiais elaborados pelas áreas responsáveis.
          Isso garante que a informação que chega ao franqueado seja
          consistente e padronizada.
        </IconCard>
      </div>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Cada um desses recursos existe por um motivo específico: reduzir
        erros comuns de quem está começando, acelerar o aprendizado técnico
        e oferecer, todos os dias, um ponto de apoio para as decisões que
        realmente importam.
      </p>
    </>
  );
}

// --- 10. Perfil
function PerfilBody() {
  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A leitura a seguir reúne, de um lado, as características que
        costumam favorecer quem entra nesse tipo de operação e, de outro,
        pontos que merecem uma reflexão adicional antes de decidir. Não é
        um teste de aprovação — é um convite para você se enxergar com
        honestidade.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-[color:var(--gold)]" />
            <h3 className="font-display text-lg">Costuma se adaptar bem quem…</h3>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed">
            <li>• Gosta de conversar com pessoas e valoriza relacionamentos de longo prazo.</li>
            <li>• Tem disciplina para seguir uma metodologia já testada, sem tentar reinventar tudo desde o primeiro dia.</li>
            <li>• Está disposto a aprender de forma contínua, mesmo depois do treinamento inicial.</li>
            <li>• Entende que resultados vêm da constância — e não de um único mês excepcional.</li>
            <li>• Enxerga o negócio no médio e longo prazo, com paciência para amadurecer a operação.</li>
            <li>• Sente-se confortável em atuar de forma consultiva, escutando antes de propor.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-5 w-5 text-[color:var(--muted-foreground)]" />
            <h3 className="font-display text-lg text-[color:var(--muted-foreground)]">
              Pontos que merecem uma reflexão a mais…
            </h3>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
            <li>• Se a expectativa é de retorno imediato, vale conversar antes sobre o tempo natural de maturação da operação.</li>
            <li>• Se a ideia é que a franquia funcione de forma totalmente autônoma, é importante entender o papel ativo esperado do franqueado.</li>
            <li>• Se a agenda atual não permitir dedicar tempo ao treinamento inicial, talvez faça sentido revisitar o momento certo para começar.</li>
            <li>• Se o momento financeiro estiver mais sensível, vale planejar com calma para que o investimento não gere pressão desnecessária.</li>
          </ul>
        </div>
      </div>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Não existe resposta certa aqui. Existe o momento certo — e ele é
        diferente para cada pessoa. Reconhecer o próprio momento com
        honestidade é o primeiro passo para tomar uma decisão que você não
        vai precisar revisar depois.
      </p>
    </>
  );
}

// --- 11. FAQ
function FaqBody() {
  const items = [
    {
      q: "Preciso ter experiência prévia no mercado financeiro?",
      a: "Não. O treinamento obrigatório foi desenhado para preparar franqueados de diferentes origens, inclusive quem nunca teve contato com o setor. O que se espera é disposição para aprender e para seguir a metodologia da rede.",
    },
    {
      q: "Posso começar em home office?",
      a: "Sim. O formato home office existe justamente para permitir uma entrada com estrutura mais enxuta. Muitos franqueados iniciam assim e, com o tempo, avaliam a migração para um ponto físico conforme a evolução da operação.",
    },
    {
      q: "Posso manter meu emprego atual no início?",
      a: "Em muitos casos, sim — desde que exista disponibilidade real para o treinamento e para o início da operação. Cada situação é conversada individualmente, para evitar que o franqueado assuma um compromisso maior do que consegue sustentar.",
    },
    {
      q: "Quanto tempo dura a implantação até eu começar a operar?",
      a: "Depois da assinatura do contrato, acontece a implantação e, em seguida, o treinamento obrigatório de duas semanas. O prazo total varia conforme a agenda de implantação e a disponibilidade do franqueado, mas a sequência é sempre a mesma: primeiro se aprende, depois se atende.",
    },
    {
      q: "Como funciona o treinamento?",
      a: "São duas semanas de formação estruturada, cobrindo modelo de negócio, portfólio de soluções, atendimento consultivo, ferramentas e processos internos. É condição para o início da operação — não existe atendimento a clientes antes de sua conclusão.",
    },
    {
      q: "Quem acompanha meu desenvolvimento depois que eu começo?",
      a: "Cada franqueado passa a contar com um consultor de negócios dedicado, que acompanha a evolução da unidade, apoia decisões comerciais e operacionais e serve de ponto de contato com as áreas da Velox ao longo do tempo.",
    },
    {
      q: "Como o franqueado é remunerado?",
      a: "A remuneração vem das operações concretizadas junto às instituições parceiras homologadas, dentro das condições comerciais praticadas por cada uma. O ganho está diretamente ligado à consistência do atendimento e à qualidade do relacionamento com os clientes.",
    },
    {
      q: "Preciso contratar funcionários para começar?",
      a: "Não é uma exigência para o início. Muitos franqueados começam a operação sozinhos, especialmente no formato home office, e passam a estruturar equipe conforme a operação evolui e a demanda justifica.",
    },
    {
      q: "Que tipo de suporte a Velox oferece durante a operação?",
      a: "Além do consultor de negócios, o franqueado tem acesso à Universidade Corporativa, à plataforma tecnológica de apoio e a comunicados, reuniões e materiais elaborados pelas áreas da Velox — todos com o objetivo de padronizar informação e reduzir erros no dia a dia.",
    },
    {
      q: "Como funciona o relacionamento com os parceiros homologados?",
      a: "As instituições parceiras — bancos, financeiras, seguradoras, administradoras e outras — são homologadas centralmente pela Velox. Isso significa que o franqueado já inicia com um portfólio pronto para ser oferecido, sem precisar prospectar cada parceria por conta própria.",
    },
    {
      q: "Existe garantia de faturamento?",
      a: "Não. Nenhuma franquia séria garante resultado. O que a Velox oferece é metodologia, treinamento, portfólio homologado e suporte contínuo. O desempenho de cada unidade depende da execução do próprio franqueado.",
    },
    {
      q: "Posso atuar em qualquer cidade?",
      a: "As condições de atuação por região são conversadas individualmente na apresentação comercial, considerando a realidade do mercado local e a estrutura da rede. Assim é possível avaliar juntos qual é o melhor cenário para você.",
    },
    {
      q: "Existe exclusividade de território?",
      a: "Regras específicas sobre território e exclusividade dependem do formato de franquia e da praça em análise, e são apresentadas com transparência antes de qualquer decisão. Nada é definido no verbal.",
    },
    {
      q: "Como acontece minha evolução dentro da rede ao longo do tempo?",
      a: "A evolução acontece pela combinação entre a formação continuada oferecida pela rede, o acompanhamento do consultor de negócios e a maturidade que a própria unidade conquista ao longo dos meses de operação.",
    },
    {
      q: "Como acontecem os primeiros atendimentos depois que a operação começa?",
      a: "Logo após o treinamento, o franqueado inicia a operação já com o portfólio homologado disponível e com o consultor de negócios acompanhando de perto. Os primeiros atendimentos costumam vir do próprio círculo de relacionamento, de ações comerciais orientadas pela rede e da prospecção local — sempre dentro da metodologia consultiva ensinada durante o treinamento.",
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
    tag: "objetivos",
    q: "O que mais te aproxima da ideia de empreender com a Velox neste momento?",
    opts: [
      "Construir um negócio próprio com propósito de longo prazo",
      "Diversificar minha atuação profissional",
      "Ainda estou explorando possibilidades",
    ],
  },
  {
    tag: "implantacao",
    q: "Como você enxerga a fase inicial de implantação e treinamento?",
    opts: [
      "Encaro como parte essencial da construção do negócio",
      "Consigo me organizar para dedicar esse período",
      "Precisaria conversar com um consultor para planejar melhor",
    ],
  },
  {
    tag: "consultivo",
    q: "Qual é a sua afinidade com um modelo de trabalho consultivo?",
    opts: [
      "Tenho boa afinidade com atendimento e relacionamento",
      "Não tenho experiência, mas gostaria de desenvolver",
      "Prefiro entender melhor antes de me posicionar",
    ],
  },
  {
    tag: "metodologia",
    q: "Como você se sente em seguir uma metodologia já estruturada?",
    opts: [
      "Faz total sentido para reduzir erros e ganhar tempo",
      "Gosto de seguir método, adaptando ao meu estilo",
      "Prefiro construir minha própria forma de trabalhar",
    ],
  },
  {
    tag: "patrimonio",
    q: "Qual é a sua visão sobre construir patrimônio por meio de um negócio próprio?",
    opts: [
      "Vejo como um dos caminhos mais consistentes",
      "É uma possibilidade que estou avaliando com calma",
      "Ainda estou formando minha visão sobre isso",
    ],
  },
  {
    tag: "momento",
    q: "Como você descreveria o seu momento atual para iniciar um investimento?",
    opts: [
      "Já é um momento adequado para dar um próximo passo",
      "Preciso planejar alguns detalhes antes",
      "Estou em fase de estudo e ainda sem definição",
    ],
  },
  {
    tag: "conversa",
    q: "Após esta leitura, qual é o seu interesse em continuar a conversa?",
    opts: [
      "Gostaria de conversar com um especialista Velox",
      "Gostaria de aprofundar mais alguns pontos antes",
      "Ainda estou apenas conhecendo o modelo",
    ],
  },
] as const;

function AutoavaliacaoBody() {
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUIZ.map(() => null));

  const answeredCount = answers.filter((a) => a !== null).length;
  const completed = answeredCount === QUIZ.length;

  const reading = useMemo(() => {
    if (!completed) return null;
    const tendencies: string[] = [];
    const byTag = (tag: string) => {
      const idx = QUIZ.findIndex((q) => q.tag === tag);
      return answers[idx];
    };
    if (byTag("objetivos") === 0)
      tendencies.push("uma visão de longo prazo sobre empreender");
    else if (byTag("objetivos") === 1)
      tendencies.push("o desejo de diversificar sua atuação profissional");
    else tendencies.push("um momento saudável de exploração");
    if (byTag("implantacao") !== 2)
      tendencies.push("abertura para dedicar-se à fase inicial de preparação");
    if (byTag("consultivo") === 0)
      tendencies.push("afinidade natural com um modelo consultivo");
    else if (byTag("consultivo") === 1)
      tendencies.push("disposição para desenvolver o lado consultivo do negócio");
    if (byTag("metodologia") !== 2)
      tendencies.push("valorização por uma metodologia estruturada");
    if (byTag("patrimonio") === 0)
      tendencies.push("uma visão clara sobre construção de patrimônio");
    if (byTag("momento") === 0)
      tendencies.push("um momento que parece favorável para um próximo passo");
    else if (byTag("momento") === 1)
      tendencies.push("um momento que pede planejamento antes de decidir");

    const opener =
      "Sua leitura indica " +
      (tendencies.length > 1
        ? tendencies.slice(0, -1).join(", ") + " e " + tendencies[tendencies.length - 1]
        : tendencies[0]) +
      ".";

    const closer =
      byTag("conversa") === 0
        ? "Como você já sinalizou interesse em conversar, um especialista Velox pode aprofundar exatamente os pontos que ainda merecem clareza."
        : byTag("conversa") === 1
          ? "Faz sentido aprofundar mais alguns pontos antes de decidir. Uma conversa consultiva pode ajudar exatamente nesse esclarecimento — sem qualquer compromisso."
          : "Conhecer com calma faz parte do processo. Quando fizer sentido, uma conversa breve pode ajudar a organizar as próximas reflexões.";

    return `${opener} Cada pessoa vive um momento diferente, e o objetivo aqui é apenas ajudar você a tomar uma decisão consciente. ${closer}`;
  }, [answers, completed]);

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
              Sua leitura personalizada
            </p>
            <p className="text-base leading-relaxed">{reading}</p>
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
    case "personalizando-sua-jornada":
      return <PersonalizandoJornadaBody />;
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

// Sinaliza para a jornada capítulos que controlam seu próprio "continuar".
export function hidesContinueFor(slug: string): boolean {
  return slug === "autoavaliacao" || slug === "personalizando-sua-jornada";
}

// --- 6. Personalizando sua jornada
const PRODUCT_GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Pessoa Física",
    items: [
      "Crédito Consignado",
      "Crédito Pessoal",
      "Financiamento de Veículo",
      "Financiamento Imobiliário",
      "Consórcio de Imóvel",
      "Consórcio de Veículo",
      "Seguro de Vida",
      "Seguro Automóvel",
      "Seguro Residencial",
      "Energia Solar Residencial",
      "Antecipação do FGTS",
      "Investimentos e Previdência",
    ],
  },
  {
    title: "Pessoa Jurídica",
    items: [
      "Capital de Giro",
      "Antecipação de Recebíveis",
      "Crédito Empresarial",
      "Consórcio Empresarial",
      "Seguro Empresarial",
      "Energia Solar Empresarial",
      "Máquinas de Cartão",
      "Planos de Saúde Empresarial",
    ],
  },
  {
    title: "Outros interesses",
    items: [
      "Planejamento Financeiro",
      "Educação Financeira",
      "Clube de Benefícios",
      "Ainda estou explorando",
    ],
  },
];

function PersonalizandoJornadaBody() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState<AudienceProfile | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = getInterestsProfile();
    if (existing) {
      setAudience(existing.audience);
      setInterests(existing.interests);
      setSaved(true);
    }
  }, []);

  const toggle = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
    setSaved(false);
  };

  const chooseAudience = (a: AudienceProfile) => {
    setAudience(a);
    setSaved(false);
  };

  const handleContinue = () => {
    saveInterestsProfile({ audience, interests });
    setSaved(true);
    navigate({ to: "/manual/operacao" });
  };

  const audienceOptions: { value: AudienceProfile; label: string; d: string }[] = [
    { value: "pf", label: "Pessoa Física", d: "Atendimento consultivo para indivíduos e famílias." },
    { value: "pj", label: "Pessoa Jurídica", d: "Soluções voltadas ao dia a dia da sua empresa." },
    { value: "ambos", label: "Ambos", d: "Interesse tanto no perfil pessoal quanto empresarial." },
  ];

  return (
    <>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Nada aqui é obrigatório. As respostas ficam guardadas discretamente
        para que o especialista Velox chegue à conversa já entendendo o que
        despertou seu interesse — evitando repetir informações e otimizando
        seu tempo.
      </p>

      <section className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
            Pergunta 1
          </p>
          <h3 className="font-display text-xl">
            Você tem interesse em soluções para qual perfil?
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {audienceOptions.map((opt) => {
            const active = audience === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => chooseAudience(opt.value)}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  active
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 shadow-[0_10px_30px_-15px_var(--gold)]"
                    : "border-[color:var(--border)] bg-[color:var(--card)]/40 hover:border-[color:var(--gold)]/50"
                }`}
              >
                <p className="font-display text-lg mb-1">{opt.label}</p>
                <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
                  {opt.d}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
            Pergunta 2
          </p>
          <h3 className="font-display text-xl">
            Quais soluções despertaram mais o seu interesse?
          </h3>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-1">
            Selecione quantas quiser. Você pode alterar depois.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PRODUCT_GROUPS.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5"
            >
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-3">
                {group.title}
              </p>
              <ul className="space-y-2">
                {group.items.map((item) => {
                  const active = interests.includes(item);
                  return (
                    <li key={item}>
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        className={`w-full text-left flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-[color:var(--gold)]/15 text-[color:var(--foreground)]"
                            : "hover:bg-[color:var(--card)]/60 text-[color:var(--foreground)]/85"
                        }`}
                      >
                        <span
                          className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            active
                              ? "bg-[color:var(--gold)] border-[color:var(--gold)]"
                              : "border-[color:var(--border)]"
                          }`}
                          aria-hidden
                        >
                          {active && (
                            <CheckCircle2 className="h-3 w-3 text-[color:var(--gold-foreground)]" />
                          )}
                        </span>
                        <span className="leading-snug">{item}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {saved && (
        <p className="text-sm text-[color:var(--gold)] italic">
          Preferências registradas. Você pode continuar quando quiser.
        </p>
      )}

      <div className="mt-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/manual/produtos"
          preload="intent"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors self-start"
        >
          ← Voltar ao capítulo anterior
        </Link>
        <button
          type="button"
          onClick={handleContinue}
          className="group inline-flex items-center justify-center gap-3 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/5 px-7 py-3.5 text-sm font-medium text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition-all duration-300 hover:shadow-[0_10px_40px_-10px_var(--gold)]"
        >
          {audience || interests.length > 0 ? "Salvar e continuar" : "Pular e continuar"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </>
  );
}