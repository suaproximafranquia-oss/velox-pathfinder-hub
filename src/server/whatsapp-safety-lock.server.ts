/**
 * TRAVA GLOBAL DE ENVIO REAL DE WHATSAPP — SERVER ONLY.
 *
 * REGRA ABSOLUTA: nenhuma mensagem REAL de WhatsApp pode sair do sistema
 * antes de 01/01/2029 00:00:00. A trava é incondicional e vive no ponto
 * efetivo de saída (imediatamente antes de qualquer chamada à Graph API
 * da Meta) — nunca na interface, nunca na cadência, nunca em um estado
 * de campanha. Job executado ≠ mensagem enviada.
 *
 * DEPOIS de 2029 a trava temporal deixa de bloquear, mas o envio real
 * CONTINUA desligado: é necessária uma segunda autorização explícita,
 * server-side, através da variável de ambiente
 * WHATSAPP_REAL_SEND_ENABLED=true. A data NÃO liga nada sozinha.
 *
 * Esta trava não cancela, não apaga e não reprograma nada: ela apenas
 * impede a saída. Mensagens pendentes não são acumuladas para disparo
 * retroativo — cada tentativa bloqueada é registrada e descartada como
 * "não entregue", exatamente como uma falha de canal.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Liberação temporal MÍNIMA. Não é ativação. */
export const REAL_SEND_UNLOCK_AT = new Date("2029-01-01T00:00:00.000Z");

export const SAFETY_LOCK_LABEL = "ENVIO BLOQUEADO — GLOBAL WHATSAPP SAFETY LOCK";

export const SAFETY_LOCK_MESSAGE =
  "Envio real bloqueado pela trava global de segurança (liberação temporal mínima: 01/01/2029).";

export const SAFETY_LOCK_PENDING_ACTIVATION_MESSAGE =
  "Envio real bloqueado: trava temporal vencida, mas a ativação explícita do canal não foi concedida.";

/** Segunda autorização, exigida SOMENTE a partir de 2029. */
function explicitActivation(): boolean {
  return String(process.env["WHATSAPP_REAL_SEND_ENABLED"] ?? "").toLowerCase() === "true";
}

export type SafetyLockStatus = {
  /** true enquanto o envio real for impossível. */
  locked: boolean;
  unlockAt: string;
  /** true quando a data atual ainda é anterior a 01/01/2029. */
  temporalLock: boolean;
  /** true quando a ativação explícita foi concedida. */
  explicitlyActivated: boolean;
  reason: string | null;
};

export function whatsappSafetyLockStatus(now: Date = new Date()): SafetyLockStatus {
  const temporalLock = now.getTime() < REAL_SEND_UNLOCK_AT.getTime();
  const explicitlyActivated = explicitActivation();
  const locked = temporalLock || !explicitlyActivated;
  return {
    locked,
    unlockAt: REAL_SEND_UNLOCK_AT.toISOString(),
    temporalLock,
    explicitlyActivated,
    reason: !locked
      ? null
      : temporalLock
        ? SAFETY_LOCK_MESSAGE
        : SAFETY_LOCK_PENDING_ACTIVATION_MESSAGE,
  };
}

export type SafetyLockContext = {
  /** ID do investidor / lead, quando conhecido. */
  investorId?: string | null;
  /** Fluxo de origem: cadencia, remarketing, campanha, crm, portal... */
  flow: string;
  /** Etapa (E0, E3, RE1, RF...) quando aplicável. */
  step?: string | null;
  /** Job / função / rota que originou a tentativa. */
  origin: string;
  /** Telefone de destino (registrado mascarado). */
  phone?: string | null;
};

function maskPhone(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
}

/** Auditoria da tentativa bloqueada. Nunca lança — bloquear vem primeiro. */
async function auditBlock(context: SafetyLockContext, reason: string): Promise<void> {
  try {
    await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "whatsapp_safety_lock",
      action: SAFETY_LOCK_LABEL,
      details: {
        investorId: context.investorId ?? null,
        fluxo: context.flow,
        etapa: context.step ?? null,
        origem: context.origin,
        telefone: maskPhone(context.phone),
        motivo: reason,
        at: new Date().toISOString(),
        unlockAt: REAL_SEND_UNLOCK_AT.toISOString(),
      } as never,
    } as never);
  } catch {
    // Auditoria indisponível não pode, em hipótese alguma, liberar envio.
  }
}

/**
 * PONTO ÚNICO DE DECISÃO. Retorna `null` quando o envio real é
 * permitido; caso contrário devolve o motivo do bloqueio já auditado.
 */
export async function blockRealWhatsappSend(
  context: SafetyLockContext,
  now: Date = new Date(),
): Promise<string | null> {
  const status = whatsappSafetyLockStatus(now);
  if (!status.locked) return null;
  const reason = status.reason ?? SAFETY_LOCK_MESSAGE;
  await auditBlock(context, reason);
  return reason;
}
