/**
 * Lead Service — persistência e regras do lead no NOSSO banco.
 *
 * O lead externo é reconhecido pela chave de integração
 * (`external_source` + `external_id`). Receber o mesmo lead N vezes
 * continua representando UM único lead interno.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePhone } from "@/lib/greensales/normalize";

/**
 * O Postgres rejeita jsonb com NUL (\u0000) — "unsupported Unicode escape
 * sequence". A API de origem às vezes devolve o caractere embutido em
 * textos de leads; varremos o payload e removemos antes de gravar.
 */
export function sanitizeRawPayload<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "") as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRawPayload(item)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeRawPayload(item);
    }
    return out as T;
  }
  return value;
}

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
  | "workspace_card_criado"
  | "workspace_card_falhou"
  | "e0_identificada"
  | "e0_simulada"
  | "e0_ignorada"
  | "e0_adiada"
  | "e0_reentrada"
  | "lead_nao_localizado"
  | "duplicidade_evitada"
  | "movimentacao_manual"
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
  await supabaseAdmin.from("crm_lead_events").insert(
    sanitizeRawPayload({
      lead_id: leadId,
      type,
      message: message ?? null,
      data: (data ?? null) as never,
    }),
  );
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
  /** Todas as etiquetas da origem — preservadas como informação. */
  tags?: unknown[];
  /** Status técnico informado pela origem (active, bounce, ...). */
  externalStatus?: string | null;
  /** Lead marcado como recadastro/reativação pela origem. */
  remarketing?: boolean;
  /** A coluna atual é a coluna de entrada (NOVOS) do quadro. */
  entryStage?: boolean;
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
  /**
   * MARCAÇÃO TÉCNICA DE TESTE. Só o mecanismo de lotes de teste envia
   * estes campos. Lead real NUNCA recebe marcação — e a marcação nunca
   * depende de nome, telefone, e-mail, coluna, data ou origem.
   */
  isTest?: boolean;
  testBatchId?: string | null;
};

