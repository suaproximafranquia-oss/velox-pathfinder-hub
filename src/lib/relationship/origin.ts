/**
 * COMANDO 4F-A/4F-B — ORIGEM DE ENTRADA DO INVESTIDOR.
 *
 * Fonte única de verdade sobre COMO o investidor chegou. A origem
 * jamais é convertida em outra: tráfego pago não vira "Portal", e
 * redistribuição nunca é tratada como entrada nova.
 */
import type { CadenceStep } from "./types";

export type EntryOrigin =
  /** Entrou pelo Portal do Investidor (jornada já iniciada). */
  | "PORTAL"
  /** Veio do GreenSales (Portal dos Leads) — origem comercial real. */
  | "GREENSALES"
  /** Anúncio pago (Meta/Google) — nunca convertido em Portal. */
  | "TRAFEGO_PAGO"
  /** Link pessoal de um Executivo. */
  | "LINK_PERSONALIZADO"
  /** Movimentação interna feita pela Gestora — não é entrada nova. */
  | "REDISTRIBUICAO"
  /** Link institucional sem executivo e sem campanha. */
  | "RAW_PUBLIC";

export const ENTRY_ORIGIN_LABEL: Record<EntryOrigin, string> = {
  PORTAL: "Portal do Investidor",
  GREENSALES: "GreenSales",
  TRAFEGO_PAGO: "Tráfego pago",
  LINK_PERSONALIZADO: "Link personalizado",
  REDISTRIBUICAO: "Redistribuição",
  RAW_PUBLIC: "Acesso institucional",
};

export function isEntryOrigin(value: unknown): value is EntryOrigin {
  return (
    value === "PORTAL" ||
    value === "GREENSALES" ||
    value === "TRAFEGO_PAGO" ||
    value === "LINK_PERSONALIZADO" ||
    value === "REDISTRIBUICAO" ||
    value === "RAW_PUBLIC"
  );
}

export function normalizeEntryOrigin(value: unknown): EntryOrigin | null {
  return isEntryOrigin(value) ? value : null;
}

/**
 * §4F-B — a primeira mensagem depende da origem:
 *  - PORTAL              → E0_V1 (o investidor JÁ conhece o Portal);
 *  - demais entradas     → E0 (apresenta a Velox e o Portal);
 *  - REDISTRIBUICAO      → nenhuma: redistribuir não dispara contato.
 */
export function resolveInitialStep(origin: EntryOrigin | null | undefined): CadenceStep | null {
  if (origin === "REDISTRIBUICAO") return null;
  return origin === "PORTAL" ? "E0_V1" : "E0";
}

/** Redistribuição jamais gera primeiro contato automático. */
export function originStartsFirstContact(origin: EntryOrigin | null | undefined): boolean {
  return resolveInitialStep(origin) !== null;
}
