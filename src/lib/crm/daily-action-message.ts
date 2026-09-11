import type { StepMessageView } from "./daily-actions.adapter";

/**
 * Carrega primeiro e abre sempre que existe uma mensagem oficial. A
 * tentativa de clipboard é posterior e nunca decide a visibilidade.
 */
export async function loadMessageForModal(
  load: () => Promise<StepMessageView | null>,
  copy: (body: string | null | undefined) => Promise<boolean>,
): Promise<{ message: StepMessageView | null; open: boolean; copied: boolean }> {
  const message = await load();
  if (!message) return { message: null, open: false, copied: false };
  const copied = await copy(message.body);
  return { message, open: true, copied };
}