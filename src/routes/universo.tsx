import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ModuleChrome, type ModuleChromeSection } from "@/components/editorial/module-chrome";
import { BackToTop } from "@/components/site/BackToTop";
import { Reveal } from "@/components/site/Reveal";
import { VMark } from "@/components/site/VMark";
import {
  ChapterCover,
  EditorialSection,
  FeaturePanel,
  StatBand,
  ProductGrid,
  TimelineRail,
  Gallery,
  Pullquote,
  SectionShell,
  Eyebrow,
  type Product,
  type RailItem,
  type GalleryItem,
} from "@/components/site/v2";

import heroImg from "@/assets/editorial/velox-sede.jpg.asset.json";
import founderImg from "@/assets/editorial/mario-sergio.png.asset.json";
import lojaFachadaImg from "@/assets/editorial/velox-loja-fachada.jpg.asset.json";
import lojaFachada2Img from "@/assets/editorial/velox-loja-fachada2.jpg.asset.json";
import lojaInauguracaoImg from "@/assets/editorial/velox-loja-inauguracao.jpg.asset.json";
import treinamentoImg from "@/assets/editorial/velox-treinamento.png.asset.json";
import ciroImg from "@/assets/editorial/velox-ciro-bottini.png.asset.json";
import decisaoImg from "@/assets/editorial/velox-decisao-ref.png.asset.json";
import relationshipImg from "@/assets/editorial/relationship.jpg.asset.json";
import marketImg from "@/assets/editorial/market.jpg.asset.json";
import consumerImg from "@/assets/editorial/consumer.jpg.asset.json";
import collabImg from "@/assets/editorial/collab.jpg.asset.json";
import techImg from "@/assets/editorial/tech.jpg.asset.json";
import closingImg from "@/assets/editorial/closing.jpg.asset.json";
import executivosImg from "@/assets/editorial/velox-executivos.png.asset.json";
import larissaImg from "@/assets/editorial/velox-larissa.png.asset.json";
import parceirosImg from "@/assets/editorial/velox-parceiros.png.asset.json";
import marioConsultoresImg from "@/assets/editorial/velox-mario-consultores.png.asset.json";
import homeOfficeImg from "@/assets/editorial/velox-home-office.jpg.asset.json";

export const Route = createFileRoute("/universo")({
  component: Index,
});

const SECTIONS: ModuleChromeSection[] = [
  { id: "capa", label: "Capa" },
  { id: "carta", label: "Carta de Boas-vindas" },
  { id: "manual", label: "Como utilizar este manual" },
  { id: "antes", label: "Antes de falar da Velox" },
  { id: "velox", label: "Quem é a Velox" },
  { id: "parcerias", label: "Nossa forma de construir parcerias" },
  { id: "valores", label: "Nossos valores" },
  { id: "mercado", label: "Panorama do mercado" },
  { id: "consumidor", label: "Evolução do consumidor" },
  { id: "ecossistema", label: "Ecossistema Velox" },
  { id: "especialidades", label: "Frentes especializadas" },
  { id: "parceiros", label: "Parceiros estratégicos" },
  { id: "implantacao", label: "Processo de implantação" },
  { id: "equipe", label: "Equipe de suporte" },
  { id: "consultoria", label: "Consultoria de negócios" },
  { id: "universidade", label: "Universidade Corporativa" },
  { id: "tecnologia", label: "Plataforma tecnológica" },
  { id: "comunidade", label: "Comunidade de franqueados" },
  { id: "franquia", label: "Modelos de franquia" },
  { id: "investimento", label: "Investimento" },
  { id: "processo", label: "Como funciona o processo" },
  { id: "etapas", label: "Próximas etapas" },
  { id: "encerramento", label: "Contato" },
];

const PRODUCTS: Product[] = [
  {
    name: "FGTS · Antecipação",
    description:
      "Antecipação do saque-aniversário para trabalhadores CLT com saldo disponível. Costuma ser a porta de entrada para clientes que buscam liquidez imediata sem comprometer o orçamento mensal.",
    commission: "Comissão até 25%",
  },
  {
    name: "Cartão de Crédito Consignado",
    description:
      "Solução voltada a aposentados, pensionistas e servidores, com desconto em folha. Oferece limite dedicado, portabilidade de dívida e uma das maiores rentabilidades do portfólio para a rede.",
    commission: "Comissão até 40%",
  },
  {
    name: "Financiamento Imobiliário",
    description:
      "Linhas de crédito para aquisição de imóveis, integrando mais de dez instituições financeiras. Estruturado em prazos longos, com condições ajustadas ao perfil e à capacidade de pagamento de cada cliente.",
    commission: "Comissão até 2,5%",
  },
  {
    name: "Home Equity",
    description:
      "Crédito com garantia de imóvel, indicado para reestruturação de dívidas, capital para negócios ou realização de projetos de maior porte. Combina prazos alongados e taxas mais acessíveis que o crédito tradicional.",
    commission: "Comissão até 5%",
  },
  {
    name: "Financiamento e Refin de Veículos",
    description:
      "Aquisição, refinanciamento e portabilidade de contratos de veículos leves, motos, patinetes elétricos e caminhões. Atende tanto o consumidor final quanto frotistas e pequenas empresas.",
    commission: "Comissão até 2,5%",
  },
  {
    name: "Consórcios",
    description:
      "Aquisição planejada de imóveis, veículos, caminhões, motos, aeronaves e até serviços como viagens, cirurgias e casamentos. Alternativa organizada ao crédito tradicional, com juros mais acessíveis.",
    commission: "Comissão até 6%",
  },
  {
    name: "Energia Solar & Renováveis",
    description:
      "Projetos fotovoltaicos, usinas de investimento e crédito de carbono. Atende famílias, empresas e produtores rurais interessados em previsibilidade de custos e transição energética.",
    commission: "Comissão até 8%",
  },
  {
    name: "Crédito Empresarial & Capital de Giro",
    description:
      "Antecipação de recebíveis, desconto de cheque, antecipação de contratos, financiamento a fornecedores, operações CCB e serviços de trust. Sustenta operações e viabiliza ciclos de crescimento.",
    commission: "Comissão até 1%",
  },
  {
    name: "Crédito Rural & Agronegócio",
    description:
      "Compra de propriedades, maquinário, empréstimos com garantia rural e estruturação de projetos para o campo. Apoia custeio, investimento e comercialização em toda a cadeia produtiva.",
    commission: "Comissão até 1%",
  },
  {
    name: "Seguros",
    description:
      "Mais de 180 tipos de seguros em mais de 30 categorias, das principais seguradoras do mundo. Compõem a base de qualquer planejamento financeiro consistente ao mitigar riscos.",
    commission: "Comissão até 80%",
  },
  {
    name: "Maquininhas & Meios de Pagamento",
    description:
      "P.O.S. para estabelecimentos comerciais, com remuneração recorrente conforme o faturamento do cliente. Fortalece a base de receita mensal previsível da unidade.",
    commission: "Recorrência 0,10% a 0,50%",
  },
  {
    name: "Crédito Consignado",
    description:
      "Modalidade de crédito com pagamento vinculado à folha, contemplando INSS, LOAS, Amparo Social, servidores federais, estaduais, forças armadas e trabalhadores CLT. Combina previsibilidade, taxas competitivas e organização do orçamento pessoal.",
    commission: "Comissão até 10%",
  },
];

