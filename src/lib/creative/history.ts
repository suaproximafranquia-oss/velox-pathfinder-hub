/**
 * Histórico local das peças geradas pela IA Criativa.
 * Registro leve (metadados apenas) — os arquivos oficiais vivem no Drive.
 */
import type { CreativeCategory, CreativeModel } from "./brand";

const KEY = "atlas.creative.history.v1";

export type CreativeHistoryEntry = {
  id: string;
  createdAt: string;
  userId: string;
  category: CreativeCategory;
  model: CreativeModel;
  unit: string;
  city: string;
  fileName: string;
  driveLink?: string | null;
};

export function listCreativeHistory(userId?: string): CreativeHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as CreativeHistoryEntry[]) : [];
    const scoped = userId ? all.filter((e) => e.userId === userId) : all;
    return scoped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function recordCreative(entry: Omit<CreativeHistoryEntry, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as CreativeHistoryEntry[]) : [];
    all.push({
      ...entry,
      id: `crt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    });
    window.localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    /* histórico é auxiliar: nunca interrompe a geração */
  }
}