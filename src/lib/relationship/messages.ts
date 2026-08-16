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

export type HomologationMessage = {
  /** Código interno da mensagem de homologação (nunca um ID da Meta). */
  code: string;
  step: CadenceStep;
  purpose: string;
  /** Grupo da Biblioteca de Conteúdos usado por esta etapa (se houver). */
  contentGroup: string | null;
  /** Trata o investidor pelo nome quando ele estiver confirmado. */
  usesInvestorName: boolean;
  text: string;
};

const CONTENT_PLACEHOLDER = /\[CONTEÚDO DE VALOR — GRUPO [A-Z0-9]+\]/;

export const HOMOLOGATION_MESSAGES: Record<CadenceStep, HomologationMessage> = {
  E0: {
    code: "HOMOL-E0",
    step: "E0",
    purpose: "primeiro_contato",
    contentGroup: null,
    usesInvestorName: false,
    text: `Olá, caro investidor, tudo bem?

Meu nome é {{nome_executivo}} e sou Executivo de Expansão da Velox Soluções Financeiras.

Sei que você demonstrou interesse em conhecer a Velox e estou à disposição para apresentar nossa estrutura, modelo de negócio e oportunidade.

Preparei um espaço com as principais informações para você conhecer nossa proposta com mais calma.

{{link_portal}}

Após analisar esse material, vamos alinhar um horário para conversarmos. Me informe duas opções de horário que funcionam melhor para você.`,
  },
  E1: {
    code: "HOMOL-E1",
    step: "E1",
    purpose: "segundo_contato",
    contentGroup: "E1",
    usesInvestorName: false,
    text: `Olá, caro investidor.

Passando para saber se você conseguiu acessar as informações que enviei sobre a Velox.

Sei que conhecer uma nova oportunidade exige atenção, por isso quero compartilhar com você um conteúdo que pode ajudar na sua análise e trazer um pouco mais de clareza sobre o nosso modelo.

[CONTEÚDO DE VALOR — GRUPO E1]

Depois de analisar esse material, podemos alinhar um horário para conversar e entender melhor o que você busca.`,
  },
  E3: {
    code: "HOMOL-E3",
    step: "E3",
    purpose: "terceiro_contato",
    contentGroup: "E3",
    usesInvestorName: false,
    text: `Olá, caro investidor.

Os dias passam rapidamente e sei que a rotina pode acabar dificultando esse tipo de análise.

Por isso, não quero apenas ficar cobrando um retorno. Quero compartilhar com você mais uma informação que pode contribuir para entender melhor a oportunidade da Velox.

[CONTEÚDO DE VALOR — GRUPO E3]

Como eu já havia mencionado, minha disponibilidade é bem ampla. Podemos ajustar de manhã, à tarde ou à noite. Quando você definir sua disponibilidade, nós ajustamos a agenda.`,
  },
  E4: {
    code: "HOMOL-E4",
    step: "E4",
    purpose: "quarto_contato",
    contentGroup: null,
    usesInvestorName: false,
    text: `Olá, caro investidor.

Já compartilhei com você o Portal do Investidor e algumas informações sobre a Velox, e neste momento acredito que uma conversa objetiva seja o melhor caminho para entendermos se essa oportunidade realmente está alinhada ao que você procura.

Como eu já havia mencionado, minha disponibilidade é bem ampla. Podemos ajustar de manhã, à tarde ou à noite.

Me informe sua disponibilidade e vamos organizar esse próximo passo.`,
  },
  E12: {
    code: "HOMOL-E12",
    step: "E12",
    purpose: "encerramento",
    contentGroup: null,
    usesInvestorName: false,
    text: `Olá, caro investidor.

Recebi seu cadastro e, desde então, tentei estabelecer contato algumas vezes por mensagem e ligação, mas por algum motivo não conseguimos avançar.

Para não transformar esse acompanhamento em uma sequência de cobranças, vou encerrar minhas tentativas de contato neste momento.

Gosto de ser persistente, mas não de ser insistente.

Minha disponibilidade continua ampla caso você queira conversar em outro momento.

Se a oportunidade voltar a fazer sentido para você, basta me chamar por este WhatsApp ou realizar um novo cadastro em um dos nossos canais.

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
    text: `Olá, caro investidor, tudo bem?

Sei que a rotina é corrida e que conhecer uma nova oportunidade exige tempo e atenção.

Porém, percebi que você visualizou minhas mensagens e ainda não conseguimos conversar.

Não quero transformar isso em uma sequência de cobranças. Prefiro continuar contribuindo para a sua análise e deixar claro que estou disponível para entender se a Velox realmente faz sentido para o seu próximo projeto.

Nesse momento, mais do que uma nova cobrança, acredito que seja importante você avaliar se essa oportunidade está alinhada ao que procura.`,
  },
  V4: {
    code: "HOMOL-V4",
    step: "V4",
    purpose: "visualizacao_firme",
    contentGroup: null,
    usesInvestorName: false,
    text: `Olá, caro investidor.

Já compartilhei com você o Portal e algumas informações sobre a Velox, e percebi que você teve contato com esse material.

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
    text: `Olá, {{nome_investidor}}, tudo bem?

Vi que conseguimos iniciar nossa conversa, mas acabamos não conseguindo evoluir para o próximo passo.

Sei que os dias são corridos e nem sempre conseguimos falar no momento ideal.

Por isso, quero alinhar novamente sua disponibilidade para que possamos conversar com calma.

Minha disponibilidade é bem ampla e podemos ajustar de manhã, à tarde ou à noite.

Me diga qual período funciona melhor para você e seguimos a partir daí.

Enquanto isso, também quero compartilhar uma informação que pode contribuir para você conhecer melhor a Velox.

[CONTEÚDO DE VALOR — GRUPO R1]`,
  },
  R2: {
    code: "HOMOL-R2",
    step: "R2",
    purpose: "reengajamento_2",
    contentGroup: "R2",
    usesInvestorName: true,
    text: `Olá, {{nome_investidor}}, tudo bem?

Percebi que nossa conversa acabou ficando sem continuidade.

Não quero ficar insistindo de forma excessiva, porque meu objetivo aqui é ajudá-lo a avaliar a oportunidade, e não simplesmente cobrar uma resposta.

Por isso, além de tentar novamente o contato, quero deixar com você mais uma informação sobre a Velox que pode contribuir para sua análise.

[CONTEÚDO DE VALOR — GRUPO R2]

Quando fizer sentido avançarmos, me informe sua disponibilidade e ajustamos o horário da conversa.`,
  },
  R3: {
    code: "HOMOL-R3",
    step: "R3",
    purpose: "reengajamento_encerramento",
    contentGroup: null,
    usesInvestorName: true,
    text: `Olá, {{nome_investidor}}, tudo bem?

Já tentei retomar nossa conversa algumas vezes e percebi que, mesmo tendo iniciado o contato anteriormente, não conseguimos encontrar um momento para evoluir.

Eu gosto de ser persistente, mas não de ser insistente.

Por isso, vou encerrar minhas tentativas de contato neste momento para não transformar nosso relacionamento em uma sequência de cobranças.

Minha disponibilidade continua aberta para conversarmos pela manhã, à tarde ou à noite, caso esse assunto volte a fazer sentido para você.

Se quiser retomar, basta me chamar por este WhatsApp.`,
  },
};

