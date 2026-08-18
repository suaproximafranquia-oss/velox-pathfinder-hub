/**
 * FOCO DE LEITURA DO PORTAL.
 *
 * Enquanto o investidor está dentro do leitor da Revista, nenhum
 * elemento externo (como o botão flutuante "Solicitar Atendimento")
 * pode ocupar a área da revista. O botão continua existindo em todo o
 * restante da experiência — apenas se recolhe durante a leitura.
 */
type Listener = (focused: boolean) => void;

let focused = false;
const listeners = new Set<Listener>();

export function isReaderFocused(): boolean {
  return focused;
}

export function setReaderFocus(value: boolean): void {
  if (focused === value) return;
  focused = value;
  for (const listener of listeners) listener(focused);
}

export function subscribeReaderFocus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
