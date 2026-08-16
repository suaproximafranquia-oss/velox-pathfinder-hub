/**
 * VÍNCULO FINALIDADE → TEMPLATE OFICIAL (COMANDO 2A §63, §64, §119).
 *
 * Nenhum texto, nome ou ID oficial é criado aqui. O motor apenas
 * pergunta: "existe template oficial aprovado para esta finalidade?".
 * Os cadastros vêm da Central de Templates.
 */
export type TemplateBinding = {
  purpose: string;
  /** Registro da Central de Templates (Meta). Null = ainda não fornecido. */
  templateId: string | null;
  metaId: string | null;
  version: number;
  approved: boolean;
  updatedAt: string | null;
};

export type TemplateResolver = {
  bindings: TemplateBinding[];
};

export function findBinding(resolver: TemplateResolver, purpose: string): TemplateBinding | null {
  return resolver.bindings.find((b) => b.purpose === purpose) ?? null;
}

export function hasTemplateForPurpose(resolver: TemplateResolver, purpose: string): boolean {
  const binding = findBinding(resolver, purpose);
  return Boolean(binding?.templateId && binding.approved);
}

/**
 * Abertura/reabertura: evita repetir sempre o mesmo template para o
 * mesmo lead enquanto houver alternativa aprovada disponível.
 */
export function pickOpeningTemplate(
  resolver: TemplateResolver,
  openingPurposes: readonly string[],
  history: string[],
): TemplateBinding | null {
  const available = openingPurposes
    .map((purpose) => findBinding(resolver, purpose))
    .filter((b): b is TemplateBinding => Boolean(b?.templateId && b.approved));
  if (available.length === 0) return null;
  const unused = available.filter((b) => !history.includes(b.templateId!));
  return (unused.length > 0 ? unused : available)[0] ?? null;
}

export type VariableCheck = { ok: true; values: Record<string, string> } | { ok: false; missing: string[] };

/**
 * Variável obrigatória sem valor = mensagem NÃO enviada (§104).
 */
export function resolveVariables(
  required: string[],
  values: Record<string, string | null | undefined>,
): VariableCheck {
  const resolved: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of required) {
    const value = (values[key] ?? "").toString().trim();
    if (!value) missing.push(key);
    else resolved[key] = value;
  }
  return missing.length > 0 ? { ok: false, missing } : { ok: true, values: resolved };
}

/** Nenhum texto pode sair com variável não substituída. */
export function hasUnresolvedVariables(text: string): boolean {
  return /\{\{\s*[\w.]+\s*\}\}/.test(text);
}