export type RenderInput = {
  executiveName: string;
  portalLink: string;
  /** Nome do investidor SOMENTE quando confirmado (§11, §21). */
  confirmedInvestorName?: string | null;
  /** Título real do conteúdo escolhido na Biblioteca (§6). */
  contentName?: string | null;
  contentUrl?: string | null;
};

export type RenderResult =
  | { ok: true; body: string; usedName: boolean }
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
  if (message.text.includes("{{link_portal}}") && !portal) {
    return { ok: false, reason: "Variável {{link_portal}} sem valor — mensagem não enviada." };
  }

  const confirmed = (input.confirmedInvestorName ?? "").trim();
  const treatment = confirmed || "caro investidor";

  let body = message.text
    .replaceAll("{{nome_executivo}}", executive)
    .replaceAll("{{link_portal}}", portal)
    .replaceAll("{{nome_investidor}}", treatment);

  if (CONTENT_PLACEHOLDER.test(body)) {
    if (!input.contentName) {
      return {
        ok: false,
        reason: `Etapa ${step} exige conteúdo do grupo ${message.contentGroup} e nenhum conteúdo ativo foi selecionado.`,
      };
    }
    const line = input.contentUrl
      ? `${input.contentName}\n${input.contentUrl}`
      : input.contentName;
    body = body.replace(CONTENT_PLACEHOLDER, line);
  }

  if (/\{\{\s*[\w.]+\s*\}\}/.test(body)) {
    return { ok: false, reason: "Mensagem contém variável não resolvida — envio bloqueado." };
  }

  return { ok: true, body, usedName: message.usesInvestorName && Boolean(confirmed) };
}