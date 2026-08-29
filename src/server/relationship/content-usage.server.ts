/**
 * CONTADOR DE USO DA BIBLIOTECA — SERVER ONLY.
 *
 * A rotação POR LEAD (decisão fechada) escolhe entre os conteúdos MENOS
 * utilizados. Isso só funciona se o uso for realmente registrado.
 *
 * REGRA DEFINITIVA (Comando 2/3): conta APENAS entrega efetiva.
 *   • simulação/homologação NÃO conta;
 *   • bloqueio NÃO conta;
 *   • falha de canal NÃO conta;
 *   • retry do mesmo envio conta uma única vez (id determinístico da
 *     mensagem já impede a segunda gravação e, com ela, o incremento).
 *
 * O incremento é ATÔMICO no banco (`increment_content_usage`), então dois
 * envios simultâneos não se sobrescrevem.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function registerContentUsage(
  contentId: string | null | undefined,
  at: string = new Date().toISOString(),
): Promise<void> {
  if (!contentId) return;
  try {
    await supabaseAdmin.rpc("increment_content_usage" as never, {
      _content_id: contentId,
      _at: at,
    } as never);
  } catch {
    // O contador é acessório: nunca derruba um envio já registrado.
  }
}
