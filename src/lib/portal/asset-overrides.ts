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
import { assetUrl, type AssetKey } from "@/lib/assets/registry";

/**
 * MATERIAL INSTITUCIONAL (`/universo`) — imagens editoriais da página.
 * Cada imagem tem chave estável própria (`universo-<asset>`), lê a
 * substituição da unidade e mantém o arquivo original como retorno.
 */
export const UNIVERSO_ASSETS: { asset: AssetKey; label: string }[] = [
  { asset: "sede-velox", label: "Sede Velox (capa)" },
  { asset: "fundador-mario-sergio", label: "Fundador — Mário Sérgio" },
  { asset: "unidade-fachada", label: "Unidade — fachada" },
  { asset: "unidade-fachada-alternativa", label: "Unidade — fachada alternativa" },
  { asset: "unidade-inauguracao", label: "Unidade — inauguração" },
  { asset: "treinamento-rede", label: "Treinamento da rede" },
  { asset: "embaixador-ciro-bottini", label: "Embaixador — Ciro Bottini" },
  { asset: "decisao-investidor", label: "Decisão do investidor" },
  { asset: "atendimento-consultivo", label: "Atendimento consultivo" },
  { asset: "mercado-distrito-financeiro", label: "Mercado — distrito financeiro" },
  { asset: "consumidor-financeiro", label: "Consumidor financeiro" },
  { asset: "reuniao-colaborativa", label: "Reunião colaborativa" },
  { asset: "plataforma-tecnologica", label: "Plataforma tecnológica" },
  { asset: "encerramento-edificio", label: "Encerramento — edifício" },
  { asset: "equipe-expansao", label: "Equipe de expansão" },
  { asset: "diretora-expansao-larissa", label: "Diretora de Expansão — Larissa" },
  { asset: "marketplace-parceiros", label: "Parceiros e instituições" },
  { asset: "fundador-com-consultores", label: "Fundador com consultores" },
  { asset: "modelo-home-office", label: "Modelo home office" },
];

/** Chave do espaço de substituição de uma imagem do Material Institucional. */
export function universoSlotKey(asset: string): string {
  return `universo-${asset}`;
}

/** Espaços de imagem do Portal que podem ser substituídos. */
export const PORTAL_ASSET_SLOTS: { key: string; label: string; asset?: AssetKey }[] = [
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
  ...UNIVERSO_ASSETS.map((i) => ({
    key: universoSlotKey(i.asset),
    label: `Material institucional — ${i.label}`,
    asset: i.asset,
  })),
];

export type PortalAssetSlot = (typeof PORTAL_ASSET_SLOTS)[number]["key"];

/** Imagem original (de fábrica) de um espaço, quando conhecida. */
export function portalSlotOriginal(key: string): string {
  const slot = PORTAL_ASSET_SLOTS.find((s) => s.key === key) as
    | { asset?: AssetKey }
    | undefined;
  return slot?.asset ? assetUrl(slot.asset) : "";
}

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
