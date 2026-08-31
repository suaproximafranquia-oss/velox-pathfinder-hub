/**
 * Leitura (somente leitura) do estado da trava global de envio real de
 * WhatsApp. Não existe função de escrita: nenhum botão do frontend pode
 * liberar o envio — a ativação futura é exclusivamente server-side.
 */
import { createServerFn } from "@tanstack/react-start";

export const readWhatsappSafetyLock = createServerFn({ method: "GET" }).handler(async () => {
  const { whatsappSafetyLockStatus } = await import("@/server/whatsapp-safety-lock.server");
  return whatsappSafetyLockStatus();
});
