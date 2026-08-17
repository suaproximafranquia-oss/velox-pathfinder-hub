/**
 * CAMADA B — MENSAGENS DE HOMOLOGAÇÃO (COMANDO 3A §2, §3).
 *
 * Estas mensagens NÃO são templates oficiais da Meta. Elas não possuem
 * nome oficial, ID, status nem categoria, nunca são enviadas pela API
 * real e jamais atingem um telefone real. Servem exclusivamente para
 * comprovar, dentro da homologação, que o comportamento do motor
 * funciona de verdade: aparecem na timeline, participam da decisão,
 * respeitam a ordem da cadência e entram na auditoria.
 *
 * A CAMADA A (template oficial Meta) continua vivendo em
 * `templates.ts` — as duas estruturas nunca se misturam.
 */
import type { CadenceStep } from "./types";
import { NEUTRAL_TREATMENT, resolveTreatment, type TreatmentSource } from "./names";

export type HomologationMessage = {
  /** Código interno da mensagem de homologação (nunca um ID da Meta). */
  code: string;
  step: CadenceStep;
  purpose: string;
  /** Grupo da Biblioteca de Conteúdos usado por esta etapa (se houver). */
  contentGroup: string | null;
  /** Trata o investidor pelo nome quando ele estiver confirmado. */
  usesInvestorName: boolean;
  /**
   * Botão do template: "portal" usa {{link_portal}}, "content" usa a URL
   * do conteúdo da Biblioteca. A URL NUNCA aparece no corpo do texto.
   * É apenas a representação visual do comportamento do template — nada
   * é enviado ou registrado na Meta.
   */
  button: "portal" | "content" | null;
  text: string;
};

/** Variável de conteúdo da etapa: {{conteudo_e1}}, {{conteudo_r2}}… (§14). */
const CONTENT_PLACEHOLDER = /\n*\{\{conteudo_[a-z0-9]+\}\}\n*/;

