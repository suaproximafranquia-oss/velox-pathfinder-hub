/**
 * RESPOSTA AUTOMÁTICA DENTRO DA JANELA DE 24 HORAS — SERVER ONLY.
 *
 * Quando o investidor escreve fora do horário do executivo, o sistema
 * pode dar UMA orientação objetiva para não deixar a pessoa no vácuo.
 * As travas existem para que isso nunca vire um robô conversando:
 *
 *  - No máximo UMA resposta automática por janela de 24h.
 *  - No máximo DUAS orientações automáticas no total da instância.
 *  - Atingido o limite, a conversa escala para o humano e o sistema cala.
 *  - Após 30 dias sem interação, os contadores reiniciam.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 30 * DAY_MS;
const MAX_PER_WINDOW = 1;
const MAX_TOTAL = 2;

export type AutoReplyDecision =
  | { send: false; reason: string; escalate: boolean }
  | { send: true; reason: string; escalate: false };

export async function decideAutoReply(leadId: string): Promise<AutoReplyDecision> {
  const { data } = await supabaseAdmin
    .from("relationship_cadences")
    .select("id,auto_reply_window_started_at,auto_reply_window_count,auto_reply_total_count,auto_reply_last_at")
    .eq("scope", "production")
    .eq("lead_id", leadId)
    .eq("active", true)
    .order("instance_seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) {
    return { send: false, reason: "Lead sem jornada ativa — resposta é do executivo.", escalate: true };
  }

  const row = data as Record<string, any>;
  const now = Date.now();
  const lastAt = row["auto_reply_last_at"] ? new Date(row["auto_reply_last_at"]).getTime() : null;

  // Silêncio longo reinicia o relacionamento automático.
  const dormant = lastAt !== null && now - lastAt >= RESET_MS;
  const windowStart = row["auto_reply_window_started_at"]
    ? new Date(row["auto_reply_window_started_at"]).getTime()
    : null;
  const windowOpen = !dormant && windowStart !== null && now - windowStart < DAY_MS;

  const windowCount = dormant || !windowOpen ? 0 : (row["auto_reply_window_count"] ?? 0);
  const totalCount = dormant ? 0 : (row["auto_reply_total_count"] ?? 0);

  if (totalCount >= MAX_TOTAL) {
    return {
      send: false,
      reason: "Limite de orientações automáticas atingido — conversa entregue ao executivo.",
      escalate: true,
    };
  }
  if (windowCount >= MAX_PER_WINDOW) {
    return {
      send: false,
      reason: "Já houve uma orientação automática nesta janela de 24h.",
      escalate: false,
    };
  }

  const at = new Date(now).toISOString();
  await supabaseAdmin
    .from("relationship_cadences")
    .update({
      auto_reply_window_started_at: windowOpen ? row["auto_reply_window_started_at"] : at,
      auto_reply_window_count: windowCount + 1,
      auto_reply_total_count: totalCount + 1,
      auto_reply_last_at: at,
      updated_at: at,
    } as any)
    .eq("id", row["id"]);

  return { send: true, reason: "Orientação automática permitida nesta janela.", escalate: false };
}
