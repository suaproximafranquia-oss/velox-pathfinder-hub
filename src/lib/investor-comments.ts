/**
 * Comentários internos do investidor — persistência local.
 * Estrutura preparada para futura integração com backend.
 */
import { emitEvent } from "@/lib/events/bus";
import { notifySync } from "@/lib/sync-bus";

export type InvestorComment = {
  id: string;
  investorId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

const KEY = "velox:investor-comments:v1";

function read(): InvestorComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as InvestorComment[]) : [];
  } catch {
    return [];
  }
}

function write(list: InvestorComment[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  notifySync("notes");
}

export function listComments(investorId: string): InvestorComment[] {
  return read()
    .filter((c) => c.investorId === investorId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addComment(input: {
  investorId: string;
  authorId: string;
  authorName: string;
  body: string;
}): InvestorComment {
  const now = new Date().toISOString();
  const comment: InvestorComment = {
    id: `cmt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    ...input,
  };
  const list = read();
  list.push(comment);
  write(list);
  emitEvent({
    type: "profile.updated",
    investorId: input.investorId,
    payload: { commentId: comment.id },
  });
  return comment;
}