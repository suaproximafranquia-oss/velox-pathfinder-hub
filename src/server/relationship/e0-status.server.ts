/**
 * STATUS AUDITÁVEL DA E0 (Refino Final §3).
 *
 * A E0 já tinha toda a decisão registrada no servidor (mensagem,
 * snapshot congelado e log de bloqueio). O que faltava era EXPOR esse
 * estado para o executivo, sem recalcular nada e sem inferir.
 *
 * Três estados possíveis, todos lidos de fatos gravados:
 *   • enviada   → existe snapshot em relationship_message_sends;
 *   • bloqueada → último relationship_engine_log 'e0_bloqueada' do lead;
 *   • pendente  → nenhum dos dois.
 *
 * Esta leitura NUNCA dispara, reprocessa ou corrige a E0.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type E0Status = {
  state: "enviada" | "bloqueada" | "pendente";
  /** Momento do envio registrado (ISO), quando houver. */
  sentAt: string | null;
  /** Execução simulada (homologação ou lead de teste). */
  simulated: boolean;
  /** Executivo responsável congelado no envio. */
  executiveName: string | null;
  /** Destinos congelados no envio. */
  portalDestination: string | null;
  contactPhone: string | null;
  /** Versão da Biblioteca usada no texto entregue. */
  libraryVersion: number | null;
  /** Motivo legível do bloqueio, quando houver. */
  blockReason: string | null;
  /** Itens que faltaram para a E0 poder sair. */
  blockers: string[];
  blockedAt: string | null;
};

export async function readE0Status(leadId: string): Promise<E0Status> {
  const [{ data: send }, { data: blocks }] = await Promise.all([
    supabaseAdmin
      .from("relationship_message_sends")
      .select(
        "sent_at, simulated, executive_name, portal_destination, contact_phone, library_version",
      )
      .eq("lead_id", leadId)
      .eq("step", "E0")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("relationship_engine_log")
      .select("details, at")
      .eq("action", "e0_bloqueada")
      .order("at", { ascending: false })
      .limit(50),
  ]);

  if (send) {
    const row = send as Record<string, any>;
    return {
      state: "enviada",
      sentAt: row["sent_at"] ?? null,
      simulated: Boolean(row["simulated"]),
      executiveName: row["executive_name"] ?? null,
      portalDestination: row["portal_destination"] ?? null,
      contactPhone: row["contact_phone"] ?? null,
      libraryVersion: row["library_version"] ?? null,
      blockReason: null,
      blockers: [],
      blockedAt: null,
    };
  }

  const block = ((blocks ?? []) as Array<Record<string, any>>).find(
    (row) => String(row["details"]?.leadId ?? "") === leadId,
  );

  const empty = {
    sentAt: null,
    simulated: false,
    executiveName: null,
    portalDestination: null,
    contactPhone: null,
    libraryVersion: null,
  };

  if (block) {
    const details = (block["details"] ?? {}) as Record<string, any>;
    return {
      ...empty,
      state: "bloqueada",
      blockReason: String(details["reason"] ?? "Destinos não resolvidos."),
      blockers: Array.isArray(details["blockers"]) ? details["blockers"].map(String) : [],
      blockedAt: block["at"] ?? null,
    };
  }

  return { ...empty, state: "pendente", blockReason: null, blockers: [], blockedAt: null };
}
