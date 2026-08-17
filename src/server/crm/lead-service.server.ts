/**
 * Lead Service — persistência e regras do lead no NOSSO banco.
 *
 * O lead externo é reconhecido pela chave de integração
 * (`external_source` + `external_id`). Receber o mesmo lead N vezes
 * continua representando UM único lead interno.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LeadEventType =
  | "lead_criado"
  | "lead_sincronizado"
  | "lead_atualizado"
  | "etapa_alterada"
  | "nova_entrada"
  | "tag_alterada"
  | "boas_vindas_iniciada"
  | "boas_vindas_enviada"
  | "boas_vindas_falhou"
  | "sincronizacao_falhou"
  | "sincronizacao_recuperada"
  | "tentativa_sincronizacao";

export type CrmLeadRow = {
  id: string;
  external_id: string;
  name: string;
  phone: string;
  email: string;
  origin: string | null;
  capture_form: string | null;
  external_pipeline_id: string | null;
  pipeline_name: string | null;
  stage_key: string | null;
  external_stage_id: string | null;
  external_created_at: string | null;
  last_entry_at: string | null;
  entry_count: number;
  ingested_at: string;
  last_synced_at: string | null;
  sync_status: string;
  sync_error: string | null;
  welcome_status: string;
  welcome_started_at: string | null;
  welcome_sent_at: string | null;
  welcome_template: string | null;
  welcome_link: string | null;
  welcome_error: string | null;
};

export async function recordEvent(
  leadId: string,
  type: LeadEventType,
  message?: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin.from("crm_lead_events").insert({
    lead_id: leadId,
    type,
    message: message ?? null,
    data: (data ?? null) as never,
  });
}

export type UpsertInput = {
  externalId: string;
  name: string;
  phone: string;
  email: string;
  origin: string | null;
  captureForm: string | null;
  externalPipelineId: string | null;
  pipelineName: string | null;
  stageKey: string | null;
  externalStageId: string | null;
  externalCreatedAt: string | null;
  /**
   * Data/hora da última entrada comercial informada pela origem
   * (novo cadastro da MESMA pessoa). Nunca substitui o histórico.
   */
  lastEntryAt?: string | null;
  rawPayload: unknown;
  /**
   * Carga histórica: o lead já existia na origem antes do Portal. Ele é
   * apenas descoberto agora e NUNCA entra na fila de primeiro contato.
   */
  historical?: boolean;
};

export type UpsertOutcome = {
  lead: CrmLeadRow;
  created: boolean;
  changed: boolean;
  /** Mesma pessoa, novo cadastro na origem — nova oportunidade comercial. */
  newEntry: boolean;
};

const SELECT = "*";

/**
 * Estado mínimo já conhecido do lead — usado ANTES do upsert para
 * decidir se a origem registrou uma nova entrada comercial e, com isso,
 * qual relação de funil está vigente.
 */
export type LeadEntryState = {
  exists: boolean;
  stageKey: string | null;
  lastEntryAt: string | null;
  entryCount: number;
};

export async function getLeadEntryState(externalId: string): Promise<LeadEntryState> {
  const { data } = await supabaseAdmin
    .from("crm_leads")
    .select("stage_key,last_entry_at,entry_count")
    .eq("external_source", "greensales")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!data) return { exists: false, stageKey: null, lastEntryAt: null, entryCount: 0 };
  return {
    exists: true,
    stageKey: data.stage_key,
    lastEntryAt: data.last_entry_at,
    entryCount: data.entry_count ?? 1,
  };
}

/** Nova entrada = mesma pessoa, novo cadastro posterior ao já conhecido. */
export function isNewCommercialEntry(
  previousEntryAt: string | null,
  incomingEntryAt: string | null | undefined,
): boolean {
  if (!incomingEntryAt) return false;
  const incoming = Date.parse(incomingEntryAt);
  if (Number.isNaN(incoming)) return false;
  if (!previousEntryAt) return false;
  const previous = Date.parse(previousEntryAt);
  if (Number.isNaN(previous)) return false;
  return incoming > previous;
}

