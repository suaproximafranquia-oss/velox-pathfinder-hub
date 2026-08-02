/**
 * DEF 2.4.18 — Confirmação obrigatória do WhatsApp.
 *
 * Após a identificação (Gateway) o Visitante Identificado acessa
 * EXCLUSIVAMENTE o Manual do Investidor. Qualquer outro módulo exige a
 * confirmação do WhatsApp — validação de identidade, nunca solicitação
 * de contato comercial.
 *
 * Nada aqui cria Lead operacional, Card, Workspace ou Executivo
 * responsável: o visitante permanece em Jornada Digital.
 */
import { logAudit } from "@/lib/audit-log";
import { recordCrmEvent } from "@/lib/crm/timeline";
import { isPortalReleased } from "@/lib/crm/portal-release";
import { dispatchValidationTemplate } from "@/lib/crm/whatsapp-official";
import { updateLead } from "@/lib/leads";
import { notifySync } from "@/lib/sync-bus";

/** Número oficial que recebe as confirmações de identidade. */
export const VELOX_OFFICIAL_WHATSAPP = "5517997727337";

const KEY = "velox:portal:whatsapp-verification:v1";

export type VerificationRecord = {
  investorId: string;
  phone: string;
  sentAt: string | null;
  sendCount: number;
  confirmedAt: string | null;
  confirmedIp: string | null;
  confirmedUserAgent: string | null;
};

type Store = Record<string, VerificationRecord>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* armazenamento indisponível */
  }
  notifySync("commercial");
}

export function getVerification(investorId: string): VerificationRecord | null {
  return read()[investorId] ?? null;
}

/**
 * DEF 2.5.1 — ao promover a Jornada Digital a Relacionamento Comercial,
 * a confirmação já realizada acompanha o novo identificador.
 */
export function transferVerification(fromId: string, toId: string): void {
  const store = read();
  const record = store[fromId];
  if (!record || fromId === toId) return;
  delete store[fromId];
  store[toId] = { ...record, investorId: toId };
  write(store);
}

/** Portal liberado = WhatsApp confirmado OU liberação manual (Admin/Gestora). */
export function isPortalUnlocked(investorId: string | null | undefined): boolean {
  if (!investorId) return false;
  if (isPortalReleased(investorId)) return true;
  return Boolean(read()[investorId]?.confirmedAt);
}

/**
 * PASSO 07 — envia automaticamente a mensagem com o código seguro.
 * PASSO 08 — reenvio e troca de número atualizam o cadastro existente,
 * jamais criam outro registro.
 */
export function requestWhatsappConfirmation(input: {
  investorId: string;
  investorName: string;
  phone: string;
  origin?: string;
  ownerId?: string | null;
}): VerificationRecord {
  const store = read();
  const previous = store[input.investorId];
  const phone = input.phone.replace(/\D/g, "");
  const changedPhone = Boolean(previous && previous.phone !== phone);
  const record: VerificationRecord = {
    investorId: input.investorId,
    phone,
    sentAt: new Date().toISOString(),
    sendCount: (previous?.sendCount ?? 0) + 1,
    confirmedAt: null,
    confirmedIp: null,
    confirmedUserAgent: null,
  };
  store[input.investorId] = record;
  write(store);

  // Atualiza SEMPRE o cadastro existente — nunca cria outro.
  if (changedPhone || !previous) updateLead(input.investorId, { whatsapp: phone });

  /**
   * DEF 3.0.2 §3 — quem envia é o CRM, através da Cloud API oficial.
   * O Portal nunca abre WhatsApp Web nem o aplicativo.
   */
  dispatchValidationTemplate({
    investorId: input.investorId,
    investorName: input.investorName,
    phone,
    ownerId: input.ownerId ?? null,
    origin: input.origin,
    resend: Boolean(previous),
  });

  logAudit({
    actorId: input.investorId,
    actorName: input.investorName,
    actorRole: "Visitante identificado",
    module: "investidores",
    action: changedPhone
      ? "Número de WhatsApp alterado e nova confirmação enviada"
      : "Mensagem oficial de confirmação de WhatsApp enviada",
    target: input.investorName,
    details: `Envio nº ${record.sendCount} para ${phone} em ${new Date(record.sentAt!).toLocaleString("pt-BR")}. Nenhum Lead, Card ou Executivo foi criado.`,
    severity: "info",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: "atividade_portal",
    origin: input.origin ?? "Portal do Investidor",
    reason: changedPhone
      ? "Visitante alterou o número e recebeu nova mensagem oficial de confirmação."
      : "Mensagem oficial de confirmação enviada ao visitante (CONFIRMAR / NÃO CONFIRMAR).",
    ownerId: input.ownerId ?? "sistema",
    actorId: input.investorId,
  });
  return record;
}

