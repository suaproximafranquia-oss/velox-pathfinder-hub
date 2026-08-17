/**
 * Controle único de overlays do Portal Velox.
 *
 * A Home é a base permanente da aplicação e todo módulo interno é
 * aberto sobre ela. Este store garante as regras oficiais:
 *
 * • apenas um overlay ativo por vez;
 * • qualquer overlay novo encerra o anterior;
 * • enquanto houver overlay ativo, o FAB global da Home desaparece —
 *   ao fechar, ele é restaurado automaticamente.
 */
export type OverlayKey =
  | "gateway"
  | "manual"
  | "universo"
  | "simulador"
  | "estrutura"
  | "revista"
  | "principios"
  | "agenda"
  | null;

let active: OverlayKey = null;
const listeners = new Set<(key: OverlayKey) => void>();

export function getActiveOverlay(): OverlayKey {
  return active;
}

export function setActiveOverlay(key: OverlayKey) {
  if (active === key) return;
  active = key;
  listeners.forEach((l) => l(active));
}

export function closeOverlay(key?: Exclude<OverlayKey, null>) {
  if (key && active !== key) return;
  setActiveOverlay(null);
}

export function subscribeOverlay(listener: (key: OverlayKey) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