const SPECIALTIES: {
  name: string;
  eyebrow: string;
  description: string;
  highlight: string;
}[] = [
  {
    eyebrow: "Frente institucional",
    name: "Velox Asset",
    description:
      "Escritório de finanças e investimentos ligado aos principais FIDCs do Brasil. Estrutura operações de crédito e antecipação de recebíveis para empresas com faturamento anual mínimo de R$ 10 milhões e transações a partir de R$ 500 mil, atendendo indústria, saúde, serviços, agronegócio, infraestrutura e construção civil.",
    highlight: "Comissão de 1% a 4% · Operações em CRI, CRA, CCB e capital de giro",
  },
  {
    eyebrow: "Frente institucional",
    name: "Velox Precatórios",
    description:
      "Intermediação profissional entre credores de precatórios e fundos especializados. A plataforma cuida da análise jurídica, elaboração da escritura, negociação com fundos e liberação do pagamento — o franqueado conduz a prospecção, o cadastro e a proposta ao cliente. Ciclo de operação entre 10 e 20 dias úteis.",
    highlight: "Comissão de 1% a 5% · Mercado com estoque superior a R$ 200 bilhões",
  },
  {
    eyebrow: "Frente institucional",
    name: "Fundo Velox (Advance)",
    description:
      "Financiamento estruturado para projetos de grande porte no Brasil, Paraguai e Uruguai. Atende agronegócio (aquisição de fazendas, irrigação, silos, maquinário), construção civil, energia sustentável (fotovoltaica, PCHs, eólica), saúde, indústria, óleo & gás e infraestrutura privada (portos, ferrovias, rodovias).",
    highlight: "Soluções customizadas · Presença internacional no Mercosul",
  },
  {
    eyebrow: "Frente institucional",
    name: "Hulp Benefícios",
    description:
      "Cartão de benefícios com planos Prata, Ouro e Platinum: cobertura para morte natural e acidental, invalidez, auxílio funeral com translado nacional, sorteios mensais, telemedicina ilimitada e descontos de até 40% em medicamentos em mais de 40 mil farmácias. Voltado a famílias e empresas que valorizam o bem-estar dos colaboradores.",
    highlight: "Recorrência de 0,30% a 1,20% · Rede com mais de 40 mil farmácias",
  },
];

const NEXT_STEPS: RailItem[] = [
  {
    marker: "01",
    meta: "Etapa 01",
    title: "Leitura do manual",
    description:
      "Percorra este material com calma. Ele foi elaborado para apresentar a empresa, o mercado e o modelo de negócio de forma clara e completa.",
  },
  {
    marker: "02",
    meta: "Etapa 02",
    title: "Conversa com nossa equipe",
    description:
      "Após a leitura, agende uma conversa para esclarecer dúvidas, aprofundar temas específicos e conhecer melhor a estrutura oferecida.",
  },
  {
    marker: "03",
    meta: "Etapa 03",
    title: "Análise de perfil",
    description:
      "Um processo de escuta e avaliação mútua, no qual entendemos seus objetivos e você compreende como a operação funciona no dia a dia.",
  },
  {
    marker: "04",
    meta: "Etapa 04",
    title: "Formalização da parceria",
    description:
      "Etapa contratual conduzida com transparência, seguida do início do plano de implantação e do acompanhamento pela equipe de suporte.",
  },
];

const VALORES: { title: string; body: string }[] = [
  {
    title: "Transparência",
    body: "Acreditamos que relações duradouras são construídas por meio de informações claras, comunicação aberta e respeito às decisões de cada pessoa.",
  },
  {
    title: "Compromisso",
    body: "Assumimos responsabilidade pelas orientações que oferecemos e buscamos atuar com seriedade em todas as etapas da parceria.",
  },
  {
    title: "Relacionamento",
    body: "Valorizamos o contato próximo, o diálogo constante e a construção de confiança ao longo do tempo.",
  },
  {
    title: "Desenvolvimento Contínuo",
    body: "Entendemos que o aprendizado permanente fortalece pessoas, empresas e resultados.",
  },
  {
    title: "Ética",
    body: "Conduzimos nossas atividades com responsabilidade, respeito às normas e compromisso com uma atuação íntegra.",
  },
  {
    title: "Visão de Longo Prazo",
    body: "Buscamos construir uma rede sólida, sustentável e preparada para crescer de forma consistente ao lado de seus franqueados.",
  },
];

const MANUAL_TOPICS: string[] = [
  "A história da Velox e os princípios que orientam nossa atuação.",
  "Como funciona o mercado de soluções financeiras e por que ele continua em constante expansão.",
  "Nosso ecossistema de produtos e serviços.",
  "A estrutura de suporte oferecida aos franqueados.",
  "Os modelos de franquia disponíveis.",
  "O investimento necessário e o que está incluído.",
  "As próximas etapas para quem desejar aprofundar essa conversa.",
];

const UNIDADES: GalleryItem[] = [
  { src: lojaFachadaImg.url, alt: "Fachada de unidade Velox", caption: "Unidade da rede · Fachada institucional", span: 2 },
  { src: lojaFachada2Img.url, alt: "Fachada de unidade Velox — identidade institucional", caption: "Unidade da rede", span: 1 },
  { src: lojaInauguracaoImg.url, alt: "Inauguração de unidade Velox", caption: "Inauguração · Rede em expansão", span: 1 },
  { src: executivosImg.url, alt: "Executivos de expansão em unidade da rede", caption: "Executivos de Expansão · Velox", span: 2 },
];

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/* ================================================================ */
/*  HERO                                                             */
/* ================================================================ */
function Hero() {
  return (
    <section
      id="capa"
      aria-labelledby="capa-title"
      className="relative isolate flex min-h-dvh items-center overflow-hidden surface-graphite"
    >
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-60" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-25 mix-blend-overlay" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
      >
        <img src={heroImg.url} alt="" className="h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, var(--graphite) 20%, color-mix(in oklab, var(--graphite) 60%, transparent) 55%, transparent 90%), linear-gradient(0deg, var(--graphite), transparent 60%)",
          }}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-1/3 h-[38rem] w-[38rem] rounded-full opacity-40 blur-3xl animate-drift"
        style={{ background: "color-mix(in oklab, var(--brand-blue) 55%, transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 h-[36rem] w-[36rem] rounded-full opacity-40 blur-3xl animate-drift"
        style={{ background: "color-mix(in oklab, var(--brand-orange) 50%, transparent)", animationDelay: "9s" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-8 top-32 hidden h-48 w-48 opacity-30 md:block"
        style={{ color: "var(--brand-orange)" }}
      >
        <VMark className="h-full w-full animate-vfloat" strokeWidth={1} />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-16 px-6 pb-24 pt-40 md:grid-cols-12 md:px-10 md:pb-40 md:pt-48">
        <div className="md:col-span-8">
          <Reveal>
            <div className="flex items-center gap-4">
              <span className="h-px w-12" style={{ background: "var(--brand-orange)" }} aria-hidden="true" />
              <span className="eyebrow eyebrow-on-dark">Edição Institucional · MMXXVI</span>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h1
              id="capa-title"
              className="mt-10 text-balance font-serif leading-[1.02] on-dark"
              style={{ fontSize: "clamp(3rem, 8vw, 7.5rem)" }}
            >
              Manual do<br />
              <span style={{ color: "var(--brand-orange)" }}>Investidor</span>.
            </h1>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-8 font-serif text-2xl italic on-dark-muted sm:text-3xl">
              Velox Soluções Financeiras
            </div>
          </Reveal>
          <Reveal delay={300}>
            <p className="mt-10 max-w-[54ch] text-lg leading-relaxed on-dark-muted md:text-xl">
              Uma publicação institucional sobre nossa história, nosso modelo de negócio e a
              estrutura que impulsiona empreendedores em todo o Brasil.
            </p>
          </Reveal>
        </div>

        <div className="md:col-span-4">
          <Reveal delay={360}>
            <div
              className="relative flex flex-col justify-between gap-12 border p-8 md:h-full md:p-10"
              style={{ borderColor: "var(--on-dark-border)", background: "color-mix(in oklab, var(--ink) 60%, transparent)" }}
            >
              <div>
                <div className="eyebrow eyebrow-on-dark">Sumário</div>
                <div className="mt-6 space-y-4 font-serif text-xl italic on-dark md:text-2xl">
                  <div className="flex items-baseline gap-4">
                    <span className="num text-sm opacity-60">I</span>
                    <span>Apresentação</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="num text-sm opacity-60">II</span>
                    <span>O Mercado</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="num text-sm opacity-60">III</span>
                    <span>Suporte ao Franqueado</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="num text-sm opacity-60">IV</span>
                    <span>Modelos de Franquia</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="num text-sm opacity-60">V</span>
                    <span>Próximos Passos</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-6 text-[0.7rem] uppercase tracking-[0.3em] on-dark-muted" style={{ borderColor: "var(--on-dark-border)" }}>
                <span>V Capítulos</span>
                <span>MMXXVI</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Bottom hairline */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-orange), transparent)" }}
      />
    </section>
  );
}

