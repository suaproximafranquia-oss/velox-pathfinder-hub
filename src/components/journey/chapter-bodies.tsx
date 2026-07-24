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
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-1">
        <Stat
          value="+1.400"
          label="unidades comercializadas em todo o Brasil"
        />
      </div>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        A Velox é uma rede de franquias de soluções financeiras. Na prática,
        isso significa que atuamos como um ponto de encontro entre pessoas e
        empresas que precisam de uma solução — crédito, seguro, consórcio,
        planejamento — e instituições que oferecem esse tipo de produto no
        mercado.
      </p>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        O que diferencia a rede é a forma de atender. Em vez de empurrar um
        único produto, o franqueado escuta a necessidade do cliente e, com
        apoio da estrutura da Velox, apresenta as opções mais adequadas
        dentro de um portfólio homologado. É um modelo consultivo, pensado
        para gerar confiança e recorrência ao longo do tempo.
      </p>
      <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
        Os números acumulados ao longo dos anos são reflexo desse trabalho.
        Mais de mil e quatrocentas unidades já foram comercializadas em
        diferentes regiões do Brasil, o que sustenta a base operacional,
        tecnológica e comercial que hoje ampara cada novo franqueado que
        entra na rede.
      </p>
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
      t: "Crédito",
      d: "O portfólio de crédito é o mais amplo da operação. Ele reúne modalidades para pessoas físicas e jurídicas, com condições e prazos que variam conforme o perfil de cada cliente e a instituição parceira.",
      ex: [
        "Crédito consignado",
        "Crédito para servidores públicos",
        "Crédito CLT",
        "Crédito pessoal",
        "Capital de giro",
        "Antecipação de recebíveis",
        "Financiamentos",
        "Operações estruturadas",
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
      t: "Investimentos e planejamento",
      d: "Para clientes que buscam organizar o próprio patrimônio, a rede encaminha soluções estruturadas oferecidas por parceiros especializados. Cada perfil é atendido de forma personalizada, sem promessas de rentabilidade e sempre respeitando as regras do mercado financeiro.",
      ex: [],
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
        Não existe um perfil único de franqueado. Existem, sim, algumas
        características que costumam favorecer a jornada de quem entra
        nesse tipo de operação. A ideia deste capítulo é ajudar você a se
        enxergar com honestidade — nem melhor, nem pior do que é.
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
      q: "O que exatamente está incluso na implantação?",
      a: "Durante a apresentação comercial, um especialista Velox detalha item a item o que compõe o valor de implantação, para que você tenha total visibilidade antes de qualquer decisão — sem letras miúdas nem surpresas depois.",
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