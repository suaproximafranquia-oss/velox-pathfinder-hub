/**
 * COMANDO 2 §12 — ESTADO DE LEITURA DA CONVERSA (AZUL).
 *
 * Marcação operacional pessoal do Executivo: abrir a conversa a torna
 * lida; "Marcar como não lida" devolve o indicador azul e ele permanece
 * mesmo depois de fechar o navegador. Nada aqui altera o relacionamento,
 * o lead ou o histórico — é apenas organização de quem atende.
 */
const KEY = "atlas:crm:unread:v1";

type Store = Record<string, true>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* armazenamento indisponível — a marcação vale apenas na sessão */
  }
}

/** Conversa marcada manualmente como não lida pelo Executivo. */
export function isManuallyUnread(conversationId: string): boolean {
  return Boolean(read()[conversationId]);
}

export function markConversationUnread(conversationId: string): void {
  const store = read();
  store[conversationId] = true;
  write(store);
}

/** Abrir a conversa sempre limpa a marcação manual. */
export function clearConversationUnread(conversationId: string): void {
  const store = read();
  if (!store[conversationId]) return;
  delete store[conversationId];
  write(store);
}

export function listManuallyUnread(): string[] {
  return Object.keys(read());
}