export const HOMOLOGATION_MESSAGES: Record<CadenceStep, HomologationMessage> = {
  E0: {
    code: "HOMOL-E0",
    step: "E0",
    purpose: "primeiro_contato",
    contentGroup: null,
    usesInvestorName: false,
    button: "portal",
    text: `Olá, caro investidor, tudo bem?

Meu nome é {{nome_executivo}} e sou Executivo de Expansão da Velox Soluções Financeiras.

Se você demonstrou interesse em conhecer a Velox, estou à disposição para apresentar nossa estrutura, modelo de negócio e oportunidade.

Preparei um espaço com as principais informações para você conhecer nossa proposta com mais calma.

Após analisar esse material, vamos alinhar um horário para conversarmos. Me informe duas opções de horário que funcionam melhor para você.`,
  },
  E1: {
    code: "HOMOL-E1",
    step: "E1",
    purpose: "segundo_contato",
    contentGroup: "E1",
    usesInvestorName: false,
    button: "content",
    text: `Olá, caro investidor.

Passando para saber se você conseguiu acessar as informações que enviei sobre a Velox.

Se tiver alguma dúvida sobre o modelo de negócio, investimento ou estrutura da franquia, posso ajudá-lo a entender os principais pontos.

Também quero compartilhar com você uma informação que pode contribuir para a sua análise.

{{conteudo_e1}}

Depois de analisar esse material, podemos alinhar um horário para conversar e entender melhor o que você busca.`,
  },
  E3: {
    code: "HOMOL-E3",
    step: "E3",
    purpose: "terceiro_contato",
    contentGroup: "E3",
    usesInvestorName: false,
    button: "content",
    text: `Olá, caro investidor.

Os dias passam rapidamente e sei que a rotina pode acabar dificultando esse tipo de análise.

Por isso, não quero apenas ficar cobrando um retorno. Quero compartilhar com você mais uma informação que pode contribuir para entender melhor a oportunidade da Velox.

{{conteudo_e3}}

Como eu já havia mencionado, minha disponibilidade é bem ampla. Podemos ajustar de manhã, à tarde ou à noite.

Me informe sua disponibilidade e vamos organizar esse próximo passo.`,
  },
  E4: {
    code: "HOMOL-E4",
    step: "E4",
    purpose: "quarto_contato",
    contentGroup: null,
    usesInvestorName: false,
    button: null,
    text: `Olá, caro investidor.

Já compartilhei com você o Portal do Investidor e algumas informações sobre a Velox, e neste momento acredito que uma conversa objetiva seja o melhor caminho para entendermos se essa oportunidade realmente está alinhada ao que você procura.

Como eu já havia mencionado, minha disponibilidade é bem ampla. Podemos ajustar de manhã, à tarde ou à noite.

Me informe sua disponibilidade e vamos organizar esse próximo passo.`,
  },
  E12: {
    code: "HOMOL-E12",
    step: "E12",
    purpose: "encerramento",
    contentGroup: "FINALIZACAO",
    usesInvestorName: false,
    button: "content",
    text: `Olá, caro investidor.

Recebi seu cadastro e, desde então, tentei estabelecer contato algumas vezes por mensagem e ligação, mas por algum motivo não conseguimos avançar.

Para não transformar esse acompanhamento em uma sequência de cobranças, vou encerrar minhas tentativas de contato neste momento.

Gosto de ser persistente, mas não de ser insistente.

Minha disponibilidade continua ampla caso você queira conversar em outro momento.

Se a oportunidade voltar a fazer sentido para você, basta me chamar por este WhatsApp ou realizar um novo cadastro em um dos nossos canais.

Antes de encerrar, quero deixar com você uma última reflexão: como nunca conseguimos evoluir para uma conversa, fica a pergunta — você prefere continuar acompanhando a história de quem está crescendo ou começar a construir a sua própria história?

{{conteudo_final}}

Desejo sucesso na sua análise e nos seus próximos projetos.`,
  },
  V3: {
    code: "HOMOL-V3",
    step: "V3",
    purpose: "visualizacao_sem_resposta",
    // §18: não anexar conteúdo automaticamente, salvo configuração
    // explícita para usar o grupo V3.
    contentGroup: null,
    usesInvestorName: false,
    button: null,
    text: `Olá, caro investidor, tudo bem?

Sei que a rotina é corrida e que conhecer uma nova oportunidade exige tempo e atenção.

Porém, percebi que você visualizou minhas mensagens e ainda não conseguimos conversar.

Não quero transformar isso em uma sequência de cobranças.

Prefiro continuar contribuindo para a sua análise e deixar claro que estou disponível para entender se a Velox realmente faz sentido para o seu próximo projeto.

Neste momento, mais do que uma nova cobrança, acredito que seja importante você avaliar se essa oportunidade está alinhada ao que procura.`,
  },
  V4: {
    code: "HOMOL-V4",
    step: "V4",
    purpose: "visualizacao_firme",
    contentGroup: null,
    usesInvestorName: false,
    button: null,
    text: `Olá, caro investidor.

Já compartilhei com você o Portal do Investidor e algumas informações sobre a Velox, e percebi que você teve contato com esse material.

Por isso, prefiro não continuar insistindo.

Nem sempre o meu momento é o seu momento, e talvez agora simplesmente não seja a melhor hora para essa conversa.

Vou interromper minhas tentativas de contato por aqui para não transformar meu acompanhamento em insistência.

Caso a oportunidade faça sentido para você posteriormente, este canal continuará disponível para conversarmos.`,
  },
  R1: {
    code: "HOMOL-R1",
    step: "R1",
    purpose: "reengajamento_1",
    contentGroup: "R1",
    usesInvestorName: true,
    button: "content",
    text: `Olá, {{nome_investidor}}, tudo bem?

Vi que conseguimos iniciar nossa conversa, mas acabamos não conseguindo evoluir para o próximo passo.

Sei que os dias são corridos e nem sempre conseguimos falar no momento ideal.

Por isso, quero alinhar novamente sua disponibilidade para que possamos conversar com calma.

Minha disponibilidade é bem ampla e podemos ajustar de manhã, à tarde ou à noite.

Me diga qual período funciona melhor para você e seguimos a partir daí.

Enquanto isso, também quero compartilhar uma informação que pode contribuir para você conhecer melhor a Velox.

{{conteudo_r1}}`,
  },
  R2: {
    code: "HOMOL-R2",
    step: "R2",
    purpose: "reengajamento_2",
    contentGroup: "R2",
    usesInvestorName: true,
    button: "content",
    text: `Olá, {{nome_investidor}}, tudo bem?

Percebi que nossa conversa acabou ficando sem continuidade.

Não quero ficar insistindo de forma excessiva, porque meu objetivo aqui é ajudá-lo a avaliar a oportunidade, e não simplesmente cobrar uma resposta.

Por isso, além de tentar novamente o contato, quero deixar com você mais uma informação sobre a Velox que pode contribuir para sua análise.

{{conteudo_r2}}

Quando fizer sentido avançarmos, me informe sua disponibilidade e ajustamos o horário da conversa.`,
  },
  R3: {
    code: "HOMOL-R3",
    step: "R3",
    purpose: "reengajamento_encerramento",
    contentGroup: null,
    usesInvestorName: true,
    button: null,
    text: `Olá, {{nome_investidor}}, tudo bem?

Já tentei retomar nossa conversa algumas vezes e percebi que, mesmo tendo iniciado o contato anteriormente, não conseguimos encontrar um momento para evoluir.

Eu gosto de ser persistente, mas não de ser insistente.

Por isso, vou encerrar minhas tentativas de contato neste momento para não transformar nosso relacionamento em uma sequência de cobranças.

Minha disponibilidade continua aberta para conversarmos pela manhã, à tarde ou à noite, caso esse assunto volte a fazer sentido para você.

Se quiser retomar, basta me chamar por este WhatsApp.`,
  },
  /**
   * FLUXO 4 — REENTRADA (COMANDO 2B §3–§6). Reconhece o histórico
   * anterior sem cobrar o investidor por não ter dado retorno.
   */
  RE0: {
    code: "HOMOL-RE0",
    step: "RE0",
    purpose: "reentrada_contato",
    contentGroup: null,
    usesInvestorName: true,
    button: "portal",
    text: `Olá, {{nome_investidor}}, tudo bem?

Aqui é {{nome_executivo}}, Executivo de Expansão da Velox Soluções Financeiras.

Vi que você demonstrou interesse novamente em conhecer a Velox, e isso normalmente significa que o assunto continua fazendo sentido para você.

Deixo aqui novamente o espaço com as informações sobre nossa estrutura, modelo de negócio e investimento, para que você possa retomar sua análise de onde parou.

Quando quiser conversar, me informe dois horários que funcionem melhor para você.`,
  },
  RE1: {
    code: "HOMOL-RE1",
    step: "RE1",
    purpose: "reentrada_criterios",
    contentGroup: "RE1",
    usesInvestorName: true,
    button: "content",
    text: `Olá, {{nome_investidor}}.

Como você voltou a se interessar pelo tema, quero contribuir com algo prático: os critérios que realmente importam ao avaliar uma franquia.

Entender rentabilidade, suporte, maturação e perfil do franqueado costuma evitar decisões precipitadas — em qualquer marca.

{{conteudo_re1}}

Se preferir, podemos conversar e analisar esses pontos juntos. Minha disponibilidade é ampla: manhã, tarde ou noite.`,
  },
  RE2: {
    code: "HOMOL-RE2",
    step: "RE2",
    purpose: "reentrada_estrutura",
    contentGroup: "RE2",
    usesInvestorName: true,
    button: "content",
    text: `Olá, {{nome_investidor}}.

Além dos números, o que costuma diferenciar uma operação é a estrutura por trás dela: treinamento, acompanhamento e suporte contínuo ao franqueado.

Separei uma informação que mostra como esse suporte funciona na prática dentro da Velox.

{{conteudo_re2}}

Se fizer sentido, me informe sua disponibilidade e organizamos uma conversa objetiva.`,
  },
  RE3: {
    code: "HOMOL-RE3",
    step: "RE3",
    purpose: "reentrada_encerramento",
    contentGroup: "FINALIZACAO",
    usesInvestorName: true,
    button: "content",
    text: `Olá, {{nome_investidor}}.

Compartilhei com você as principais informações sobre a Velox e percebi que ainda não conseguimos encontrar um momento para conversar.

Vou encerrar minhas tentativas por aqui para não transformar esse contato em uma sequência de cobranças.

Como você voltou a demonstrar interesse recentemente, deixo uma última reflexão antes de encerrar: você prefere continuar acompanhando a história de quem está crescendo ou começar a construir a sua própria história?

{{conteudo_final}}

Minha disponibilidade continua aberta pela manhã, à tarde ou à noite. Se o assunto voltar a fazer sentido, basta me chamar por este WhatsApp.`,
  },
  /**
   * FLUXO 5 — RELACIONAMENTO ESFRIADO (COMANDO 3D §19, §20).
   * O investidor JÁ conversou de verdade: as mensagens reconhecem isso
   * e nunca tratam o lead como um contato novo.
   */
  RF0: {
    code: "HOMOL-RF0",
    step: "RF0",
    purpose: "relacionamento_frio_retomada",
    contentGroup: null,
    usesInvestorName: true,
    button: null,
    text: `Olá, {{nome_investidor}}, tudo bem?

Nós tínhamos combinado um horário para conversarmos, mas acabou que não conseguimos evoluir com este bate-papo.

Eu entendo que a correria do dia a dia muitas vezes atrapalha e está tudo bem.

Quando fizer sentido para você, me envie duas opções de horário que funcionem melhor e eu organizo um novo horário para conversarmos.

Fico à disposição.`,
  },
  RF1: {
    code: "HOMOL-RF1",
    step: "RF1",
    purpose: "relacionamento_frio_encerramento",
    contentGroup: "FINALIZACAO",
    usesInvestorName: true,
    button: "content",
    text: `Olá, {{nome_investidor}}.

Como não conseguimos retomar nossa conversa, não quero ser insistente e vou encerrar minhas tentativas de contato por aqui.

Antes de encerrar, quero deixar com você uma última reflexão que acredito que faça sentido neste momento.

Afinal, você prefere continuar acompanhando a história de quem está crescendo ou começar a construir a sua própria história?

{{conteudo_final}}`,
  },
};