/* ================================================================ */
/*  INDEX                                                            */
/* ================================================================ */
function Index() {
  const active = useScrollSpy(SECTIONS.map((s) => s.id));

  return (
    <div className="min-h-dvh text-foreground">
      <ReadingProgress />
      <SiteNav sections={SECTIONS} activeId={active} />

      <main id="conteudo">
        <Hero />

        {/* ==================================================== */}
        {/*  CAPÍTULO I — APRESENTAÇÃO                             */}
        {/* ==================================================== */}
        <ChapterCover
          number={1}
          kicker="Apresentação"
          title="Antes dos números, as pessoas."
          lead="Toda parceria sólida começa com uma escuta atenta e uma decisão consciente."
          image={heroImg.url}
          imageAlt=""
          surface="ink"
        />

        {/* 02 · Carta de Boas-vindas — Feature editorial com foto do fundador */}
        <SectionShell id="carta" labelledBy="carta-title" surface="paper" pattern="dots" className="py-28 md:py-40">
          <div className="relative mx-auto grid max-w-6xl gap-16 px-6 md:grid-cols-12 md:gap-20 md:px-10">
            <Reveal className="md:col-span-5">
              <figure className="md:sticky md:top-32">
                <div
                  className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]"
                  style={{ aspectRatio: "3 / 4" }}
                >
                  <img
                    src={founderImg.url}
                    alt="Mário Sérgio, fundador da Velox Soluções Financeiras"
                    loading="eager"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <figcaption className="mt-5 flex items-center gap-3 font-serif text-sm italic text-muted-foreground">
                  <span className="h-px w-6" style={{ background: "var(--brand-orange)" }} aria-hidden="true" />
                  Mário Sérgio · Fundador
                </figcaption>
              </figure>
            </Reveal>
            <Reveal delay={120} className="md:col-span-7">
              <div className="font-serif text-sm italic text-muted-foreground">Capítulo I · Apresentação</div>
              <div className="mt-4">
                <Eyebrow>Carta de Boas-vindas</Eyebrow>
              </div>
              <h2 id="carta-title" className="mt-6 text-balance text-4xl leading-[1.08] sm:text-5xl md:text-6xl">
                Bem-vindo.
              </h2>
              <div className="mt-10 space-y-6 font-serif text-xl leading-relaxed">
                <p className="drop-cap">
                  Se este material chegou até você, é porque, em algum momento, surgiu o interesse em empreender ou conhecer melhor a Velox Soluções Financeiras.
                </p>
                <p>
                  Antes de falarmos sobre investimentos, modelos de franquia ou números, gostaríamos de apresentar aquilo que realmente sustenta nossa empresa: as pessoas, os valores e a forma como acreditamos que uma parceria deve ser construída.
                </p>
                <p>Empreender é uma decisão importante.</p>
                <p>
                  Mais do que investir recursos financeiros, significa dedicar tempo, energia e confiança em um projeto de longo prazo.
                </p>
                <p>
                  Por isso, acreditamos que toda decisão deve ser tomada com informação, transparência e segurança.
                </p>
                <p>Este manual foi desenvolvido justamente com esse propósito.</p>
                <p>
                  Ao longo das próximas páginas você conhecerá nossa história, entenderá como funciona o mercado em que atuamos, descobrirá nossa estrutura de suporte e compreenderá como trabalhamos ao lado dos nossos franqueados em cada etapa da jornada.
                </p>
                <p>Nosso objetivo não é convencer você de que a Velox é a escolha certa.</p>
                <p>
                  Nosso objetivo é fornecer informações suficientes para que você possa decidir, com tranquilidade e consciência, se esse projeto faz sentido para seus objetivos pessoais e profissionais.
                </p>
                <p>
                  Se, ao final desta leitura, você sentir que compartilhamos os mesmos valores, teremos enorme satisfação em conversar com você.
                </p>
                <p>Seja muito bem-vindo.</p>
              </div>
              <div className="mt-14 flex items-end justify-between border-t pt-8" style={{ borderColor: "var(--paper-edge)" }}>
                <div>
                  <div className="font-serif text-3xl italic">Mário Sérgio</div>
                  <div className="eyebrow mt-3">Fundador · Velox Soluções Financeiras</div>
                </div>
                <div className="hidden md:block" style={{ color: "var(--brand-blue)" }}>
                  <VMark className="h-14 w-14 opacity-40" strokeWidth={1.2} />
                </div>
              </div>
            </Reveal>
          </div>
        </SectionShell>

        {/* 03 · Como utilizar este manual */}
        <SectionShell id="manual" labelledBy="manual-title" surface="graphite" pattern="diag" className="py-28 md:py-40">
          <div className="relative mx-auto grid max-w-6xl gap-16 px-6 md:grid-cols-12 md:gap-20 md:px-10">
            <div className="md:col-span-5">
              <Reveal>
                <div className="font-serif text-sm italic on-dark-muted">Capítulo I · Apresentação</div>
                <div className="mt-4">
                  <Eyebrow tone="dark">Como utilizar este manual</Eyebrow>
                </div>
                <h2 id="manual-title" className="mt-6 text-balance text-4xl leading-[1.08] on-dark sm:text-5xl md:text-6xl">
                  Um material feito para <em style={{ color: "var(--brand-orange)" }}>ler com calma.</em>
                </h2>
              </Reveal>
            </div>
            <div className="md:col-span-7">
              <Reveal delay={120}>
                <div className="space-y-6 text-lg leading-relaxed on-dark-muted">
                  <p>
                    Nosso objetivo é permitir que você conheça a empresa, compreenda nosso modelo de negócio e tenha todas as informações necessárias para avaliar, com tranquilidade, se esta oportunidade faz sentido para o seu momento de vida e para seus objetivos.
                  </p>
                  <p className="on-dark">Ao longo da leitura, você conhecerá:</p>
                </div>
              </Reveal>
              <Reveal delay={200}>
                <ul className="mt-8 grid gap-px overflow-hidden border" style={{ borderColor: "var(--on-dark-border)", background: "var(--on-dark-border)" }}>
                  {MANUAL_TOPICS.map((t, i) => (
                    <li key={t} className="flex items-start gap-6 p-6 md:p-7" style={{ background: "var(--graphite)" }}>
                      <span className="num mt-1 shrink-0 text-sm" style={{ color: "var(--brand-orange)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="on-dark-muted">{t}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={280}>
                <div className="mt-14 border-y py-10" style={{ borderColor: "var(--on-dark-border)" }}>
                  <div className="eyebrow eyebrow-on-dark">Nossa recomendação é simples</div>
                  <div className="mt-6 grid gap-2 font-serif text-2xl italic on-dark md:grid-cols-5 md:gap-6 md:text-3xl">
                    <span>Leia com calma.</span>
                    <span>Anote dúvidas.</span>
                    <span>Compare.</span>
                    <span>Pergunte.</span>
                    <span>Converse.</span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </SectionShell>

        {/* 04 · Antes de falar da Velox */}
        <SectionShell id="antes" labelledBy="antes-title" surface="paper" pattern="dots" className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <Reveal>
              <div className="mx-auto max-w-3xl text-center">
                <div className="flex justify-center">
                  <Eyebrow>Antes de falar da Velox</Eyebrow>
                </div>
                <h2 id="antes-title" className="mt-8 text-balance text-4xl leading-[1.08] sm:text-5xl md:text-6xl">
                  Uma decisão que vai muito além da análise de números.
                </h2>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <figure className="mx-auto mt-16 max-w-5xl">
                <div
                  className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]"
                  style={{ aspectRatio: "21 / 9" }}
                >
                  <img
                    src={decisaoImg.url}
                    alt="Escritório executivo em andar alto com vista para o skyline ao pôr do sol"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </figure>
            </Reveal>
            <div className="mx-auto mt-16 grid max-w-5xl gap-16 md:grid-cols-12">
              <Reveal delay={200} className="md:col-span-7">
                <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
                  <p>
                    Escolher uma franquia é uma decisão que vai muito além da análise de números ou da comparação entre marcas.
                  </p>
                  <p>
                    Empreender significa investir tempo, recursos, dedicação e expectativas em um projeto que poderá fazer parte da sua vida pelos próximos anos.
                  </p>
                  <p>
                    Por isso, acreditamos que nenhuma decisão deve ser tomada com base apenas em promessas ou apresentações comerciais.
                  </p>
                  <p>
                    Antes de conhecer a Velox, acreditamos que é importante compreender o que caracteriza uma boa parceria de negócios.
                  </p>
                  <p>Uma empresa séria não deve apenas apresentar oportunidades.</p>
                  <p>
                    Ela deve fornecer informações suficientes para que cada investidor possa avaliar, de forma consciente, se existe alinhamento entre seus objetivos, seu perfil e a proposta apresentada.
                  </p>
                  <p>
                    Ao longo deste material, você encontrará informações sobre nossa história, nosso modelo de atuação, nossa estrutura de suporte e nossa visão de longo prazo.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={280} className="md:col-span-5">
                <div
                  className="border-l-2 pl-8 md:sticky md:top-32"
                  style={{ borderColor: "var(--brand-orange)" }}
                >
                  <div className="eyebrow">Nosso convite</div>
                  <div className="mt-6 space-y-3 font-serif text-3xl italic md:text-4xl">
                    <p>Conheça a Velox sem pressa.</p>
                    <p>Analise.</p>
                    <p>Compare.</p>
                    <p>Questione.</p>
                    <p>E somente depois decida se faz sentido caminhar conosco.</p>
                  </div>
                  <p className="mt-10 text-base leading-relaxed text-muted-foreground">
                    Acreditamos que grandes parcerias começam exatamente assim: com informação, confiança e transparência.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </SectionShell>

        {/* 05 · Quem é a Velox */}
        <FeaturePanel
          id="velox"
          chapter="Capítulo I · Apresentação"
          eyebrow="Quem é a Velox"
          title="Toda empresa nasce de uma ideia."
          image={relationshipImg.url}
          imageAlt="Consultor e cliente em conversa profissional"
          imageCaption="Atendimento consultivo · Velox"
          surface="paper"
        >
          <p>Algumas nascem para oferecer produtos. Outras surgem para solucionar problemas.</p>
          <p>
            A Velox Soluções Financeiras nasceu com um propósito muito claro: conectar pessoas às melhores soluções financeiras por meio de um modelo de negócio baseado em relacionamento, conhecimento e atendimento consultivo.
          </p>
          <p>
            Hoje somos a única rede a reunir, sob uma mesma marca, cinco frentes de atuação complementares — crédito e consórcios, energia e imobiliário, agronegócio, home equity e limpa nome — apoiadas por mais de cinquenta instituições financeiras e mais de duzentos tipos de serviços.
          </p>
          <p>
            Ao longo de sua trajetória, a empresa consolidou uma atuação voltada para a construção de parcerias duradouras, reunindo soluções capazes de atender diferentes perfis de clientes e necessidades financeiras.
          </p>
          <p>
            Mais do que disponibilizar produtos, a Velox acredita que seu papel é oferecer orientação, segurança e alternativas para que cada cliente encontre a solução mais adequada ao seu momento.
          </p>
        </FeaturePanel>

        {/* 06 · Parcerias */}
        <FeaturePanel
          id="parcerias"
          chapter="Capítulo I · Apresentação"
          eyebrow="Nossa forma de construir parcerias"
          title="Uma parceria verdadeira é construída diariamente."
          image={treinamentoImg.url}
          imageAlt="Treinamento da rede Velox por videoconferência"
          imageCaption="Treinamento da rede · Velox"
          reverse
          surface="graphite"
        >
          <p>Acreditamos que uma franquia vai muito além da concessão do direito de uso de uma marca.</p>
          <p>
            Uma parceria verdadeira é construída diariamente, por meio da troca de conhecimento, do acompanhamento próximo e da busca constante por resultados sustentáveis.
          </p>
          <p>Na Velox, entendemos que cada franqueado possui objetivos, experiências e desafios diferentes.</p>
          <p>
            Por isso, nosso compromisso é oferecer uma estrutura que apoie o desenvolvimento do negócio em todas as etapas da jornada, respeitando as particularidades de cada operação.
          </p>
          <p>
            Mais do que fornecer ferramentas, buscamos construir relações baseadas em confiança, transparência e disponibilidade.
          </p>
          <p>
            Acreditamos que, quando empresa e franqueado compartilham os mesmos valores, os resultados tornam-se consequência de um trabalho desenvolvido em parceria.
          </p>
        </FeaturePanel>

        {/* 07 · Nossos valores */}
        <SectionShell id="valores" labelledBy="valores-title" surface="ink" pattern="grid" watermark className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <div className="max-w-3xl">
              <Reveal>
                <div className="font-serif text-sm italic on-dark-muted">Capítulo I · Apresentação</div>
                <div className="mt-4">
                  <Eyebrow tone="dark">Nossos valores</Eyebrow>
                </div>
                <h2 id="valores-title" className="mt-6 text-balance text-4xl leading-[1.08] on-dark sm:text-5xl md:text-6xl">
                  Princípios que orientam <em style={{ color: "var(--brand-orange)" }}>nossa atuação.</em>
                </h2>
              </Reveal>
            </div>
            <div className="mt-16 grid gap-px overflow-hidden md:grid-cols-3" style={{ background: "var(--on-dark-border)" }}>
              {VALORES.map((v, i) => (
                <Reveal key={v.title} delay={(i % 3) * 80}>
                  <div
                    className="group flex h-full flex-col p-8 transition-colors duration-500 md:p-10"
                    style={{ background: "var(--ink)" }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="num text-xs on-dark-muted">{String(i + 1).padStart(2, "0")}</span>
                      <span
                        aria-hidden="true"
                        className="h-px w-8 transition-all duration-500 group-hover:w-14"
                        style={{ background: "var(--brand-orange)" }}
                      />
                    </div>
                    <div className="mt-8 font-serif text-3xl on-dark">{v.title}</div>
                    <p className="mt-5 text-sm leading-relaxed on-dark-muted">{v.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </SectionShell>

        <Pullquote surface="graphite" attribution="Velox · Manual do Investidor">
          Grandes decisões começam com boas informações — e amadurecem no tempo certo de cada investidor.
        </Pullquote>

        {/* ==================================================== */}
        {/*  CAPÍTULO II — O MERCADO                               */}
        {/* ==================================================== */}
        <ChapterCover
          number={2}
          kicker="O Mercado"
          title="Onde há informação, nascem escolhas conscientes."
          lead="Um mercado maduro exige interlocutores preparados — e clientes bem orientados."
          image={marketImg.url}
          imageAlt=""
          surface="ink"
        />

        {/* StatBand — indicadores da rede */}
        <StatBand
          eyebrow="A rede em números"
          title="Uma estrutura ampla, integrada e em constante expansão."
          items={[
            { value: "5", label: "Frentes de atuação reunidas sob a mesma marca", note: "Modelo integrado" },
            { value: "+200", label: "Soluções e serviços financeiros ativos", note: "Portfólio em expansão" },
            { value: "+50", label: "Instituições financeiras parceiras", note: "Bancos, seguradoras, fundos" },
            { value: "+40k", label: "Farmácias na rede Hulp Benefícios", note: "Cobertura nacional" },
          ]}
        />

        {/* 08 · Panorama do mercado */}
        <FeaturePanel
          id="mercado"
          chapter="Capítulo II · O Mercado"
          eyebrow="Panorama do mercado financeiro"
          title="Um setor essencial, em constante transformação."
          image={marketImg.url}
          imageAlt="Vista do distrito financeiro ao amanhecer"
          imageCaption="Distrito financeiro · Amanhecer"
          surface="paper"
        >
          <p>
            O setor financeiro está entre os mais importantes da economia. Ele conecta pessoas, empresas e projetos, viabiliza sonhos de longo prazo e sustenta boa parte das decisões que movimentam o país.
          </p>
          <p>
            Ao mesmo tempo, é um mercado em constante transformação. A digitalização dos serviços, o surgimento de novas modalidades de crédito e a diversificação das soluções financeiras ampliaram o acesso e trouxeram mais possibilidades para diferentes perfis de clientes.
          </p>
          <p>
            Nesse cenário, o papel do consultor financeiro tornou-se ainda mais relevante. Diante de tantas opções, o cliente busca orientação clara, comparação honesta e uma escolha adequada ao seu momento.
          </p>
          <p>
            É exatamente nesse ponto que surge a oportunidade para redes especializadas: oferecer, em um único lugar, um portfólio amplo, atendimento consultivo e a segurança de instituições reconhecidas.
          </p>
        </FeaturePanel>

        {/* 09 · Evolução do consumidor */}
        <FeaturePanel
          id="consumidor"
          chapter="Capítulo II · O Mercado"
          eyebrow="Evolução do consumidor"
          title="Um cliente mais informado, mais exigente e mais conectado."
          image={consumerImg.url}
          imageAlt="Pessoa lendo um documento em ambiente residencial"
          imageCaption="O novo consumidor financeiro"
          reverse
          surface="paper"
        >
          <p>
            O comportamento do consumidor mudou de forma significativa nos últimos anos. O acesso à informação, a familiaridade com o ambiente digital e o contato com múltiplas alternativas tornaram o cliente mais atento, mais criterioso e mais consciente de suas escolhas.
          </p>
          <p>
            Ele deseja compreender antes de contratar. Compara condições, avalia reputação, busca segurança e valoriza o relacionamento com quem o atende.
          </p>
          <p>
            Esse novo perfil tornou a consultoria financeira ainda mais estratégica. A escuta atenta, a explicação técnica em linguagem acessível e a construção de confiança passaram a ser tão relevantes quanto a solução em si.
          </p>
          <p>
            É a partir dessa leitura que estruturamos nossa forma de atuar: colocando o cliente no centro do processo e oferecendo, aos franqueados, as condições para conduzir esse atendimento com qualidade.
          </p>
        </FeaturePanel>

        {/* 10 · Ecossistema — Products */}
        <EditorialSection
          id="ecossistema"
          chapter="Capítulo II · O Mercado"
          eyebrow="O ecossistema Velox"
          title="Mais de 200 soluções financeiras sob a mesma marca."
          lead="Reunimos, em uma única estrutura, dezenas de linhas de produtos e serviços financeiros complementares. A seguir, uma seleção conceitual das principais frentes que compõem o portfólio da rede."
          surface="ink"
          watermark
        >
          <ProductGrid items={PRODUCTS} />
          <p className="mx-auto mt-14 max-w-3xl text-center font-serif text-lg italic leading-relaxed on-dark-muted">
            Esta é apenas uma seleção. A rede opera mais de 200 produtos e serviços ativos, com novas frentes sendo incorporadas continuamente.
          </p>
        </EditorialSection>

        {/* 11 · Especialidades */}
        <SectionShell id="especialidades" labelledBy="especialidades-title" surface="paper" pattern="diag" className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <div className="max-w-3xl">
              <Reveal>
                <div className="font-serif text-sm italic text-muted-foreground">Capítulo II · O Mercado</div>
                <div className="mt-4"><Eyebrow>Frentes especializadas</Eyebrow></div>
                <h2 id="especialidades-title" className="mt-6 text-balance text-4xl leading-[1.08] sm:text-5xl md:text-6xl">
                  Quatro estruturas dedicadas <em style={{ color: "var(--brand-orange)" }}>dentro de uma única franquia.</em>
                </h2>
                <p className="mt-8 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">
                  Além do portfólio bancário tradicional, o franqueado Velox opera frentes institucionais especializadas — cada uma com processos, times técnicos e parceiros próprios — desenhadas para ampliar as fontes de receita da unidade.
                </p>
              </Reveal>
            </div>
            <div className="mt-16 space-y-4">
              {SPECIALTIES.map((s, i) => (
                <Reveal key={s.name} delay={i * 80}>
                  <article
                    className="group relative grid gap-8 border p-8 transition-colors duration-500 hover:shadow-[var(--shadow-soft)] md:grid-cols-12 md:gap-12 md:p-12"
                    style={{
                      background: "var(--paper-2)",
                      borderColor: "var(--paper-edge)",
                    }}
                  >
                    <div className="md:col-span-2">
                      <span className="num text-5xl leading-none" style={{ color: "var(--brand-orange)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="eyebrow mt-6">{s.eyebrow}</div>
                    </div>
                    <div className="md:col-span-6">
                      <h3 className="font-serif text-3xl leading-snug md:text-4xl">{s.name}</h3>
                      <p className="mt-5 text-base leading-relaxed text-muted-foreground">{s.description}</p>
                    </div>
                    <div className="md:col-span-4 md:border-l md:pl-8" style={{ borderColor: "var(--paper-edge)" }}>
                      <div className="eyebrow">Destaque</div>
                      <p className="mt-4 font-serif text-lg italic leading-snug">{s.highlight}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </SectionShell>

        {/* 12 · Parceiros estratégicos */}
        <SectionShell id="parceiros" labelledBy="parceiros-title" surface="graphite" pattern="dots" className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <div className="font-serif text-sm italic on-dark-muted">Capítulo II · O Mercado</div>
                <div className="mt-4 flex justify-center"><Eyebrow tone="dark">Parceiros estratégicos</Eyebrow></div>
                <h2 id="parceiros-title" className="mt-6 text-balance text-4xl leading-[1.08] on-dark sm:text-5xl md:text-6xl">
                  Instituições que caminham conosco.
                </h2>
                <p className="mt-8 text-lg leading-relaxed on-dark-muted">
                  Mais de 50 instituições financeiras — bancos, seguradoras, administradoras de consórcio, fintechs e fundos — compõem a base de parcerias que sustentam o portfólio oferecido pela rede.
                </p>
              </Reveal>
            </div>
            <Reveal delay={160}>
              <figure className="mt-16 overflow-hidden border shadow-[var(--shadow-panel)]" style={{ borderColor: "var(--on-dark-border)", background: "var(--paper)" }}>
                <img
                  src={parceirosImg.url}
                  alt="Marketplace de parceiros Velox — logotipos de bancos, seguradoras e instituições financeiras"
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full object-contain"
                />
              </figure>
              <p className="mt-6 text-center text-xs uppercase tracking-[0.24em] on-dark-muted">
                Marcas exibidas em caráter ilustrativo · Marketplace de parceiros Velox
              </p>
            </Reveal>
          </div>
        </SectionShell>

        <Pullquote surface="paper">
          Relacionamentos duradouros nascem da confiança construída no dia a dia.
        </Pullquote>

        {/* ==================================================== */}
        {/*  CAPÍTULO III — SUPORTE AO FRANQUEADO                  */}
        {/* ==================================================== */}
        <ChapterCover
          number={3}
          kicker="Suporte ao Franqueado"
          title="Nenhuma jornada sólida se constrói sozinha."
          lead="Estrutura, conhecimento e presença — o que sustenta uma operação madura."
          image={collabImg.url}
          imageAlt=""
          surface="ink"
        />

        {/* 13 · Processo de implantação */}
        <FeaturePanel
          id="implantacao"
          chapter="Capítulo III · Suporte ao Franqueado"
          eyebrow="Processo de implantação"
          title="Um começo bem estruturado é o primeiro passo de uma operação sólida."
          image={ciroImg.url}
          imageAlt="Ciro Bottini, embaixador da Velox Soluções Financeiras"
          imageCaption="Ciro Bottini · Embaixador Velox"
          surface="paper"
        >
          <p>
            O processo de implantação foi pensado para preparar cada nova unidade com atenção aos detalhes que fazem diferença no dia a dia da operação. Ele acompanha o franqueado desde a formalização da parceria até os primeiros passos de atuação no mercado.
          </p>
          <p>
            A etapa inicial reúne organização estrutural, orientações sobre processos, ambientação à cultura da rede e treinamento inicial da equipe. Nosso objetivo é reduzir a curva de aprendizado e permitir que o franqueado inicie sua operação com clareza sobre o que precisa ser feito.
          </p>
          <p>
            Ao longo dessa fase, o franqueado é acompanhado de perto por profissionais responsáveis por orientar decisões, esclarecer dúvidas e apresentar as melhores práticas já consolidadas pela rede.
          </p>
        </FeaturePanel>

        {/* 14 · Equipe de suporte */}
        <SectionShell id="equipe" labelledBy="equipe-title" surface="graphite" pattern="grid" className="py-28 md:py-40">
          <div className="relative mx-auto grid max-w-6xl gap-16 px-6 md:grid-cols-12 md:gap-20 md:px-10">
            <Reveal className="md:col-span-5">
              <div className="grid grid-cols-2 gap-4">
                <figure className="col-span-2">
                  <div className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]" style={{ aspectRatio: "3 / 4" }}>
                    <img src={larissaImg.url} alt="Larissa — Diretora de Expansão" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                  </div>
                  <figcaption className="mt-4 flex items-center gap-3 font-serif text-sm italic on-dark-muted">
                    <span className="h-px w-6" style={{ background: "var(--brand-orange)" }} aria-hidden="true" />
                    Larissa · Diretora de Expansão
                  </figcaption>
                </figure>
                <figure>
                  <div className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]" style={{ aspectRatio: "3 / 4" }}>
                    <img src={executivosImg.url} alt="Executivos de expansão da Velox" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                  </div>
                </figure>
                <figure>
                  <div className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]" style={{ aspectRatio: "3 / 4" }}>
                    <img src={marioConsultoresImg.url} alt="Mário Sérgio e consultores de negócio" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                  </div>
                </figure>
              </div>
            </Reveal>
            <Reveal delay={120} className="md:col-span-7">
              <div className="font-serif text-sm italic on-dark-muted">Capítulo III · Suporte ao Franqueado</div>
              <div className="mt-4"><Eyebrow tone="dark">Equipe de suporte</Eyebrow></div>
              <h2 id="equipe-title" className="mt-6 text-balance text-4xl leading-[1.08] on-dark sm:text-5xl md:text-6xl">
                Pessoas preparadas para caminhar ao lado de cada franqueado.
              </h2>
              <div className="mt-10 space-y-5 text-lg leading-relaxed on-dark-muted">
                <p>
                  A estrutura de suporte é liderada pela Diretoria de Expansão e formada por áreas dedicadas a diferentes frentes da operação — do atendimento comercial ao acompanhamento pós-implantação. Cada uma delas atua de forma integrada, para que o franqueado tenha um ponto de referência claro em cada etapa da jornada.
                </p>
                <p>
                  O acompanhamento é contínuo e prático. Não se resume a canais de atendimento reativos: envolve orientação, análise de indicadores, sugestões de melhoria e o compartilhamento das boas práticas observadas na rede.
                </p>
                <p>
                  Acreditamos que o suporte é um dos pilares mais importantes de uma franquia. É ele que sustenta a maturidade da operação e que traduz, no cotidiano, o compromisso assumido na formalização da parceria.
                </p>
              </div>
            </Reveal>
          </div>
        </SectionShell>

        {/* 15 · Consultoria de negócios */}
        <FeaturePanel
          id="consultoria"
          chapter="Capítulo III · Suporte ao Franqueado"
          eyebrow="Consultoria de negócios"
          title="Um olhar externo, técnico e comprometido com a evolução do negócio."
          image={marioConsultoresImg.url}
          imageAlt="Mário Sérgio e consultores de negócio em reunião estratégica"
          imageCaption="Reunião estratégica · Consultoria Velox"
          reverse
          surface="paper"
        >
          <p>
            A consultoria de negócios complementa o suporte operacional, atuando em uma dimensão mais analítica e estratégica. O objetivo é ajudar o franqueado a interpretar seus resultados, identificar oportunidades de melhoria e planejar os próximos ciclos da operação.
          </p>
          <p>
            A partir de acompanhamentos periódicos, são discutidos temas como produtividade, mix de produtos, ações comerciais, gestão de equipe e organização de rotinas. Cada conversa é conduzida com base na realidade da unidade e no momento vivido pelo franqueado.
          </p>
          <p>
            Mais do que orientar decisões pontuais, a consultoria busca contribuir com o desenvolvimento contínuo do negócio, apoiando o franqueado na construção de uma operação madura, previsível e sustentável.
          </p>
        </FeaturePanel>

        {/* 16 · Universidade Corporativa */}
        <FeaturePanel
          id="universidade"
          chapter="Capítulo III · Suporte ao Franqueado"
          eyebrow="Universidade Corporativa"
          title="Conhecimento como base da evolução da rede."
          image={collabImg.url}
          imageAlt="Sala de formação corporativa com equipe em treinamento"
          imageCaption="Universidade Corporativa Velox"
          imageRatio="4 / 3"
          surface="ink"
        >
          <p>
            A Universidade Corporativa reúne o programa de formação continuada oferecido a franqueados e equipes. Sua proposta é oferecer, de forma estruturada, o conhecimento técnico e comportamental necessário para atuar com qualidade em cada etapa da operação.
          </p>
          <p>
            O programa contempla trilhas de aprendizagem sobre produtos, atendimento consultivo, gestão do negócio e temas comportamentais. Cada conteúdo é revisado periodicamente, acompanhando a evolução do mercado e as boas práticas da rede.
          </p>
          <p>
            Acreditamos que o aprendizado contínuo é um diferencial competitivo. Ele fortalece pessoas, eleva a qualidade do atendimento e contribui diretamente para a maturidade e a longevidade de cada operação.
          </p>
        </FeaturePanel>

        {/* 17 · Tecnologia */}
        <FeaturePanel
          id="tecnologia"
          chapter="Capítulo III · Suporte ao Franqueado"
          eyebrow="Plataforma tecnológica"
          title="Tecnologia a serviço da qualidade do atendimento."
          image={techImg.url}
          imageAlt="Estação de trabalho editorial com laptop, caderno e xícara em luz natural"
          imageCaption="Plataforma tecnológica · Velox"
          imageRatio="4 / 3"
          reverse
          surface="graphite"
        >
          <p>
            A plataforma tecnológica é a base operacional da rede. Ela organiza a jornada do cliente, apoia o dia a dia do franqueado e traz visibilidade sobre indicadores essenciais à condução do negócio.
          </p>
          <p>
            Do primeiro contato à formalização de uma solução financeira, os processos são estruturados de maneira a preservar a qualidade do atendimento, a rastreabilidade das informações e a segurança dos dados envolvidos.
          </p>
          <p>
            O uso da plataforma é acompanhado por materiais de apoio e capacitação, garantindo que cada usuário aproveite integralmente os recursos disponíveis.
          </p>
        </FeaturePanel>

        {/* 18 · Comunidade */}
        <FeaturePanel
          id="comunidade"
          chapter="Capítulo III · Suporte ao Franqueado"
          eyebrow="Comunidade de franqueados"
          title="Uma rede que aprende, evolui e se fortalece em conjunto."
          image={lojaInauguracaoImg.url}
          imageAlt="Inauguração de unidade Velox — celebração com a rede"
          imageCaption="Inauguração de unidade · Rede Velox"
          surface="paper"
        >
          <p>
            Fazer parte de uma rede é, também, participar de uma comunidade. Um ambiente onde experiências são compartilhadas, boas práticas circulam e cada franqueado encontra apoio em pessoas que vivem desafios semelhantes.
          </p>
          <p>
            Ao longo do ano, encontros, reuniões e canais de relacionamento aproximam franqueados, equipe de suporte e liderança. Esses momentos fortalecem vínculos, ampliam o repertório de soluções e alimentam a evolução contínua da rede.
          </p>
          <p>
            Acreditamos que uma rede madura é aquela em que o sucesso de cada unidade contribui para o sucesso das demais. É essa cultura de colaboração que buscamos preservar e desenvolver.
          </p>
        </FeaturePanel>

        <Pullquote surface="ink" attribution="Manual do Investidor · Encerramento do Capítulo III">
          Uma boa estrutura de suporte não substitui o esforço do empreendedor — mas transforma completamente o caminho que ele percorre.
        </Pullquote>

        {/* ==================================================== */}
        {/*  CAPÍTULO IV — MODELOS DE FRANQUIA                     */}
        {/* ==================================================== */}
        <ChapterCover
          number={4}
          kicker="Modelos de Franquia"
          title="Duas formas de começar. O mesmo compromisso."
          lead="Cada modelo respeita um perfil — e preserva a mesma exigência de qualidade."
          image={lojaFachadaImg.url}
          imageAlt=""
          surface="ink"
        />

        {/* Gallery — unidades reais */}
        <EditorialSection
          id="unidades"
          chapter="Capítulo IV · Modelos de Franquia"
          eyebrow="Rede em expansão"
          title="Unidades que já carregam a identidade Velox."
          lead="Da fachada ao ambiente de atendimento, cada operação reflete a mesma linguagem visual — a marca reconhecível que aproxima clientes e sustenta a credibilidade da rede."
          surface="paper"
        >
          <Gallery items={UNIDADES} />
        </EditorialSection>

        {/* 19 · Modelos de franquia */}
        <SectionShell id="franquia" labelledBy="franquia-title" surface="graphite" pattern="diag" className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <div className="max-w-3xl">
              <Reveal>
                <div className="font-serif text-sm italic on-dark-muted">Capítulo IV · Modelos de Franquia</div>
                <div className="mt-4"><Eyebrow tone="dark">Modelos de franquia</Eyebrow></div>
                <h2 id="franquia-title" className="mt-6 text-balance text-4xl leading-[1.08] on-dark sm:text-5xl md:text-6xl">
                  Duas formas de <em style={{ color: "var(--brand-orange)" }}>começar.</em>
                </h2>
                <p className="mt-8 max-w-[62ch] text-lg leading-relaxed on-dark-muted">
                  Oferecemos formatos distintos para acolher diferentes perfis de investidor e diferentes realidades regionais. Ambos compartilham a mesma estrutura de suporte, os mesmos processos e o mesmo compromisso com a qualidade do atendimento.
                </p>
              </Reveal>
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-2 md:gap-8">
              {[
                {
                  n: "01",
                  name: "Home Office",
                  img: homeOfficeImg.url,
                  alt: "Estação de trabalho de operação Home Office",
                  copy: "Formato de operação enxuta, indicado para quem deseja iniciar com estrutura leve, custos reduzidos e foco na consolidação da carteira. Preserva a mesma padronização e o mesmo suporte oferecidos aos demais modelos da rede.",
                  perfil: "Empreendedores que buscam iniciar com estrutura leve e escalar gradualmente.",
                  estrutura: "Operação enxuta, sem necessidade de ponto físico dedicado ao público.",
                },
                {
                  n: "02",
                  name: "Loja Física",
                  img: lojaFachada2Img.url,
                  alt: "Loja física Velox — fachada institucional",
                  copy: "Formato com ponto comercial dedicado, voltado à construção de presença regional e ao fortalecimento da marca. Amplia a capacidade de atendimento presencial e favorece a percepção de solidez pelo cliente.",
                  perfil: "Empreendedores que desejam construir presença regional e ampliar visibilidade.",
                  estrutura: "Ponto comercial preparado para atendimento presencial e presença de marca.",
                },
              ].map((m, i) => (
                <Reveal key={m.n} delay={i * 100}>
                  <article
                    className="group flex h-full flex-col overflow-hidden border shadow-[var(--shadow-panel)]"
                    style={{ background: "var(--ink)", borderColor: "var(--on-dark-border)" }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-black">
                      <img src={m.img} alt={m.alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.03]" />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, color-mix(in oklab, var(--ink) 90%, transparent))" }} />
                      <div className="absolute left-6 top-6">
                        <div className="num text-xs on-dark-muted">Modelo {m.n}</div>
                        <div className="mt-2 font-serif text-3xl on-dark md:text-4xl">{m.name}</div>
                      </div>
                    </div>
                    <div className="p-8 md:p-10">
                      <p className="text-base leading-relaxed on-dark-muted">{m.copy}</p>
                      <dl className="mt-8 grid gap-4 border-t pt-6" style={{ borderColor: "var(--on-dark-border)" }}>
                        <div>
                          <dt className="eyebrow eyebrow-on-dark">Estrutura</dt>
                          <dd className="mt-2 font-serif text-lg on-dark">{m.estrutura}</dd>
                        </div>
                        <div>
                          <dt className="eyebrow eyebrow-on-dark">Perfil indicado</dt>
                          <dd className="mt-2 font-serif text-lg on-dark">{m.perfil}</dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <p className="mt-12 text-center text-sm on-dark-muted">
                Investimento, royalties e prazos contratuais são apresentados diretamente pela equipe, com os documentos institucionais previstos pela Lei de Franquias.
              </p>
            </Reveal>
          </div>
        </SectionShell>

        {/* 20 · Investimento */}
        <SectionShell id="investimento" labelledBy="investimento-title" surface="paper" pattern="dots" className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <div className="max-w-3xl">
              <Reveal>
                <div className="font-serif text-sm italic text-muted-foreground">Capítulo IV · Modelos de Franquia</div>
                <div className="mt-4"><Eyebrow>Investimento</Eyebrow></div>
                <h2 id="investimento-title" className="mt-6 text-balance text-4xl leading-[1.08] sm:text-5xl md:text-6xl">
                  Transparência é o primeiro compromisso ao apresentar valores.
                </h2>
                <p className="mt-8 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">
                  Os valores oficiais de investimento, royalties e itens contemplados são detalhados diretamente com nossa equipe, sempre acompanhados dos documentos institucionais previstos pela Lei de Franquias. As referências abaixo indicam a estrutura da apresentação.
                </p>
              </Reveal>
            </div>
            <div className="mt-16 grid gap-px overflow-hidden border md:grid-cols-3" style={{ background: "var(--paper-edge)", borderColor: "var(--paper-edge)" }}>
              {[
                { eyebrow: "01 · Investimento inicial", title: "Apresentado em conversa", body: "Compreende os aportes necessários para a instalação e o início da operação, conforme o modelo escolhido. Os valores são apresentados de forma detalhada durante o processo de conversa com nossa equipe." },
                { eyebrow: "02 · Royalties", title: "Documento contratual", body: "Valor recorrente que sustenta a estrutura de suporte, tecnologia, consultoria e desenvolvimento contínuo colocados à disposição da rede. Detalhado no material contratual oficial." },
                { eyebrow: "03 · O que está incluído", title: "Estrutura, suporte e tecnologia", body: "Direito de uso da marca, acesso ao portfólio de soluções, plataforma tecnológica, capacitação continuada, consultoria de negócios e acompanhamento da equipe de suporte ao longo da parceria." },
              ].map((c, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="flex h-full flex-col p-8 md:p-10" style={{ background: "var(--paper-2)" }}>
                    <div className="eyebrow">{c.eyebrow}</div>
                    <div className="mt-6 font-serif text-2xl leading-snug md:text-3xl">{c.title}</div>
                    <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </SectionShell>

        <Pullquote surface="graphite">
          As melhores oportunidades são construídas sobre transparência e tempo bem investido.
        </Pullquote>

        {/* ==================================================== */}
        {/*  CAPÍTULO V — PRÓXIMOS PASSOS                          */}
        {/* ==================================================== */}
        <ChapterCover
          number={5}
          kicker="Próximos Passos"
          title="O primeiro passo é uma conversa."
          lead="Do encontro à formalização, cada etapa acontece no tempo certo de cada investidor."
          image={relationshipImg.url}
          imageAlt=""
          surface="ink"
        />

        {/* 21 · Como funciona o processo */}
        <FeaturePanel
          id="processo"
          chapter="Capítulo V · Próximos Passos"
          eyebrow="Como funciona o processo"
          title="Uma conversa antes de qualquer decisão."
          image={relationshipImg.url}
          imageAlt="Reunião de atendimento consultivo em ambiente institucional"
          imageCaption="Atendimento consultivo"
          surface="paper"
        >
          <p>
            Antes de qualquer formalização, valorizamos a construção de uma conversa aberta. É a partir desse diálogo que entendemos seus objetivos, sua trajetória e o contexto em que a decisão está sendo avaliada.
          </p>
          <p>
            Do nosso lado, apresentamos a empresa em maior profundidade, esclarecemos dúvidas específicas e disponibilizamos os materiais institucionais previstos pela legislação. Do seu lado, existe todo o tempo necessário para ler, comparar e refletir.
          </p>
          <p>
            Somente após essa etapa de compreensão mútua avançamos para a fase contratual. Acreditamos que essa é a maneira mais adequada de iniciar uma parceria de longo prazo: com informação, tranquilidade e respeito ao tempo de decisão de cada investidor.
          </p>
          <p>
            Este manual é o ponto de partida. Os próximos passos serão sempre conduzidos no ritmo em que fizer sentido para você.
          </p>
        </FeaturePanel>

        {/* 22 · Próximas etapas */}
        <SectionShell id="etapas" labelledBy="etapas-title" surface="graphite" pattern="grid" watermark className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <div className="max-w-3xl">
              <Reveal>
                <div className="font-serif text-sm italic on-dark-muted">Capítulo V · Próximos Passos</div>
                <div className="mt-4"><Eyebrow tone="dark">Próximas etapas</Eyebrow></div>
                <h2 id="etapas-title" className="mt-6 text-balance text-4xl leading-[1.08] on-dark sm:text-5xl md:text-6xl">
                  Uma jornada em <em style={{ color: "var(--brand-orange)" }}>quatro momentos.</em>
                </h2>
              </Reveal>
            </div>
            <div className="mt-16">
              <TimelineRail items={NEXT_STEPS} dark />
            </div>
          </div>
        </SectionShell>

        {/* 23 · Encerramento */}
        <SectionShell id="encerramento" labelledBy="encerramento-title" surface="ink" pattern="grid" watermark className="py-28 md:py-40">
          <div className="relative mx-auto max-w-6xl px-6 md:px-10">
            <Reveal>
              <figure className="mx-auto max-w-5xl">
                <div className="frame-orange relative overflow-hidden bg-black shadow-[var(--shadow-frame)]" style={{ aspectRatio: "21 / 9" }}>
                  <img src={closingImg.url} alt="Fachada iluminada de edifício corporativo ao entardecer" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              </figure>
            </Reveal>
            <div className="mx-auto mt-16 max-w-3xl text-center">
              <Reveal>
                <div className="flex justify-center"><Eyebrow tone="dark">Capítulo V · Contato</Eyebrow></div>
              </Reveal>
              <Reveal delay={120}>
                <h2 id="encerramento-title" className="mt-8 text-balance text-4xl leading-[1.08] on-dark sm:text-5xl md:text-6xl">
                  Obrigado por chegar até aqui.
                </h2>
              </Reveal>
              <Reveal delay={220}>
                <div className="mt-10 space-y-6 text-lg leading-relaxed on-dark-muted">
                  <p>
                    A leitura deste manual representa, para nós, um passo importante. Ele reúne a essência do que somos e da forma como acreditamos que uma parceria deve ser construída.
                  </p>
                  <p>
                    Se, ao encerrar este material, você sentir que existe alinhamento entre seus objetivos e nossa maneira de trabalhar, será uma satisfação continuar essa conversa. Se, por outro lado, este não for o momento adequado, respeitamos integralmente essa decisão.
                  </p>
                  <p>
                    Em qualquer caso, esperamos ter oferecido informação útil e uma leitura à altura da seriedade com que você conduz suas decisões.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={300}>
                <div className="mx-auto mt-14 grid max-w-2xl gap-px overflow-hidden border sm:grid-cols-3" style={{ borderColor: "var(--on-dark-border)", background: "var(--on-dark-border)" }}>
                  {[
                    { label: "Telefone", value: "[Inserir informação institucional oficial]" },
                    { label: "E-mail", value: "[Inserir informação institucional oficial]" },
                    { label: "Endereço", value: "[Inserir informação institucional oficial]" },
                  ].map((item) => (
                    <div key={item.label} className="p-6 text-left" style={{ background: "var(--ink)" }}>
                      <div className="eyebrow eyebrow-on-dark">{item.label}</div>
                      <div className="mt-3 font-serif text-base on-dark">{item.value}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={360}>
                <div className="mt-14 flex justify-center">
                  <a
                    href="#contato"
                    aria-label="Iniciar uma conversa com a equipe da Velox"
                    className="group inline-flex min-h-11 items-center gap-4 border px-10 py-5 text-xs uppercase tracking-[0.28em] transition-colors"
                    style={{ borderColor: "var(--brand-orange)", color: "var(--on-dark)" }}
                  >
                    Iniciar uma conversa
                    <span className="h-px w-8 transition-all group-hover:w-14" style={{ background: "var(--brand-orange)" }} />
                  </a>
                </div>
              </Reveal>
              <Reveal delay={420}>
                <div className="mx-auto mt-16 flex justify-center" style={{ color: "var(--brand-orange)" }}>
                  <VMark className="h-16 w-16" strokeWidth={1.2} />
                </div>
              </Reveal>
            </div>
          </div>
        </SectionShell>
      </main>

      <footer className="surface-graphite relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid-ink opacity-50" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-6 py-14 md:grid-cols-[minmax(0,1fr)_auto] md:px-10">
          <div className="min-w-0">
            <div className="font-serif text-2xl on-dark">Velox Soluções Financeiras</div>
            <div className="mt-2 text-xs uppercase tracking-[0.24em] on-dark-muted">
              © {new Date().getFullYear()} — Manual do Investidor · Edição Institucional
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs uppercase tracking-[0.24em] on-dark-muted">
            <span className="h-px w-8" style={{ background: "var(--brand-orange)" }} />
            <span>MMXXVI · Velox</span>
          </div>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}