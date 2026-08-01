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
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { updateLead } from "@/lib/leads";
import { notifySync } from "@/lib/sync-bus";

/** Número oficial que recebe as confirmações de identidade. */
export const VELOX_OFFICIAL_WHATSAPP = "5517997727337";

const KEY = "velox:portal:whatsapp-verification:v1";

export type VerificationRecord = {
  investorId: string;
  phone: string;
  code: string;
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

function newCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function getVerification(investorId: string): VerificationRecord | null {
  return read()[investorId] ?? null;
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
    // Troca de número invalida o código anterior.
    code: previous && !changedPhone ? previous.code : newCode(),
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

  void sendWhatsApp({
    to: VELOX_OFFICIAL_WHATSAPP,
    text: `Confirmação de identidade — Portal do Investidor Velox.\nNome: ${input.investorName}\nWhatsApp: ${phone}\nCódigo de confirmação: ${record.code}`,
    reference: input.investorId,
  });

  logAudit({
    actorId: input.investorId,
    actorName: input.investorName,
    actorRole: "Visitante identificado",
    module: "investidores",
    action: changedPhone
      ? "Número de WhatsApp alterado e novo código enviado"
      : "Código de confirmação de WhatsApp enviado",
    target: input.investorName,
    details: `Envio nº ${record.sendCount} para ${phone} em ${new Date(record.sentAt!).toLocaleString("pt-BR")}. Nenhum Lead, Card ou Executivo foi criado.`,
    severity: "info",
  });
  recordCrmEvent({
    investorId: input.investorId,
    event: "atividade_portal",
    origin: input.origin ?? "Portal do Investidor",
    reason: changedPhone
      ? "Visitante alterou o número e solicitou novo código de confirmação."
      : "Código de confirmação de WhatsApp enviado ao visitante.",
    ownerId: input.ownerId ?? "sistema",
    actorId: input.investorId,
  });
  return record;
}

/** PASSO 09 — confirmação registra data, hora, IP, navegador e usuário. */
export function confirmWhatsapp(input: {
  investorId: string;
  investorName: string;
  code: string;
  origin?: string;
  ownerId?: string | null;
}): { ok: boolean; record: VerificationRecord | null } {
  const store = read();
  const record = store[input.investorId];
  if (!record) return { ok: false, record: null };
  if (record.code !== input.code.replace(/\D/g, "")) return { ok: false, record };

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
