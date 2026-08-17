/**
 * Assinatura Automática do Executivo.
 *
 * O perfil público do WhatsApp continua sendo o da empresa: a
 * identificação do atendimento acontece por uma assinatura acrescentada
 * automaticamente pelo sistema — nunca digitada manualmente.
 *
 * Momento: primeira mensagem de uma conversa ou primeira mensagem após
 * um período prolongado sem interação (2 horas).
 */
import { loadUsers } from "@/lib/executive-auth";
import { listCrmMessages } from "@/lib/crm/messages";

export const SIGNATURE_SILENCE_MS = 2 * 60 * 60 * 1000;

const COMPANY = "Velox";

/** Assinatura oficial do usuário autenticado (nome, cargo e empresa). */
export function executiveSignature(userId: string, fallbackName?: string): string {
  const user = loadUsers().find((u) => u.id === userId);
  const name = user?.name ?? fallbackName ?? "";
  if (!name) return "";
  const title = user?.title?.trim() || "Gerente de Expansão";
  return `${name}\n${title}\n${COMPANY}`;
}

/** A conversa precisa de assinatura neste envio? */
export function needsSignature(investorId: string): boolean {
  const outbound = listCrmMessages(investorId).filter((m) => m.direction === "enviada");
  const last = outbound[outbound.length - 1];
  if (!last) return true;
  return Date.now() - Date.parse(last.at) >= SIGNATURE_SILENCE_MS;
}

/** Acrescenta a assinatura ao corpo quando aplicável. */
export function withSignature(
  body: string,
  input: { investorId: string; userId: string; userName?: string },
): string {
  if (!needsSignature(input.investorId)) return body;
  const signature = executiveSignature(input.userId, input.userName);
  if (!signature) return body;
  if (body.includes(signature)) return body;
  return `${body}\n\n—\n${signature}`;
}
