/**
 * CONTADOR DE USO DA BIBLIOTECA — SERVER ONLY.
 *
 * A rotação POR LEAD (decisão fechada) escolhe entre os conteúdos MENOS
 * utilizados. Isso só funciona se o uso for realmente registrado: até
 * aqui `usage_count` ficava em zero e a rotação decidia sempre pelo
 * mesmo critério de desempate, concentrando os envios.
 *
 * A escrita acontece UMA única vez por envio efetivo — depois que a
 * mensagem foi gravada com id determinístico, o que já garante que um
 * retry não conta duas vezes. Simulação também conta: o objetivo é
 * distribuir a biblioteca, e a homologação usa o mesmo motor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function registerContentUsage(
  contentId: string | null | undefined,
  at: string = new Date().toISOString(),
): Promise<void> {
  if (!contentId) return;
  try {
    const { data } = await supabaseAdmin
      .from("relationship_contents")
      .select("usage_count")
      .eq("id", contentId)
      .maybeSingle();
    const current = Number((data as Record<string, any> | null)?.["usage_count"] ?? 0);
    await supabaseAdmin
      .from("relationship_contents")
      .update({ usage_count: current + 1, last_used_at: at } as any)
      .eq("id", contentId);
  } catch {
    // O contador é acessório: nunca derruba um envio já registrado.
  }
}
