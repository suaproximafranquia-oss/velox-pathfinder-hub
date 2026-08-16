/**
 * Central de Templates — tipos e regras puras.
 *
 * A Meta é a autoridade do template; o Portal apenas organiza o que já
 * existe lá. Nada aqui cria, submete ou aprova template na Meta.
 */
export type MetaTemplatePurpose =
  | "primeiro_contato"
  | "segundo_contato"
  | "terceiro_contato"
  | "quarto_contato"
  | "encerramento"
  | "abertura_conversa"
  | "outro";

export const TEMPLATE_PURPOSES: { value: MetaTemplatePurpose; label: string }[] = [
  { value: "primeiro_contato", label: "Primeiro contato" },
  { value: "segundo_contato", label: "Segundo contato" },
  { value: "terceiro_contato", label: "Terceiro contato" },
  { value: "quarto_contato", label: "Quarto contato" },
  { value: "encerramento", label: "Encerramento" },
  { value: "abertura_conversa", label: "Abertura de conversa" },
  { value: "outro", label: "Outro" },
];

export function purposeLabel(value: string | null | undefined): string {
  return TEMPLATE_PURPOSES.find((p) => p.value === value)?.label ?? "Outro";
}

export type MetaTemplateVariable = { name: string; sample: string | null };

export type MetaTemplateButton = {
  type: string | null;
  text: string | null;
  url: string | null;
  urlType: string | null;
};

/** Resultado bruto da leitura visual: campos não vistos ficam nulos. */
export type MetaTemplateReading = {
  name: string | null;
  metaId: string | null;
  language: string | null;
  category: string | null;
  status: string | null;
  metaUpdatedAt: string | null;
  header: string | null;
  body: string | null;
  footer: string | null;
  variables: MetaTemplateVariable[];
  buttons: MetaTemplateButton[];
};

export type MetaTemplateRecord = MetaTemplateReading & {
  id: string;
  purpose: MetaTemplatePurpose;
  notes: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export const NOT_IDENTIFIED = "Não identificado";

/** Nunca inventa: campo ausente vira o rótulo oficial de não identificado. */
export function display(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  return text ? text : NOT_IDENTIFIED;
}

/* ------------------------------------------------------------------ CRM */

/**
 * Ponte Central de Templates → CRM de Relacionamento.
 *
 * O CRM apenas ENXERGA o cadastro: nada é enviado, disparado ou
 * sincronizado com a Meta nesta operação.
 */
export type CrmMetaTemplateOption = {
  /** Nome oficial do template na Meta (identificador no CRM). */
  id: string;
  /** Rótulo pela finalidade operacional escolhida na Central. */
  label: string;
  purpose: MetaTemplatePurpose;
  language: string | null;
  category: string | null;
  status: string | null;
  /** Texto pronto para conferência/composição (cabeçalho + corpo + rodapé). */
  body: string;
  variables: MetaTemplateVariable[];
  buttons: MetaTemplateButton[];
  source: "meta";
};

/** Passo de cadência sugerido pela finalidade (organização, não disparo). */
export const PURPOSE_CADENCE_STEP: Record<MetaTemplatePurpose, number | null> = {
  primeiro_contato: 1,
  segundo_contato: 2,
  terceiro_contato: 4,
  quarto_contato: 5,
  encerramento: 12,
  abertura_conversa: null,
  outro: null,
};

export function metaTemplateToCrmOption(record: MetaTemplateRecord): CrmMetaTemplateOption {
  const parts = [record.header, record.body, record.footer]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return {
    id: record.name ?? record.id,
    label: `${purposeLabel(record.purpose)} · ${display(record.name)}`,
    purpose: record.purpose,
    language: record.language,
    category: record.category,
    status: record.status,
    body: parts.join("\n\n"),
    variables: record.variables,
    buttons: record.buttons,
    source: "meta",
  };
}