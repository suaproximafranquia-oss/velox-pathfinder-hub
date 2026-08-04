/**
 * Conversas temporárias (Nova Conversa › Conversar).
 *
 * Existem apenas como atendimento inicial: não criam Lead, Jornada,
 * Portal, Histórico, Backup nem cadastro de investidor. Ficam visíveis
 * na lista lateral do CRM até serem excluídas ou transformadas em Lead.
 */
import { notifySync } from "@/lib/sync-bus";

export type TempChatMessage = {
  id: string;
  body: string;
  at: string;
  direction: "enviada" | "recebida";
};

export type TempChat = {
  id: string;
  phone: string;
  ownerId: string;
  createdAt: string;
  messages: TempChatMessage[];
};

const STORAGE_KEY = "crm.temp-chats.v1";

function readAll(): TempChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TempChat[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: TempChat[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* armazenamento indisponível */
  }
  notifySync("messages");
}

/** Conversas temporárias do Executivo autenticado, mais recentes primeiro. */
export function listTempChats(ownerId: string): TempChat[] {
  return readAll()
    .filter((c) => c.ownerId === ownerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getTempChat(id: string): TempChat | null {
  return readAll().find((c) => c.id === id) ?? null;
}

/** Abre imediatamente a conversa temporária — reutiliza a do mesmo número. */
export function createTempChat(phone: string, ownerId: string): TempChat {
  const all = readAll();
  const existing = all.find((c) => c.phone === phone && c.ownerId === ownerId);
  if (existing) return existing;
  const chat: TempChat = {
    id: `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    phone,
    ownerId,
    createdAt: new Date().toISOString(),
    messages: [],
  };
  writeAll([...all, chat]);
  return chat;
}

export function appendTempMessage(
  id: string,
  input: { body: string; direction?: "enviada" | "recebida" },
): TempChat | null {
  const all = readAll();
  const chat = all.find((c) => c.id === id);
  if (!chat) return null;
  chat.messages = [
    ...chat.messages,
    {
      id: `tmpmsg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      body: input.body.trim(),
      at: new Date().toISOString(),
      direction: input.direction ?? "enviada",
    },
  ];
  writeAll(all);
  return chat;
}

/** Exclusão definitiva: nenhum registro permanece. */
export function removeTempChat(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function formatTempPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13)
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12)
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}
