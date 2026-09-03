/**
 * DOCUMENTAÇÃO HISTÓRICA — textos do Word "Biblioteca de Mensagens —
 * Jornada do Investidor" (V2).
 *
 * IMPORTANTE: este documento NÃO é mais a fonte operacional para saber
 * quais etapas existem hoje. A fotografia atual das etapas vive em
 * `src/lib/relationship/current-steps.ts`. Este arquivo permanece
 * preservado, íntegro e disponível para consulta e histórico.
 *
 * Este arquivo é a TRANSCRIÇÃO FIEL do documento oficial. Nada aqui foi
 * reescrito, melhorado ou completado por interpretação. As únicas
 * substituições feitas são as variáveis já previstas pelo próprio
 * documento:
 *
 *   [Nome]                → {{nome_investidor}}
 *   [Nome do Executivo]   → {{nome_executivo}}
 *   [LINK PERSONALIZADO]  → {{link_portal}}
 *   [CONTEÚDO E1] …       → {{conteudo_e1}} … (resolvido pela Biblioteca
 *                           de Conteúdo, conforme as regras do Word)
 *
 * ETAPAS QUE O WORD NÃO POSSUI (E20, E27) NÃO APARECEM AQUI e continuam
 * sem conteúdo oficial. A ausência é intencional e é preservada.
 *
 * Este módulo é apenas o insumo da importação: a fonte de verdade em
 * execução continua sendo a tabela `relationship_message_library`.
 */

export type WordMessage = {
  /** Chave técnica da etapa, exatamente como no Word. */
  stepKey: string;
  /** Título oficial da etapa no Word. */
  title: string;
  /** Versão COM nome do investidor. */
  body: string;
  /** Versão SEM nome do investidor (texto próprio, não é substituição). */
  bodyWithoutName: string;
  contentGroup: string | null;
  button: "portal" | "content" | null;
};

/** Identificação do documento oficial usado nesta importação. */
export const WORD_SOURCE_REFERENCE =
  "Biblioteca_de_Mensagens_Jornada_do_Investidor_V2-2.docx";

