/**
 * Presença do WhatsApp (DF 2.4.7 §3).
 *
 * O cabeçalho da conversa jamais inventa horários: a informação
 * "Visto por último" só é exibida quando entregue pela integração real do
 * WhatsApp. Enquanto a integração não estiver ativa, o estado é sempre
 * "Offline".
 */

export type CrmPresence = { online: boolean; label: string };

export type WhatsAppPresenceRecord = {
  online: boolean;
  /** ISO informado pela integração — nunca derivado do Portal. */
  lastSeenIso?: string;
};

const KEY = "velox:crm:whatsapp-presence:v1";

function read(): Record<string, WhatsAppPresenceRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Alimentado exclusivamente pela integração oficial do WhatsApp. */
export function setWhatsAppPresence(investorId: string, record: WhatsAppPresenceRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [investorId]: record }));
  } catch {
    /* armazenamento indisponível */
  }
}

function hhmm(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function whatsappPresence(investorId: string): CrmPresence {
  const record = read()[investorId];
  if (!record) return { online: false, label: "Offline" };
  if (record.online) return { online: true, label: "Online" };
  const ts = record.lastSeenIso ? Date.parse(record.lastSeenIso) : NaN;
  if (!Number.isFinite(ts)) return { online: false, label: "Offline" };
  const d = new Date(ts);
  const today = d.toDateString() === new Date().toDateString();
  if (today) return { online: false, label: `Visto por último hoje às ${hhmm(d)}` };
  const yesterday = new Date(Date.now() - 864e5).toDateString() === d.toDateString();
  if (yesterday) return { online: false, label: `Visto por último ontem às ${hhmm(d)}` };
  return {
    online: false,
    label: `Visto por último em ${d.toLocaleDateString("pt-BR")} às ${hhmm(d)}`,
  };
}