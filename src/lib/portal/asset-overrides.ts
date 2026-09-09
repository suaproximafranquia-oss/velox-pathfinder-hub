/**
 * IMAGENS EDITÁVEIS DO PORTAL DO INVESTIDOR.
 *
 * O Portal continua sendo UM SÓ. O que existe aqui é apenas a camada de
 * SUBSTITUIÇÃO de imagem: cada espaço do Portal tem uma chave estável e,
 * quando existe uma substituição gravada para a unidade, ela é exibida
 * no lugar da imagem original. Remover a substituição devolve a imagem
 * original — o arquivo original nunca é apagado nem alterado.
 *
 * Isolamento por unidade: toda leitura e toda gravação carregam a
 * unidade. Uma troca na Financeira jamais aparece na Solar ou na
 * Seguradora.
 */
import { useEffect, useState } from "react";

/** Espaços de imagem do Portal que podem ser substituídos. */
export const PORTAL_ASSET_SLOTS = [
  { key: "home-capa", label: "Capa da Home" },
  { key: "modulo-manual", label: "Módulo — Manual do Investidor" },
  { key: "modulo-universo", label: "Módulo — Material institucional" },
  { key: "modulo-simulador", label: "Módulo — Simulador" },
  { key: "modulo-sede", label: "Módulo — Nossa Estrutura" },
  { key: "modulo-revista", label: "Módulo — Revista Velox" },
  { key: "modulo-experiencias", label: "Módulo — Experiências" },
  { key: "estrutura-matriz", label: "Nossa Estrutura — Matriz" },
  { key: "estrutura-recepcao", label: "Nossa Estrutura — Recepção" },
  { key: "estrutura-unidade", label: "Nossa Estrutura — Unidades da rede" },
  { key: "principios-capa", label: "Capa — Princípios Velox" },
] as const;

export type PortalAssetSlot = (typeof PORTAL_ASSET_SLOTS)[number]["key"];

export function portalSlotLabel(key: string): string {
  return PORTAL_ASSET_SLOTS.find((s) => s.key === key)?.label ?? key;
}

/* ------------------------- estado do navegador ------------------------- */

type Store = Record<string, string>;

let saved: Store = {};
let pending: Store = {};
/** Chaves cuja substituição será REMOVIDA ao salvar. */
let removals = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribePortalAssets(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Substituições oficiais vindas do servidor. */
export function setSavedPortalAssets(map: Store): void {
  saved = { ...map };
  pending = {};
  removals = new Set();
  emit();
}

/** Alteração local (modo editor) — só vale de verdade depois de Salvar. */
export function stagePortalAsset(key: string, url: string): void {
  pending[key] = url;
  removals.delete(key);
  emit();
}

/** Marca a substituição para remoção — volta a imagem original. */
export function stagePortalAssetRemoval(key: string): void {
  delete pending[key];
  removals.add(key);
  emit();
}

export function discardPortalAssetChanges(): void {
  pending = {};
  removals = new Set();
  emit();
}

export function pendingPortalAssetChanges(): {
  updates: Array<{ key: string; url: string }>;
  removals: string[];
} {
  return {
    updates: Object.entries(pending).map(([key, url]) => ({ key, url })),
    removals: [...removals],
  };
}

export function hasPendingPortalAssetChanges(): boolean {
  return Object.keys(pending).length > 0 || removals.size > 0;
}

/** URL efetiva do espaço: alteração local → substituição salva → original. */
export function portalAssetUrl(key: string, original: string): string {
  if (removals.has(key)) return original;
  return pending[key] ?? saved[key] ?? original;
}

/** Assinatura React da imagem de um espaço do Portal. */
export function usePortalAsset(key: string, original: string): string {
  const [url, setUrl] = useState(() => portalAssetUrl(key, original));
  useEffect(() => {
    setUrl(portalAssetUrl(key, original));
    return subscribePortalAssets(() => setUrl(portalAssetUrl(key, original)));
  }, [key, original]);
  return url;
}