export const WORD_MESSAGES: WordMessage[] = [
  {
    stepKey: "E0",
    title: "E0 — Primeiro contato",
    contentGroup: null,
    button: "portal",
    body: `Olá, {{nome_investidor}}, tudo bem?
Meu nome é {{nome_executivo}}, sou gerente de expansão da Velox Soluções Financeiras.
Você cadastrou seus dados e pediu nosso contato. Estou aqui para agendarmos uma conversa e apresentar o modelo de negócio e a oportunidade da Velox.
Preparei um espaço com as principais informações para você conhecer nossa proposta com calma:
{{link_portal}}`,
    bodyWithoutName: `Olá, tudo bem?
Meu nome é {{nome_executivo}}, sou gerente de expansão da Velox Soluções Financeiras.
Você cadastrou seus dados e pediu nosso contato. Estou aqui para agendarmos uma conversa e apresentar o modelo de negócio e a oportunidade da Velox.
Preparei um espaço com as principais informações para você conhecer nossa proposta com calma:
{{link_portal}}`,
  },
  {
    stepKey: "E1",
    title: "E1 — Primeiro acompanhamento",
    contentGroup: "E1",
    button: "content",
    body: `Olá, {{nome_investidor}}.
Passando para saber se você conseguiu acessar as informações que enviei sobre a Velox.
Se tiver alguma dúvida sobre o modelo de negócio, investimento ou estrutura, posso ajudá-lo(a) a entender alguns dos principais pontos.
Também quero compartilhar com você um conteúdo que pode contribuir para a sua análise:
{{conteudo_e1}}`,
    bodyWithoutName: `Olá.
Passando para saber se você conseguiu acessar as informações que enviei sobre a Velox.
Se tiver alguma dúvida sobre o modelo de negócio, investimento ou estrutura, posso ajudá-lo(a) a entender alguns dos principais pontos.
Também quero compartilhar com você um conteúdo que pode contribuir para a sua análise:
{{conteudo_e1}}`,
  },
  {
    stepKey: "E2",
    title: "E2 — Segundo acompanhamento",
    contentGroup: "E2",
    button: "content",
    body: `{{nome_investidor}}, quero continuar contribuindo para sua análise da Velox, sem transformar o contato em cobrança.
Separei mais um conteúdo que pode ajudar você a entender melhor a oportunidade e avaliar se este momento realmente combina com o que você procura:
{{conteudo_e2}}
Vou aguardar você analisar esse conteúdo para que possamos marcar o melhor horário para conversarmos.`,
    bodyWithoutName: `Quero continuar contribuindo para sua análise da Velox, sem transformar o contato em cobrança.
Separei mais um conteúdo que pode ajudar você a entender melhor a oportunidade e avaliar se este momento realmente combina com o que você procura:
{{conteudo_e2}}
Vou aguardar você analisar esse conteúdo para que possamos marcar o melhor horário para conversarmos.`,
  },
  {
    stepKey: "E3",
    title: "E3 — Terceiro acompanhamento",
    contentGroup: "E3",
    button: "content",
    body: `{{nome_investidor}}, os dias passam rapidamente e sei que a rotina pode acabar dificultando esse tipo de análise.
Por isso, não quero apenas ficar cobrando um retorno. Quero compartilhar com você mais um conteúdo que pode contribuir para você entender melhor a oportunidade da Velox:
{{conteudo_e3}}
Como já havia mencionado, minha disponibilidade é bem ampla. Podemos agendar de manhã, de tarde ou de noite.
Não importa sua disponibilidade, vamos organizar esse próximo passo.`,
    bodyWithoutName: `Os dias passam rapidamente e sei que a rotina pode acabar dificultando esse tipo de análise.
Por isso, não quero apenas ficar cobrando um retorno. Quero compartilhar com você mais um conteúdo que pode contribuir para você entender melhor a oportunidade da Velox:
{{conteudo_e3}}
Como já havia mencionado, minha disponibilidade é bem ampla. Podemos agendar de manhã, de tarde ou de noite.
Não importa sua disponibilidade, vamos organizar esse próximo passo.`,
  },
  {
    stepKey: "E5",
    title: "E5 — Oferta de apresentação digital",
    contentGroup: null,
    button: null,
    body: `Olá, {{nome_investidor}}.
Quero te oferecer uma alternativa para conhecer melhor a Velox sem precisar agendar uma conversa neste momento.
Tenho uma apresentação digital que permite conhecer a estrutura, o modelo de negócio e a oportunidade no seu próprio tempo.
Se você quiser receber esse material, me responda por aqui e eu disponibilizo o acesso.`,
    bodyWithoutName: `Olá.
Quero te oferecer uma alternativa para conhecer melhor a Velox sem precisar agendar uma conversa neste momento.
Tenho uma apresentação digital que permite conhecer a estrutura, o modelo de negócio e a oportunidade no seu próprio tempo.
Se você quiser receber esse material, me responda por aqui e eu disponibilizo o acesso.`,
  },
  {
    stepKey: "E6",
    title: "E6 — Acompanhamento da apresentação digital",
    contentGroup: null,
    button: null,
    body: `{{nome_investidor}}, deixei disponível para você a apresentação digital.
O acesso fica disponível por sete dias, e eu preciso que você me dê algum retorno nesse período, mesmo que seja apenas para dizer se o assunto faz sentido ou não para você.
Vou ficar aguardando seu feedback. Posso contar com você?`,
    bodyWithoutName: `Deixei disponível para você a apresentação digital.
O acesso fica disponível por sete dias, e eu preciso que você me dê algum retorno nesse período, mesmo que seja apenas para dizer se o assunto faz sentido ou não para você.
Vou ficar aguardando seu feedback. Posso contar com você?`,
  },
  {
    stepKey: "E7",
    title: "E7 — Finalização",
    contentGroup: null,
    button: null,
    body: `{{nome_investidor}}, espero que você tenha conseguido visualizar o material que enviei.
Tentei contato com você, mas não consegui obter um retorno. Como não quero transformar nosso relacionamento em uma sequência de cobranças, vou encerrar minhas tentativas por aqui.
Seu cadastro permanece por aqui de forma inativa. Se esse assunto voltar a fazer sentido para você em outro momento, é só me chamar neste WhatsApp.`,
    bodyWithoutName: `Espero que você tenha conseguido visualizar o material que enviei.
Tentei contato, mas não consegui obter um retorno. Como não quero transformar nosso relacionamento em uma sequência de cobranças, vou encerrar minhas tentativas por aqui.
Seu cadastro permanece por aqui de forma inativa. Se esse assunto voltar a fazer sentido para você em outro momento, é só me chamar neste WhatsApp.`,
  },
  {
    stepKey: "R1",
    title: "R1 — Reengajamento",
    contentGroup: "R1",
    button: "content",
    body: `{{nome_investidor}}, vi que conseguimos iniciar nossa conversa, mas acabamos não conseguindo evoluir para o próximo passo.
Sei que os dias são corridos e nem sempre conseguimos falar no momento ideal. Por isso, quero alinhar novamente sua disponibilidade para que possamos conversar.
Minha disponibilidade é ampla. Me diga qual período fica bom para você e seguimos a partir daí.
Enquanto isso, também quero compartilhar um conteúdo que pode contribuir para você conhecer melhor a Velox:
{{conteudo_r1}}`,
    bodyWithoutName: `Vi que conseguimos iniciar nossa conversa, mas acabamos não conseguindo evoluir para o próximo passo.
Sei que os dias são corridos e nem sempre conseguimos falar no momento ideal. Por isso, quero alinhar novamente sua disponibilidade para que possamos conversar.
Minha disponibilidade é ampla. Me diga qual período fica bom para você e seguimos a partir daí.
Enquanto isso, também quero compartilhar um conteúdo que pode contribuir para você conhecer melhor a Velox:
{{conteudo_r1}}`,
  },
  {
    stepKey: "R2",
    title: "R2 — Segundo reengajamento",
    contentGroup: "R2",
    button: "content",
    body: `{{nome_investidor}}, percebi que nossa conversa acabou ficando sem continuidade.
Não quero ficar insistindo de forma excessiva, porque meu objetivo aqui é ajudá-lo(a) a avaliar a oportunidade, não simplesmente cobrar uma resposta.
Por isso, além de tentar novamente o contato, quero deixar com você mais um conteúdo sobre a Velox que pode contribuir para a sua análise:
{{conteudo_r2}}
Quando fizer sentido avançarmos, me informe.`,
    bodyWithoutName: `Percebi que nossa conversa acabou ficando sem continuidade.
Não quero ficar insistindo de forma excessiva, porque meu objetivo aqui é ajudá-lo(a) a avaliar a oportunidade, não simplesmente cobrar uma resposta.
Por isso, além de tentar novamente o contato, quero deixar com você mais um conteúdo sobre a Velox que pode contribuir para a sua análise:
{{conteudo_r2}}
Quando fizer sentido avançarmos, me informe.`,
  },
  {
    stepKey: "R3",
    title: "R3 — Finalização do reengajamento",
    contentGroup: null,
    button: null,
    body: `{{nome_investidor}}, já tentei retomar nossa conversa algumas vezes e percebi que, mesmo tendo iniciado o contato anteriormente, ainda não conseguimos encontrar um momento para evoluir.
Eu gosto de ser persistente, mas não quero ser insistente. Por isso, vou encerrar minhas tentativas de contato por aqui.
Antes disso, quero te oferecer uma alternativa: posso disponibilizar uma apresentação digital para você conhecer a estrutura, o modelo de negócio e a oportunidade da Velox no seu próprio tempo, sem precisar agendar uma conversa agora.
Se essa opção fizer sentido para você, me responda por aqui e eu te envio.`,
    bodyWithoutName: `Já tentei retomar nossa conversa algumas vezes e percebi que, mesmo tendo iniciado o contato anteriormente, ainda não conseguimos encontrar um momento para evoluir.
Eu gosto de ser persistente, mas não quero ser insistente. Por isso, vou encerrar minhas tentativas de contato por aqui.
Antes disso, quero te oferecer uma alternativa: posso disponibilizar uma apresentação digital para você conhecer a estrutura, o modelo de negócio e a oportunidade da Velox no seu próprio tempo, sem precisar agendar uma conversa agora.
Se essa opção fizer sentido para você, me responda por aqui e eu te envio.`,
  },
  {
    stepKey: "RE0",
    title: "RE0 — Reentrada",
    contentGroup: null,
    button: "portal",
    body: `Olá, {{nome_investidor}}.
Vi que você voltou a demonstrar interesse em conhecer a Velox, e isso normalmente significa que o assunto continua fazendo sentido para você.
Deixo novamente um espaço com informações sobre nossa estrutura, modelo de negócio e investimento, para que você possa retomar a jornada de onde parou:
{{link_portal}}
Quero conversar com você. Me informe duas opções de horário que sejam boas para você.`,
    bodyWithoutName: `Olá.
Vi que você voltou a demonstrar interesse em conhecer a Velox, e isso normalmente significa que o assunto continua fazendo sentido para você.
Deixo novamente um espaço com informações sobre nossa estrutura, modelo de negócio e investimento, para que você possa retomar a jornada de onde parou:
{{link_portal}}
Quero conversar com você. Me informe duas opções de horário que sejam boas para você.`,
  },
  {
    stepKey: "RE1",
    title: "RE1 — Reentrada / conteúdo",
    contentGroup: "RE1",
    button: "content",
    body: `{{nome_investidor}}, como você voltou a se interessar pelo tema, quero contribuir com algo prático.
Alguns critérios realmente importam para avaliar uma franquia: entender rentabilidade, suporte, maturação e perfil do franqueado costuma evitar decisões precipitadas em qualquer marca.
Separei um conteúdo sobre esse assunto:
{{conteudo_re1}}
Se preferir, podemos conversar e analisar esses pontos juntos. Minha disponibilidade é ampla.`,
    bodyWithoutName: `Como você voltou a se interessar pelo tema, quero contribuir com algo prático.
Alguns critérios realmente importam para avaliar uma franquia: entender rentabilidade, suporte, maturação e perfil do franqueado costuma evitar decisões precipitadas em qualquer marca.
Separei um conteúdo sobre esse assunto:
{{conteudo_re1}}
Se preferir, podemos conversar e analisar esses pontos juntos. Minha disponibilidade é ampla.`,
  },
  {
    stepKey: "RE2",
    title: "RE2 — Reentrada / suporte",
    contentGroup: "RE2",
    button: "content",
    body: `{{nome_investidor}}, além dos números que costumam diferenciar uma operação, existe a estrutura por trás dela: treinamento, acompanhamento e suporte contínuo ao franqueado.
Separei um conteúdo que mostra como esse suporte funciona na prática dentro da Velox:
{{conteudo_re2}}
Se fizer sentido avançarmos, me informe qual período fica bom para conversarmos.`,
    bodyWithoutName: `Além dos números que costumam diferenciar uma operação, existe a estrutura por trás dela: treinamento, acompanhamento e suporte contínuo ao franqueado.
Separei um conteúdo que mostra como esse suporte funciona na prática dentro da Velox:
{{conteudo_re2}}
Se fizer sentido avançarmos, me informe qual período fica bom para conversarmos.`,
  },
  {
    stepKey: "RE3",
    title: "RE3 — Finalização / oferta digital",
    contentGroup: null,
    button: null,
    body: `{{nome_investidor}}, compartilhei com você as principais informações sobre a Velox e percebi que ainda não conseguimos encontrar um momento para conversar.
Vou encerrar minhas tentativas por aqui para não transformar esse contato em uma sequência de cobranças.
Como você voltou a demonstrar interesse recentemente, quero te oferecer uma última alternativa: uma apresentação digital para você conhecer a Velox no seu próprio tempo, sem precisar agendar uma conversa agora.
Se quiser receber, me responda por aqui e eu disponibilizo o acesso.`,
    bodyWithoutName: `Compartilhei com você as principais informações sobre a Velox e percebi que ainda não conseguimos encontrar um momento para conversar.
Vou encerrar minhas tentativas por aqui para não transformar esse contato em uma sequência de cobranças.
Como você voltou a demonstrar interesse recentemente, quero te oferecer uma última alternativa: uma apresentação digital para você conhecer a Velox no seu próprio tempo, sem precisar agendar uma conversa agora.
Se quiser receber, me responda por aqui e eu disponibilizo o acesso.`,
  },
  {
    stepKey: "RF0",
    title: "RF0 — Follow-up de reunião",
    contentGroup: null,
    button: null,
    body: `{{nome_investidor}}, nós tínhamos combinado um horário para conversarmos, mas acabamos não conseguindo evoluir com esse bate-papo.
Entendo que a correria do dia a dia muitas vezes atrapalha, e está tudo bem.
Quero reorganizar esse próximo passo com você. Me informe duas opções de horário que sejam boas para você, e vamos agendar a conversa.`,
    bodyWithoutName: `Nós tínhamos combinado um horário para conversarmos, mas acabamos não conseguindo evoluir com esse bate-papo.
Entendo que a correria do dia a dia muitas vezes atrapalha, e está tudo bem.
Quero reorganizar esse próximo passo com você. Me informe duas opções de horário que sejam boas para você, e vamos agendar a conversa.`,
  },
  {
    stepKey: "RF1",
    title: "RF1 — Finalização / alternativa digital",
    contentGroup: null,
    button: null,
    body: `{{nome_investidor}}, como não conseguimos retomar nossa conversa, não quero ser insistente e vou encerrar minhas tentativas de contato por aqui.
Antes de encerrar, quero te oferecer mais uma possibilidade: uma apresentação digital para você conhecer a estrutura e a oportunidade da Velox no seu próprio tempo, sem precisar agendar uma conversa agora.
Se quiser receber esse material, me responda por aqui e eu disponibilizo o acesso.`,
    bodyWithoutName: `Como não conseguimos retomar nossa conversa, não quero ser insistente e vou encerrar minhas tentativas de contato por aqui.
Antes de encerrar, quero te oferecer mais uma possibilidade: uma apresentação digital para você conhecer a estrutura e a oportunidade da Velox no seu próprio tempo, sem precisar agendar uma conversa agora.
Se quiser receber esse material, me responda por aqui e eu disponibilizo o acesso.`,
  },
];

