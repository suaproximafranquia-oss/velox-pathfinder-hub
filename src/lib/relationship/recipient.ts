/**
 * CLASSIFICAÇÃO DO DESTINATÁRIO (COMANDO 3B §4, cenários C, D e E).
 *
 * Regra pura, sem banco, para que possa ser testada e reutilizada tanto
 * pela trava de servidor quanto pelo simulador.
 */
import type { EngineScope } from "./types";

export const HOMOLOGATION_LEAD_PREFIX = "TEST-";

export function isHomologationLeadId(leadId: string): boolean {
  return (leadId ?? "").toUpperCase().startsWith(HOMOLOGATION_LEAD_PREFIX);
}

export type RecipientVerdict = { ok: boolean; reason?: string };

/**
 * Verificação de escopo. `exists` responde se o registro foi encontrado
 * no repositório do próprio escopo — na dúvida (`exists === false`), não
 * envia.
 */
export function evaluateRecipient(
  scope: EngineScope,
  leadId: string,
  exists: boolean,
): RecipientVerdict {
  const fake = isHomologationLeadId(leadId);
  if (scope === "homologation") {
    if (!fake) return { ok: false, reason: "Lead real não pode ser usado na homologação." };
    if (!exists) return { ok: false, reason: "Lead fictício não encontrado no escopo de homologação." };
    return { ok: true };
  }
  if (fake) return { ok: false, reason: "Registro de teste não pode receber mensagem em produção." };
  if (!exists) return { ok: false, reason: "Lead real não encontrado — envio bloqueado." };
  return { ok: true };
}
