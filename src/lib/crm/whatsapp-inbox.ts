/**
 * DEF 3.0.2 §5 — caixa de respostas oficiais do WhatsApp dentro do CRM.
 *
 * O Webhook da Meta informa o CRM; esta camada guarda a resposta por
 * número e avisa todas as telas abertas (Portal, CRM, Workspace) na mesma
 * hora, sem F5 e sem reiniciar sessão.
 */
import { notifySync } from "@/lib/sync-bus";

export type WhatsappReplyStatus = "aguardando" | "confirmado" | "recusado";

export type WhatsappReply = {
  phone: string;
  status: WhatsappReplyStatus;
  at: string;
};

const KEY = "crm.whatsapp.inbox.v1";

type Store = Record<string, WhatsappReply>;

function digits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

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
  notifySync("messages");
}

export function getWhatsappReply(phone: string): WhatsappReply | null {
  return read()[digits(phone)] ?? null;
}

/** Registra a resposta recebida da Meta (ou simulada na Homologação). */
export function recordWhatsappReply(
  phone: string,
  status: WhatsappReplyStatus,
): WhatsappReply {
  const store = read();
  const reply: WhatsappReply = {
    phone: digits(phone),
    status,
    at: new Date().toISOString(),
  };
  store[reply.phone] = reply;
  write(store);
  /**
   * Confirmação recebida: o Lead nasce imediatamente no Workspace e a
   * comunicação é liberada, mesmo que o investidor não esteja com o
   * Portal aberto. Import dinâmico evita ciclo entre CRM e Leads.
   */
  if (reply.status === "confirmado") {
    void import("@/lib/crm/whatsapp-confirmation").then(({ promoteConfirmedWhatsapp }) => {
      promoteConfirmedWhatsapp(reply.phone);
    });
  }
  return reply;
}

export function clearWhatsappReply(phone: string): void {
  const store = read();
  delete store[digits(phone)];
  write(store);
}