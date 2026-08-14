/**
 * Templates oficiais do CRM de Relacionamento.
 *
 * Uma única estrutura serve tanto ao envio manual (compositor da conversa)
 * quanto ao futuro motor de cadência: cada template declara finalidade,
 * ordem, passo da cadência, canal, variáveis e estado.
 *
 * O corpo NUNCA carrega nome próprio gravado: o executivo responsável e o
 * link do Portal do Investidor entram por variável, resolvidas no momento
 * do uso.
 */
export type CrmTemplateVariable = "nome_executivo" | "link_portal_investidor";

export type CrmTemplate = {
  id: string;
  label: string;
  /** Para que serve — texto curto de gestão. */
  purpose: string;
  /** Ordem de exibição/organização. */
  order: number;
  /** Passo da cadência (D1, D2, D4, D5, D12). Fora da cadência: null. */
  cadenceStep: number | null;
  channel: "whatsapp";
  active: boolean;
  variables: CrmTemplateVariable[];
  /** Texto oficial, com variáveis não resolvidas. */
  body: string;
};

export const CRM_TEMPLATES: CrmTemplate[] = [
  {
    id: "primeiro_contato",
    label: "Primeiro Contato",
    purpose: "Apresentação do executivo e entrega do Portal do Investidor.",
    order: 1,
    cadenceStep: 1,
    channel: "whatsapp",
    active: true,
    variables: ["nome_executivo", "link_portal_investidor"],
    body: `Olá, tudo bem? Aqui é o {{nome_executivo}}, Executivo de Expansão da Velox Soluções Financeiras.

Recebi o seu cadastro com interesse em conhecer mais sobre o nosso modelo de franquia.

Sabemos que, com a correria do dia a dia, nem sempre é possível conversar na primeira tentativa de contato. Por isso, a Velox criou um ambiente exclusivo para quem demonstrou interesse em conhecer melhor a oportunidade.

No Portal do Investidor, você consegue entender como funciona o nosso modelo, conhecer a estrutura da Velox e acessar o nosso Manual do Investidor no seu próprio ritmo.

Acesse por aqui:

{{link_portal_investidor}}

Depois de conhecer o material, me responda por aqui para darmos continuidade ao seu atendimento.`,
  },
  {
    id: "segundo_contato",
    label: "Segundo Contato",
    purpose: "Acompanhamento do acesso ao material enviado.",
    order: 2,
    cadenceStep: 2,
    channel: "whatsapp",
    active: true,
    variables: [],
    body: `Olá! Tudo bem? Espero que você tenha conseguido acessar o material que te enviei.

A ideia é justamente que você possa conhecer primeiro a Velox, entender nosso modelo e avaliar se faz sentido para o seu momento.

Quando avançar nessa primeira etapa, me responda por aqui para que possamos conversar sobre o seu perfil e os próximos passos.`,
  },
  {
    id: "terceiro_contato",
    label: "Terceiro Contato",
    purpose: "Retomada leve após alguns dias sem resposta.",
    order: 3,
    cadenceStep: 4,
    channel: "whatsapp",
    active: true,
    variables: [],
    body: `Olá! Tudo bem? Os dias passam rapidamente e eu sei que, com tantas mensagens e ligações que recebemos diariamente, algumas acabam passando despercebidas.

Por isso, estou passando novamente por aqui. Caso você ainda tenha interesse em conhecer melhor a oportunidade da Velox, me responda por este WhatsApp para que possamos evoluir nossa conversa.`,
  },
  {
    id: "quarto_contato",
    label: "Quarto Contato",
    purpose: "Pausa respeitosa, sem insistência.",
    order: 4,
    cadenceStep: 5,
    channel: "whatsapp",
    active: true,
    variables: [],
    body: `Olá! Tudo certo?

Eu já tentei falar com você algumas vezes, mas até o momento não conseguimos conversar. Imagino que sua rotina esteja bastante corrida e, por isso, não vou continuar insistindo neste momento.

Vou deixar você à vontade e volto a fazer um novo contato daqui a alguns dias. Caso queira antecipar nossa conversa, é só me responder por aqui.`,
  },
  {
    id: "quinto_contato_encerramento",
    label: "Quinto Contato / Encerramento",
    purpose: "Encerramento cordial da primeira sequência de abordagem.",
    order: 5,
    cadenceStep: 12,
    channel: "whatsapp",
    active: true,
    variables: [],
    body: `Olá, tudo bem? Conforme havia comentado na minha última mensagem, depois de alguns dias eu faria uma nova tentativa de contato.

A ideia não é fazer uma cobrança, mas apenas trazer novamente nossa conversa para o seu radar, porque sei que, com a correria do dia a dia, muitas coisas acabam ficando para depois.

A partir deste momento, não farei novas tentativas de contato por agora. Talvez mais adiante, daqui a 30 ou 60 dias, eu volte a falar com você.

De qualquer forma, sigo por aqui. Se em algum momento fizer sentido retomar essa conversa, é só me chamar.

Desejo muito sucesso em tudo que você fizer e espero que nossos caminhos possam se encontrar novamente. Um grande abraço!`,
  },
  {
    id: "abertura_conversa",
    label: "Abertura de Conversa",
    purpose:
      "Reabertura de conversa quando a janela de atendimento já está fechada. Fora da cadência.",
    order: 6,
    cadenceStep: null,
    channel: "whatsapp",
    active: true,
    variables: ["nome_executivo", "link_portal_investidor"],
    body: `Olá, tudo bem? Aqui é o {{nome_executivo}}, Executivo de Expansão da Velox Soluções Financeiras.

Estou retomando o contato por aqui para seguirmos com o seu atendimento sobre o nosso modelo de franquia.

Se quiser rever as informações com calma, o Portal do Investidor continua disponível:

{{link_portal_investidor}}

Assim que puder, me responda por aqui.`,
  },
];

