/**
 * PRESENÇA DO INVESTIDOR — DERIVADA DE FATO REAL (SERVER ONLY).
 *
 * O cabeçalho da conversa nunca inventa horário nem "adivinha" que
 * alguém está online. A presença é derivada exclusivamente da ÚLTIMA
 * MENSAGEM RECEBIDA do investidor:
 *
 *   • recebida há menos de 15 minutos → conversa ativa agora;
 *   • recebida antes disso            → último contato, com o horário real;
 *   • nunca recebida                  → sem atividade, e é isso que se diz.
 *
 * Mensagens simuladas (homologação) não produzem presença real.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const PRESENCE_WINDOW_MINUTES = 15;

export type InvestorPresence = {
  online: boolean;
  lastInboundAt: string | null;
  label: string;
};

export async function resolveInvestorPresence(leadId: string): Promise<InvestorPresence> {
  const { data } = await supabaseAdmin
    .from("crm_messages")
    .select("at,simulated")
    .eq("investor_id", leadId)
    .eq("direction", "recebida")
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as Record<string, any> | null;
  if (!row || row["simulated"]) {
    return { online: false, lastInboundAt: null, label: "Sem mensagens recebidas" };
  }

  const at = String(row["at"]);
  const elapsedMinutes = (Date.now() - new Date(at).getTime()) / 60000;
  if (elapsedMinutes <= PRESENCE_WINDOW_MINUTES) {
    return { online: true, lastInboundAt: at, label: "Conversa ativa agora" };
  }

  const date = new Date(at);
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const day = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return {
    online: false,
    lastInboundAt: at,
    label: day === today ? `Última mensagem hoje às ${time}` : `Última mensagem em ${day} às ${time}`,
  };
}
