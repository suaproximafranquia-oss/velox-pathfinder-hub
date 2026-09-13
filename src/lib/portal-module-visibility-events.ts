const EVENT_NAME = "atlas:financeira-portal-modules-updated";
const CHANNEL_NAME = "atlas:financeira-portal-modules";

type Listener = () => void;

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

/** Notifica outras telas para que releiam a configuração oficial do servidor. */
export function announcePortalModuleVisibilityUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
  const channel = openChannel();
  channel?.postMessage("refresh");
  channel?.close();
}

/** A notificação não transporta estado: cada tela sempre relê o servidor. */
export function subscribePortalModuleVisibilityUpdates(listener: Listener): () => void {
  if (typeof window === "undefined") return () => undefined;
  const channel = openChannel();
  const onMessage = () => listener();
  window.addEventListener(EVENT_NAME, listener);
  channel?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    channel?.removeEventListener("message", onMessage);
    channel?.close();
  };
}