/**
 * Sequência inicial de abordagem: D1 → D2 → D4 → D5 → D12.
 * O encerramento acontece no D12 — não existe D13.
 */
export const CRM_CADENCE_TEMPLATE_STEPS: { step: number; templateId: string }[] = CRM_TEMPLATES
  .filter((t) => t.cadenceStep !== null)
  .sort((a, b) => (a.cadenceStep ?? 0) - (b.cadenceStep ?? 0))
  .map((t) => ({ step: t.cadenceStep as number, templateId: t.id }));

export function getCrmTemplate(id: string): CrmTemplate | null {
  return CRM_TEMPLATES.find((t) => t.id === id) ?? null;
}

export type CrmTemplateContext = {
  /** Executivo responsável pelo lead. */
  executiveName?: string | null;
  /** Portal do Investidor do executivo responsável. */
  portalLink?: string | null;
};

/** Resolve as variáveis do template. Nome de lead nunca é utilizado. */
export function renderCrmTemplate(
  template: CrmTemplate | string,
  context: CrmTemplateContext = {},
): string {
  const body = typeof template === "string" ? template : template.body;
  return body
    .replace(/\{\{\s*nome_executivo\s*\}\}/gi, (context.executiveName ?? "").trim())
    .replace(/\{\{\s*link_portal_investidor\s*\}\}/gi, (context.portalLink ?? "").trim())
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Janela oficial de 24 horas a partir da última resposta do investidor. */
export const CRM_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CrmWindowStatus = {
  open: boolean;
  /** Rótulo curto exibido no cabeçalho da conversa. */
  label: string;
  /** Explicação exibida na barra de envio. */
  hint: string;
};

export function resolveCrmWindow(
  anchorIso: string | null | undefined,
  now = Date.now(),
): CrmWindowStatus {
  const at = anchorIso ? Date.parse(anchorIso) : NaN;
  if (!Number.isFinite(at)) {
    return {
      open: false,
      label: "Janela encerrada",
      hint: "Envio livre bloqueado. Selecione um Template aprovado para reabrir a conversa.",
    };
  }
  const remaining = at + CRM_WINDOW_MS - now;
  if (remaining <= 0) {
    return {
      open: false,
      label: "Janela encerrada",
      hint: "A janela de 24 horas expirou. Selecione um Template aprovado para reabrir a conversa.",
    };
  }
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    open: true,
    label: `Janela aberta · ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    hint: "Janela aberta: mensagens livres, anexos e emojis liberados.",
  };
}
