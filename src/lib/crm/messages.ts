/**
 * Histórico de mensagens do CRM (DEF 2.4.8).
 *
 * Toda mensagem enviada pelo Executivo é registrada imediatamente e
 * permanece no histórico da conversa — nenhuma mensagem desaparece.
 * Persistência local, append-only, ordem cronológica.
 */
export type CrmMessageDirection = "enviada" | "recebida";

export type CrmMessage = {
  id: string;
  investorId: string;
  direction: CrmMessageDirection;
  body: string;
  /** ISO completo — data e hora do registro. */
  at: string;
  authorId: string;
  authorName?: string;
};

const STORAGE_KEY = "crm.messages.v1";
const LIMIT = 5000;

function readAll(): CrmMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CrmMessage[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: CrmMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    /* armazenamento indisponível */
  }
  notifySync("messages");
}

/** Mensagens da conversa em ordem cronológica (mais antiga primeiro). */
export function listCrmMessages(investorId: string): CrmMessage[] {
  return readAll()
    .filter((m) => m.investorId === investorId)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

export function appendCrmMessage(input: {
  investorId: string;
  direction: CrmMessageDirection;
  body: string;
  authorId: string;
  authorName?: string;
}): CrmMessage {
  const message: CrmMessage = {
    id: `crmmsg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...input,
    body: input.body.trim(),
  };
  writeAll([...readAll(), message]);
  return message;
}

export function formatCrmMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatCrmMessageDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (sameDay) return "Hoje";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