/** Etapas que o Word NÃO possui e que continuam sem conteúdo oficial. */
export const WORD_ABSENT_STEPS = ["E27"] as const;

/**
 * WORD -> CHAVE TÉCNICA DO MOTOR.
 *
 * O Word é a fonte oficial do CONTEÚDO e do RÓTULO editorial; a CHAVE
 * TÉCNICA pertence ao motor e nunca é renomeada. A nomenclatura
 * editorial do documento (E2, E5, E6, E7) não coincide com as chaves
 * executáveis (E3, E4, E12, E20, FINALIZACAO) — este mapa é a única
 * tradução autorizada entre os dois mundos.
 */
export const WORD_STEP_TO_ENGINE_STEP: Record<string, string> = {
  E2: "E3",
  E3: "E4",
  E5: "E12",
  E6: "E20",
  E7: "FINALIZACAO",
};

/**
 * Etapas técnicas que RECEBEM texto do Word mas permanecem INATIVAS até
 * a Gestão ativar o conteúdo oficial. E20 é evento paralelo e a
 * FINALIZAÇÃO fecha o ciclo: o texto fica disponível na Biblioteca,
 * versionado, mas o motor continua bloqueado até a ativação explícita.
 */
export const AWAITING_ACTIVATION_STEPS = ["E20", "FINALIZACAO"] as const;

/** Chave técnica correspondente a uma etapa editorial do Word. */
export function engineStepForWord(stepKey: string): string {
  return WORD_STEP_TO_ENGINE_STEP[stepKey] ?? stepKey;
}

export function wordMessage(stepKey: string): WordMessage | null {
  return WORD_MESSAGES.find((m) => m.stepKey === stepKey) ?? null;
}

/** Mensagem oficial do Word que alimenta uma CHAVE TÉCNICA do motor. */
export function wordMessageForEngineStep(engineStep: string): WordMessage | null {
  return WORD_MESSAGES.find((m) => engineStepForWord(m.stepKey) === engineStep) ?? null;
}
