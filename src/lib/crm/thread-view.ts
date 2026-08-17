/**
 * MODELO DE APRESENTAÇÃO DA CONVERSA (COMANDO 1A).
 *
 * Camada pura, sem React: decide lado, autor, avatar e agrupamento de
 * cada mensagem. A renderização (CrmThread) apenas consome este modelo,
 * de forma que CRM real e homologação compartilhem exatamente as mesmas
 * regras — sem um segundo componente de conversa.
 */
import type { CrmMessage } from "@/lib/crm/messages";

export type ThreadParticipant = {
  name: string;
  photoUrl?: string | null;
};

export type ThreadAuthor = "self" | "peer" | "system";

export type ThreadAvatar = {
  name: string;
  initials: string;
  photoUrl?: string;
};

export type ThreadRow = {
  message: CrmMessage;
  /** Lado visual — determinado pelo autor, nunca por posição arbitrária. */
  side: "right" | "left";
  author: ThreadAuthor;
  /** Corpo sem URLs que já são representadas por botão. */
  body: string;
  /** Último balão de um bloco do mesmo autor recebe o avatar. */
  showAvatar: boolean;
  avatar: ThreadAvatar | null;
};

/** Iniciais do nome (mesma aparência do avatar já existente no CRM). */
export function threadInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * A URL da ação vive no botão. Se o texto ainda repetir a mesma URL
 * (mensagens antigas), ela é removida da exibição.
 */
export function sanitizeThreadBody(message: Pick<CrmMessage, "body" | "button">): string {
  const url = message.button?.url?.trim();
  if (!url) return message.body;
  return message.body
    .split("\n")
    .filter((line) => line.trim() !== url)
    .join("\n")
    .replace(url, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function authorOf(message: CrmMessage): ThreadAuthor {
  if (message.authorId === "SYSTEM") return "system";
  return message.direction === "enviada" ? "self" : "peer";
}

/**
 * Constrói as linhas da conversa.
 * `self` = Executivo/Velox (direita) · `peer` = Investidor (esquerda).
 */
export function buildThreadRows(
  messages: CrmMessage[],
  participants: { self: ThreadParticipant; peer: ThreadParticipant },
): ThreadRow[] {
  return messages.map((message, index) => {
    const author = authorOf(message);
    const next = messages[index + 1];
    const lastOfBlock = !next || authorOf(next) !== author;
    const person =
      author === "self" ? participants.self : author === "peer" ? participants.peer : null;
    const name = message.authorName?.trim() || person?.name || "";
    return {
      message,
      // SYSTEM permanece com a regra atual (segue a direção da mensagem).
      side:
        author === "peer" || (author === "system" && message.direction === "recebida")
          ? "left"
          : "right",
      author,
      body: sanitizeThreadBody(message),
      showAvatar: author !== "system" && lastOfBlock,
      avatar:
        author === "system"
          ? null
          : {
              name: name || "?",
              initials: threadInitials(name),
              photoUrl: person?.photoUrl || undefined,
            },
    } satisfies ThreadRow;
  });
}