export type UpsertOutcome = {
  lead: CrmLeadRow;
  created: boolean;
  changed: boolean;
  /** Mesma pessoa, novo cadastro na origem — nova oportunidade comercial. */
  newEntry: boolean;
  /** Houve transição de coluna nesta sincronização. */
  stageChanged: boolean;
  /** O lead ENTROU agora na coluna de entrada (NOVOS). */
  enteredEntryStage: boolean;
  /**
   * SEGUNDA TRAVA DE DEDUPLICAÇÃO (telefone): a entrada foi ignorada
   * porque o mesmo telefone já existe sob outro external_id. Nada foi
   * criado, fundido ou apagado — o lead existente foi preservado.
   */
  deduplicated: boolean;
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

  /**
   * §5 — RESILIÊNCIA A CARACTERE INVÁLIDO.
   *
   * O NUL (\u0000) não vem só no payload bruto: nome, origem e etiquetas
   * da origem também já chegaram com ele, e o Postgres rejeita a linha
   * inteira ("unsupported Unicode escape sequence"), derrubando o lead
   * da execução. A limpeza passa a ser aplicada ao registro COMPLETO.
   */
  const base = sanitizeRawPayload({
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
    // Etiquetas e status técnico NUNCA filtram nada — são preservados
    // integralmente como informação do lead.
    tags: (input.tags ?? []) as never,
    external_status: input.externalStatus ?? null,
    remarketing: Boolean(input.remarketing),
  });


  if (!existing) {
    /**
     * SEGUNDA TRAVA DE DEDUPLICAÇÃO (plano aprovado, item 2): antes de
     * criar, compara o telefone normalizado. Encontrando o MESMO
     * telefone sob OUTRO external_id, nada é criado, fundido ou apagado
     * — o lead existente é preservado e a duplicidade é auditada uma
     * única vez por par de IDs (sem spam de eventos a cada ciclo).
     *
     * GUARDA CRÍTICA: telefone vazio/inválido NUNCA deduplica — dois
     * leads sem telefone não podem ser tratados como a mesma pessoa.
     */
    const phoneKey = normalizePhone(input.phone);
    if (phoneKey) {
      const { data: phoneMatch } = await supabaseAdmin
        .from("crm_leads")
        .select(SELECT)
        .eq("external_source", "greensales")
        .eq("phone", phoneKey)
        .neq("external_id", input.externalId)
        .limit(1)
        .maybeSingle();
      if (phoneMatch) {
        const clash = phoneMatch as unknown as CrmLeadRow;
        const { data: prior } = await supabaseAdmin
          .from("crm_lead_events")
          .select("id")
          .eq("lead_id", clash.id)
          .eq("type", "duplicidade_evitada")
          .filter("data->>duplicateExternalId", "eq", input.externalId)
          .limit(1);
        if (!prior || prior.length === 0) {
          await recordEvent(
            clash.id,
            "duplicidade_evitada",
            `Entrada ${input.externalId} ignorada pela trava de telefone: este lead já existe como ${clash.external_id}. Nenhum registro foi criado, fundido ou apagado.`,
            { duplicateExternalId: input.externalId, phone: phoneKey },
          );
        }
        return {
          lead: clash,
          created: false,
          changed: false,
          newEntry: false,
          stageChanged: false,
          enteredEntryStage: false,
          deduplicated: true,
        };
      }
    }

    /**
     * DATAS REAIS NA RECUPERAÇÃO HISTÓRICA: um lead descoberto agora
     * entrou na etapa dele na ORIGEM, não hoje. Usar "agora" faria um
     * histórico parecer lead novo (elegível a cadência e à fila de
     * ligações) — o que as regras 3 e 5 proíbem.
     */
    const realEntryAt = input.lastEntryAt ?? input.externalCreatedAt ?? now;
    const { data, error } = await supabaseAdmin
      .from("crm_leads")
      .insert({
        external_source: "greensales",
        external_id: input.externalId,
        ingested_at: now,
        last_entry_at: input.lastEntryAt ?? input.externalCreatedAt ?? now,
        // Data de entrada na etapa atual — referência da fila de ligações.
        stage_entered_at: input.historical ? realEntryAt : now,
        entered_entry_stage_at: input.entryStage
          ? input.historical
            ? realEntryAt
            : now
          : null,
        entry_count: 1,
        // PENDING representa uma operação real de envio aguardando
        // processamento — nunca "nunca recebeu mensagem".
        welcome_status: input.historical ? "NOT_APPLICABLE" : "PENDING",
        is_test: Boolean(input.isTest),
        test_batch_id: input.testBatchId ?? null,
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
    return {
      lead,
      created: true,
      changed: true,
      newEntry: false,
      stageChanged: true,
      enteredEntryStage: Boolean(input.entryStage),
      deduplicated: false,
    };
  }

  const previous = existing as unknown as CrmLeadRow;
  const newEntry = isNewCommercialEntry(previous.last_entry_at, input.lastEntryAt);
  // Ausência de relação de funil na origem NÃO é movimentação: apagar uma
  // marcação auxiliar jamais tira o lead da coluna em que ele está.
  const stageKey = input.stageKey ?? previous.stage_key;
  const externalStageId = input.stageKey ? input.externalStageId : previous.external_stage_id;
  const stageChanged = previous.stage_key !== stageKey;
  const previousEnteredEntry = (previous as unknown as { entered_entry_stage_at?: string | null })
    .entered_entry_stage_at ?? null;
  // Entrou AGORA em NOVOS: só conta a transição real de coluna.
  const enteredEntryStage = Boolean(input.entryStage) && stageChanged;

  /**
   * PRECEDÊNCIA DA EDIÇÃO MANUAL.
   *
   * O que o Executivo corrigiu à mão no Portal vale mais do que o dado
   * da origem. Os campos marcados em `manual_overrides` são removidos
   * do pacote de atualização: a sincronização continua acontecendo,
   * apenas deixa de sobrescrever a correção humana. É reversível —
   * basta remover a marca do campo.
   */
  const overrides = ((previous as unknown as { manual_overrides?: Record<string, unknown> })
    .manual_overrides ?? {}) as Record<string, unknown>;
  const protectedFields = Object.keys(overrides).filter((key) => overrides[key]);
  for (const field of protectedFields) {
    if (field in base) delete (base as Record<string, unknown>)[field];
  }
  const effectiveName = protectedFields.includes("name") ? previous.name : input.name;
  const effectivePhone = protectedFields.includes("phone") ? previous.phone : input.phone;

  const changed =
    stageChanged ||
    newEntry ||
    previous.name !== effectiveName ||
    previous.phone !== effectivePhone ||
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
      // Registro explícito de quando o lead entrou na coluna NOVOS —
      // é essa data que decide a elegibilidade da cadência.
      entered_entry_stage_at: enteredEntryStage ? now : previousEnteredEntry,
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
  }
  /**
   * HIGIENE DO HISTÓRICO: sincronização SEM alteração não é uma ação e
   * não gera evento. O estado técnico (`last_synced_at`, `sync_status`)
   * já foi atualizado acima. Os eventos antigos permanecem intactos.
   */

  return { lead, created: false, changed, newEntry, stageChanged, enteredEntryStage, deduplicated: false };
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
