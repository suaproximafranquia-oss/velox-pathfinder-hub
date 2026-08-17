/**
 * Templates operacionais da Central de Templates.
 *
 * A Central existe para DUAS finalidades manuais:
 *   1. Primeiro contato (mesma definição usada pelo motor automático);
 *   2. Abertura/reabertura de conversa (três variações neutras).
 *
 * As etapas de relacionamento (E1, E3, E4, E12, R1, R2, R3, V3, V4)
 * pertencem ao Motor de Relacionamento e NÃO são oferecidas como
 * templates manuais ao Executivo.
 *
 * O corpo NUNCA carrega nome próprio gravado: executivo, link do Portal
 * e tratamento do investidor entram por variável.
 */
export type CrmTemplateVariable =
  | "nome_executivo"
  | "link_portal_investidor"
  | "link_portal"
  | "nome_investidor";

export type CrmTemplateKind = "primeiro_contato" | "abertura";

export type CrmTemplate = {
  id: string;
  label: string;
  /** Para que serve — texto curto de gestão. */
  purpose: string;
  /** Finalidade estrutural na Central de Templates (Meta). */
  metaPurpose: string;
  kind: CrmTemplateKind;
  /** Ordem de exibição/organização. */
  order: number;
  channel: "whatsapp";
  active: boolean;
  variables: CrmTemplateVariable[];
  /** Texto oficial, com variáveis não resolvidas. */
  body: string;
};

/** Único primeiro contato do Portal — manual e automático compartilham este texto. */
export const CRM_FIRST_CONTACT: CrmTemplate = {
  id: "primeiro_contato",
  label: "Primeiro Contato",
  purpose: "Apresentação do Executivo de Expansão e entrega do Portal do Investidor.",
  metaPurpose: "primeiro_contato",
  kind: "primeiro_contato",
  order: 1,
  channel: "whatsapp",
  active: true,
  variables: ["nome_executivo", "link_portal"],
  body: `Olá, caro investidor, tudo bem?

Meu nome é {{nome_executivo}} e sou Executivo de Expansão da Velox Soluções Financeiras.

Se você demonstrou interesse em conhecer a Velox, estou à disposição para apresentar nossa estrutura, modelo de negócio e oportunidade.

Preparei um espaço com as principais informações para você conhecer nossa proposta com mais calma.

{{link_portal}}

Após analisar esse material, vamos alinhar um horário para conversarmos. Me informe duas opções de horário que funcionam melhor para você.`,
};

/**
 * Aberturas/reaberturas: extremamente neutras. Não vendem, não apresentam
 * a franquia, não enviam conteúdo, não cobram e não trazem CTA comercial.
 * Depois da abertura, o Executivo compõe livremente a próxima mensagem.
 */
export const CRM_OPENING_TEMPLATES: CrmTemplate[] = [
  {
    id: "abertura_conversa_1",
    label: "Abertura de Conversa 1",
    purpose: "Abrir/reabrir a conversa. Sem conteúdo comercial.",
    metaPurpose: "abertura_conversa_1",
    kind: "abertura",
    order: 2,
    channel: "whatsapp",
    active: true,
    variables: ["nome_investidor"],
    body: `Olá, {{nome_investidor}}, tudo bem? Estou entrando em contato por aqui.`,
  },
  {
    id: "abertura_conversa_2",
    label: "Abertura de Conversa 2",
    purpose: "Abrir/reabrir a conversa. Sem conteúdo comercial.",
    metaPurpose: "abertura_conversa_2",
    kind: "abertura",
    order: 3,
    channel: "whatsapp",
    active: true,
    variables: ["nome_investidor"],
    body: `Olá, {{nome_investidor}}. Tudo bem? Estou passando por aqui para seguirmos nosso contato.`,
  },
  {
    id: "abertura_conversa_3",
    label: "Abertura de Conversa 3",
    purpose: "Abrir/reabrir a conversa. Sem conteúdo comercial.",
    metaPurpose: "abertura_conversa_3",
    kind: "abertura",
    order: 4,
    channel: "whatsapp",
    active: true,
    variables: ["nome_investidor"],
    body: `Olá, {{nome_investidor}}, tudo bem com você? Estou retomando nosso contato por aqui.`,
  },
];

/** Os quatro — e somente quatro — templates operacionais manuais. */
export const CRM_TEMPLATES: CrmTemplate[] = [CRM_FIRST_CONTACT, ...CRM_OPENING_TEMPLATES];

/**
 * Templates descontinuados como uso manual (as etapas passaram ao Motor
 * de Relacionamento). Permanecem apenas para leitura de histórico —
 * nada é apagado e nada é oferecido ao Executivo.
 */
export const CRM_RETIRED_TEMPLATE_IDS = [
  "segundo_contato",
  "terceiro_contato",
  "quarto_contato",
  "quinto_contato_encerramento",
  "abertura_conversa",
] as const;

export function isRetiredCrmTemplate(id: string): boolean {
  return (CRM_RETIRED_TEMPLATE_IDS as readonly string[]).includes(id);
}

export function getCrmTemplate(id: string): CrmTemplate | null {
  return CRM_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Alternância de abertura: nunca repetir o mesmo template enquanto
 * houver alternativa ainda não usada com aquele lead.
 */
export function pickOpeningTemplate(history: string[] = []): CrmTemplate {
  const available = CRM_OPENING_TEMPLATES.filter((t) => t.active);
  const unused = available.filter((t) => !history.includes(t.id));
  const pool = unused.length > 0 ? unused : available;
  return pool[0]!;
}

export type CrmTemplateContext = {
  /** Executivo responsável pelo lead. */
  executiveName?: string | null;
  /** Portal do Investidor do executivo responsável. */
  portalLink?: string | null;
  /** Tratamento do investidor, somente quando confirmado. */
  investorName?: string | null;
};

/** Resolve as variáveis do template. */
export function renderCrmTemplate(
  template: CrmTemplate | string,
  context: CrmTemplateContext = {},
): string {
  const body = typeof template === "string" ? template : template.body;
  const portal = (context.portalLink ?? "").trim();
  return body
    .replace(/\{\{\s*nome_executivo\s*\}\}/gi, (context.executiveName ?? "").trim())
    .replace(/\{\{\s*link_portal_investidor\s*\}\}/gi, portal)
    .replace(/\{\{\s*link_portal\s*\}\}/gi, portal)
    .replace(/\{\{\s*nome_investidor\s*\}\}/gi, (context.investorName ?? "").trim())
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s+([,.!?])/g, "$1")
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
