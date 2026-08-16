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