/** Upsert idempotente: nunca duplica e sempre registra o histórico. */
export async function upsertLead(input: UpsertInput): Promise<UpsertOutcome> {
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from("crm_leads")
    .select(SELECT)
    .eq("external_source", "greensales")
    .eq("external_id", input.externalId)
    .maybeSingle();

  const base = {
    name: input.name,
    phone: input.phone,
    email: input.email,
    origin: input.origin,
    capture_form: input.captureForm,
    external_pipeline_id: input.externalPipelineId,
    pipeline_name: input.pipelineName,
    stage_key: input.stageKey,
    external_stage_id: input.externalStageId,
    external_created_at: input.externalCreatedAt,
    last_synced_at: now,
    sync_status: "OK",
    sync_error: null,
    raw_payload: input.rawPayload as never,
  };

  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from("crm_leads")
      .insert({
        external_source: "greensales",
        external_id: input.externalId,
        ingested_at: now,
        last_entry_at: input.lastEntryAt ?? input.externalCreatedAt ?? now,
        // Data de entrada na etapa atual — referência da fila de ligações.
        stage_entered_at: now,
        entry_count: 1,
        // PENDING representa uma operação real de envio aguardando
        // processamento — nunca "nunca recebeu mensagem".
        welcome_status: input.historical ? "NOT_APPLICABLE" : "PENDING",
        ...base,
      })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    const lead = data as unknown as CrmLeadRow;
    await recordEvent(
      lead.id,
      "lead_criado",
      input.historical
        ? "Lead histórico importado da origem externa (sem primeiro contato)."
        : "Lead recebido da origem externa.",
      { externalId: input.externalId, stage: input.stageKey, historico: Boolean(input.historical) },
    );
    return { lead, created: true, changed: true, newEntry: false };
  }

  const previous = existing as unknown as CrmLeadRow;
  const newEntry = isNewCommercialEntry(previous.last_entry_at, input.lastEntryAt);
  // Ausência de relação de funil na origem NÃO é movimentação: apagar uma
  // marcação auxiliar jamais tira o lead da coluna em que ele está.
  const stageKey = input.stageKey ?? previous.stage_key;
  const externalStageId = input.stageKey ? input.externalStageId : previous.external_stage_id;
  const stageChanged = previous.stage_key !== stageKey;
  const changed =
    stageChanged ||
    newEntry ||
    previous.name !== input.name ||
    previous.phone !== input.phone ||
    previous.email !== input.email ||
    previous.origin !== input.origin;

  const { data, error } = await supabaseAdmin
    .from("crm_leads")
    .update({
      ...base,
      stage_key: stageKey,
      external_stage_id: externalStageId,
      // A contagem da cadência de ligações parte da TRANSIÇÃO de etapa.
      stage_entered_at: stageChanged
        ? now
        : ((previous as unknown as { stage_entered_at?: string | null }).stage_entered_at ?? now),
      last_entry_at: newEntry
        ? (input.lastEntryAt as string)
        : (previous.last_entry_at ?? input.lastEntryAt ?? input.externalCreatedAt),
      entry_count: newEntry ? (previous.entry_count ?? 1) + 1 : (previous.entry_count ?? 1),
    })
    .eq("id", previous.id)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  const lead = data as unknown as CrmLeadRow;

  if (previous.sync_status !== "OK") {
    await recordEvent(lead.id, "sincronizacao_recuperada", "Sincronização normalizada.");
  }
  if (newEntry) {
    // Mesma pessoa, nova oportunidade comercial. O histórico anterior
    // permanece intacto — nada é apagado nem duplicado.
    await recordEvent(
      lead.id,
      "nova_entrada",
      "Nova entrada comercial registrada na origem (novo cadastro do mesmo lead).",
      { entrada: input.lastEntryAt, entradas: lead.entry_count, etapa: stageKey },
    );
  }
  if (stageChanged) {
    await recordEvent(lead.id, "etapa_alterada", "Etapa atualizada pela origem externa.", {
      de: previous.stage_key,
      para: stageKey,
    });
  } else if (changed && !newEntry) {
    await recordEvent(lead.id, "lead_atualizado", "Dados atualizados pela origem externa.");
  } else if (!changed) {
    await recordEvent(lead.id, "lead_sincronizado", "Lead reconhecido — sem alterações.");
  }
  return { lead, created: false, changed, newEntry };
}

export async function markSyncFailure(externalId: string, message: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("crm_leads")
    .update({ sync_status: "ERRO", sync_error: message, last_synced_at: new Date().toISOString() })
    .eq("external_source", "greensales")
    .eq("external_id", externalId)
    .select("id")
    .maybeSingle();
  if (data?.id) await recordEvent(data.id, "sincronizacao_falhou", message);
}
