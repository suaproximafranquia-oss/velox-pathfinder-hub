/**
 * Barramento de sincronização do Connect Hub (DEF 2.4.13).
 *
 * Todos os módulos (CRM, Workspace, Portal, Reuniões, Alertas, Backup e
 * Auditoria) leem a mesma base local. Até aqui, cada tela descobria uma
 * alteração apenas por `storage` — evento que o navegador NÃO dispara na
 * aba que gravou. Resultado: iniciar um relacionamento no CRM não
 * refletia no Workspace da mesma aba sem recarregar.
 *
 * Este barramento resolve exatamente essa inconsistência: toda gravação
 * avisa a própria aba (evento customizado) e as demais (ping em
 * localStorage). Nenhuma regra de negócio vive aqui.
 */
export type SyncChannel =
  | "leads"
  | "commercial"
  | "meetings"
  | "messages"
  | "alerts"
  | "audit";

const EVENT_NAME = "velox:sync";
const PING_KEY = "velox:sync:ping";

export function notifySync(channel: SyncChannel): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: channel }));
  } catch {
    /* ambiente sem CustomEvent */
  }
  try {
    window.localStorage.setItem(PING_KEY, `${channel}:${Date.now()}`);
  } catch {
    /* armazenamento indisponível */
  }
}

/** Observa alterações da própria aba e de qualquer outra aba aberta. */
export function onSync(
  listener: (channel: SyncChannel | "external") => void,
  channels?: SyncChannel[],
): () => void {
  if (typeof window === "undefined") return () => {};
  const accepts = (c: SyncChannel) => !channels || channels.includes(c);
  const onLocal = (event: Event) => {
    const channel = (event as CustomEvent<SyncChannel>).detail;
    if (accepts(channel)) listener(channel);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== PING_KEY) return;
    const channel = (event.newValue?.split(":")[0] ?? "") as SyncChannel;
    if (!channel || accepts(channel)) listener(channel || "external");
  };
  window.addEventListener(EVENT_NAME, onLocal as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onLocal as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