/**
 * DEF 3.0.1 §9 — a confirmação chega pelo botão CONFIRMAR da mensagem
 * oficial do WhatsApp. Nenhum código, OTP ou PIN é utilizado: o CRM
 * identifica automaticamente a resposta e registra data, hora, IP e
 * navegador.
 */
export function confirmWhatsapp(input: {
  investorId: string;
  investorName: string;
  origin?: string;
  ownerId?: string | null;
}): { ok: boolean; record: VerificationRecord | null } {
  const store = read();
  const record = store[input.investorId];
  if (!record) return { ok: false, record: null };

  const now = new Date().toISOString();
  const confirmed: VerificationRecord = {
    ...record,
    confirmedAt: now,
    confirmedIp: null,
    confirmedUserAgent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 180),
  };
  store[input.investorId] = confirmed;
  write(store);

  // IP é resolvido em segundo plano — a liberação nunca depende dele.
  void resolveIp().then((ip) => {
    if (!ip) return;
    const current = read();
    const entry = current[input.investorId];
    if (!entry) return;
    current[input.investorId] = { ...entry, confirmedIp: ip };
    write(current);
  });

  logAudit({
    actorId: input.investorId,
    actorName: input.investorName,
    actorRole: "Visitante identificado",
    module: "investidores",
    action: "WhatsApp confirmado — Portal do Investidor desbloqueado",
    target: input.investorName,
    details: `Confirmado em ${new Date(now).toLocaleString("pt-BR")} · Navegador: ${confirmed.confirmedUserAgent ?? "não informado"} · WhatsApp ${confirmed.phone}. Nenhum Lead, Card, Workspace ou Executivo responsável foi criado.`,
    severity: "success",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: "atividade_portal",
    origin: input.origin ?? "Portal do Investidor",
    reason: "WhatsApp confirmado pelo visitante — módulos do Portal liberados.",
    ownerId: input.ownerId ?? "sistema",
    actorId: input.investorId,
  });
  return { ok: true, record: confirmed };
}

async function resolveIp(): Promise<string | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
}

/** Resposta "NÃO CONFIRMAR" — o relacionamento segue aguardando validação. */
export function declineWhatsapp(input: {
  investorId: string;
  investorName: string;
  origin?: string;
  ownerId?: string | null;
}): void {
  const store = read();
  const record = store[input.investorId];
  if (!record) return;
  store[input.investorId] = { ...record, confirmedAt: null };
  write(store);
  logAudit({
    actorId: input.investorId,
    actorName: input.investorName,
    actorRole: "Visitante identificado",
    module: "investidores",
    action: "Confirmação de WhatsApp recusada pelo visitante",
    target: input.investorName,
    details: "Resposta 'NÃO CONFIRMAR' na mensagem oficial. Módulos permanecem bloqueados.",
    severity: "warning",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: "atividade_portal",
    origin: input.origin ?? "Portal do Investidor",
    reason: "Visitante respondeu NÃO CONFIRMAR na mensagem oficial do WhatsApp.",
    ownerId: input.ownerId ?? "sistema",
    actorId: input.investorId,
  });
}
