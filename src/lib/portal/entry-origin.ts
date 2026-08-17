/**
 * COMANDO 4E §47 — FONTE CENTRAL DE DECISÃO DE ORIGEM.
 *
 * Nenhuma tela decide sozinha de onde o visitante veio. Toda a
 * plataforma consome `resolveEntryOrigin`.
 */
import type { ExecutiveRole, ExecutiveUser } from "@/lib/executive-auth";

export type EntryOriginKind =
  | "PERSONALIZED_EXECUTIVE"
  | "LARISSA_MANAGER"
  | "RAW_PUBLIC"
  | "CAMPAIGN_DEFAULT";

export type EntryOriginInput = {
  /** Executivo do link personalizado, quando existir. */
  executive?: { id: string; role: ExecutiveRole } | ExecutiveUser | null;
  /** Campanha declarada no link (tráfego pago). */
  campaign?: string | null;
};

/**
 * Regra única:
 *  - link de usuário com perfil de Gestora  → LARISSA_MANAGER;
 *  - link de qualquer outro usuário          → PERSONALIZED_EXECUTIVE;
 *  - sem executivo, com campanha             → CAMPAIGN_DEFAULT;
 *  - sem executivo e sem campanha            → RAW_PUBLIC.
 */
export function resolveEntryOrigin(input: EntryOriginInput): EntryOriginKind {
  const exec = input.executive ?? null;
  if (exec?.id) {
    return exec.role === "diretora" ? "LARISSA_MANAGER" : "PERSONALIZED_EXECUTIVE";
  }
  return input.campaign ? "CAMPAIGN_DEFAULT" : "RAW_PUBLIC";
}

/** Entrada por link pessoal (Executivo ou Gestora). */
export function isPersonalizedOrigin(kind: EntryOriginKind): boolean {
  return kind === "PERSONALIZED_EXECUTIVE" || kind === "LARISSA_MANAGER";
}

/**
 * §26 — a segunda tela de identificação existe SOMENTE para quem chegou
 * sem executivo identificado.
 */
export function requiresSecondIdentificationScreen(kind: EntryOriginKind): boolean {
  return !isPersonalizedOrigin(kind);
}
