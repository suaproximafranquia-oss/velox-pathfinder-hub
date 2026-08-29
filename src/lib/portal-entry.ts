/**
 * Contexto de entrada do Portal Velox.
 *
 * Links personalizados, campanhas e QR Codes nunca navegam para módulos
 * internos: eles apenas informam o CONTEXTO inicial (executivo, unidade,
 * origem, campanha) e qual módulo deve ser aberto sobre a Home após o
 * Gateway. Este utilitário guarda esse contexto entre o redirecionamento
 * para a Home e a criação da sessão.
 */
import type { PortalModuleKey } from "@/lib/portal-modules";

const ENTRY_KEY = "velox:portal:entry-context:v1";

export type EntryContext = {
  executiveSlug: string | null;
  /** Marca/operação do link público (`/f`, `/s`, `/seg`). */
  brand: string | null;
  unit: string | null;
  origin: string | null;
  campaign: string | null;
  /**
   * COMANDO 3 §8 — canal oficial de origem do link (`/origem/tiktok`,
   * `/origem/meta`). Valores válidos: "tiktok" | "meta".
   */
  channel: string | null;
  /**
   * FASE 1 §6 — o visitante chegou pelo Portal Institucional do Grupo
   * Velox e escolheu uma das empresas. Não substitui executivo, marca,
   * campanha ou canal: acrescenta-se a eles.
   */
  fromGroup: boolean;
  /** Módulo solicitado antes do Gateway — reaberto após a sessão. */
  pendingModule: PortalModuleKey | null;
  at: string;
};

export const GROUP_ORIGIN_LABEL = "Veio do Grupo Velox";

const EMPTY: EntryContext = {
  executiveSlug: null,
  brand: null,
  unit: null,
  origin: null,
  campaign: null,
  channel: null,
  fromGroup: false,
  pendingModule: null,
  at: new Date(0).toISOString(),
};


export function readEntryContext(): EntryContext {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(ENTRY_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as EntryContext) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function writeEntryContext(patch: Partial<EntryContext>): EntryContext {
  const next: EntryContext = {
    ...readEntryContext(),
    ...patch,
    at: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(ENTRY_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }
  return next;
}

export function clearPendingModule() {
  writeEntryContext({ pendingModule: null });
}