export type RenderInput = {
  executiveName: string;
  portalLink: string;
  /** Nome do investidor SOMENTE quando confirmado (§11, §21). */
  confirmedInvestorName?: string | null;
  /** Nome bruto do cadastro — só vira tratamento se a base reconhecer (§24). */
  rawInvestorName?: string | null;
  /** Nome digitado manualmente pelo Executivo (§23). */
  executiveProvidedName?: string | null;
  /** Executivo respondeu NÃO à sugestão de nome (§22). */
  nameRejected?: boolean;
  /** Título real do conteúdo escolhido na Biblioteca (§6). */
  contentName?: string | null;
  contentUrl?: string | null;
};

export type RenderResult =
  | {
      ok: true;
      body: string;
      usedName: boolean;
      treatment: string;
      treatmentSource: TreatmentSource;
      /** Botão do template — a URL vive aqui, nunca no corpo. */
      button: { label: string; url: string } | null;
    }
  | { ok: false; reason: string };

/**
 * Renderiza a mensagem de homologação. Nenhum texto sai com variável
 * pendente: se faltar valor obrigatório, a mensagem NÃO é produzida.
 */
export function renderHomologationMessage(
  step: CadenceStep,
  input: RenderInput,
): RenderResult {
  const message = HOMOLOGATION_MESSAGES[step];
  if (!message) return { ok: false, reason: `Etapa ${step} sem mensagem de homologação.` };

  const executive = (input.executiveName ?? "").trim();
  const portal = (input.portalLink ?? "").trim();
  if (message.text.includes("{{nome_executivo}}") && !executive) {
    return { ok: false, reason: "Variável {{nome_executivo}} sem valor — mensagem não enviada." };
  }
  if (message.button === "portal" && !portal) {
    return { ok: false, reason: "Variável {{link_portal}} sem valor — mensagem não enviada." };
  }

  const resolution = resolveTreatment({
    confirmedName: input.confirmedInvestorName ?? null,
    executiveProvidedName: input.executiveProvidedName ?? null,
    rawName: input.rawInvestorName ?? null,
    manuallyRejected: input.nameRejected ?? false,
  });
  const treatment = message.usesInvestorName ? resolution.treatment : NEUTRAL_TREATMENT;

  let body = message.text
    .replaceAll("{{nome_executivo}}", executive)
    .replaceAll("{{link_portal}}", portal)
    .replaceAll("{{nome_investidor}}", treatment);

  let button: { label: string; url: string } | null =
    message.button === "portal"
      ? { label: "Acessar Portal do Investidor", url: portal }
      : null;

  if (CONTENT_PLACEHOLDER.test(body)) {
    if (!input.contentName) {
      return {
        ok: false,
        reason: `Etapa ${step} exige conteúdo do grupo ${message.contentGroup} e nenhum conteúdo ativo foi selecionado.`,
      };
    }
    // A URL do conteúdo sai do texto e passa a viver no botão.
    body = body.replace(CONTENT_PLACEHOLDER, "\n\n").trim();
    if (input.contentUrl) {
      button = {
        label: `▶ Assistir conteúdo — ${input.contentName}`,
        url: input.contentUrl,
      };
    }
  }

  if (/\{\{\s*[\w.]+\s*\}\}/.test(body)) {
    return { ok: false, reason: "Mensagem contém variável não resolvida — envio bloqueado." };
  }

  return {
    ok: true,
    body,
    usedName: message.usesInvestorName && resolution.personalized,
    treatment,
    treatmentSource: message.usesInvestorName ? resolution.source : "fallback",
    button,
  };
}