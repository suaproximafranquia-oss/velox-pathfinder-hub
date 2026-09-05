/**
 * BIBLIOTECA DE MENSAGENS — FONTE OFICIAL VERSIONADA (SERVER ONLY).
 *
 * BLOCO 2 do Motor de Relacionamento. A partir daqui o texto de cada
 * etapa (E0, E1, E3, E12, E20, RE0…) deixa de depender de constantes
 * espalhadas pelo código e passa a viver na tabela
 * `relationship_message_library`, que JÁ existia — nada de segunda
 * biblioteca paralela.
 *
 * REGRAS FECHADAS:
 *  • Uma única versão ativa por etapa (índice único no banco).
 *  • Editar NÃO altera a versão publicada: cria a versão seguinte e
 *    desativa a anterior, que permanece no histórico.
 *  • O texto fixo do projeto (`HOMOLOGATION_MESSAGES`) é usado apenas
 *    UMA vez, como semente da versão 1. Depois disso a Biblioteca manda.
 *  • Etapas sem texto oficial aprovado (E20, E27, FINALIZAÇÃO) nascem
 *    como slot VAZIO e INATIVO: o motor bloqueia o envio com motivo
 *    legível em vez de inventar mensagem.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isKnownStep, unknownStepReason } from "@/lib/relationship/step-registry";
import {
  HOMOLOGATION_MESSAGES,
  renderMessageSpec,
  type MessageSpec,
  type RenderInput,
  type RenderResult,
} from "@/lib/relationship/messages";
import { resolveTreatment } from "@/lib/relationship/names";
import { DEFAULT_STEP_LABELS, stepDisplayLabel } from "@/lib/relationship/step-labels";

export type LibraryMessage = {
  id: string;
  stepKey: string;
  code: string | null;
  title: string;
  /** Rótulo visível da etapa. Apresentação — nunca a chave técnica. */
  displayLabel: string;
  purpose: string;
  body: string;
  /** Versão oficial SEM nome (Word). Null quando a etapa não tem variante. */
  bodyWithoutName: string | null;
  version: number;
  active: boolean;
  contentGroup: string | null;
  /** Link do conteúdo — pertence a ESTA versão da mensagem. */
  contentUrl: string | null;
  /** Rótulo visível do link desta versão. */
  contentLabel: string | null;
  buttonKind: "portal" | "content" | null;

  usesInvestorName: boolean;
  createdAt: string;
  createdByName: string;
  notes: string | null;
  /** Procedência do conteúdo: "word" quando veio do documento oficial. */
  sourceKind: string | null;
  sourceReference: string | null;
  /** Posição VISUAL na Biblioteca (Bloco 3). Não é ordem do motor. */
  displayPosition: number | null;
  /**
   * A etapa ainda não pode ser enviada pelo motor: ou não há texto
   * oficial, ou o texto existe mas aguarda ativação pela Gestão.
   */
  awaitingOfficialText: boolean;
};

/**
 * ETAPA PRÓPRIA DA RESPOSTA AUTOMÁTICA.
 *
 * A orientação automática dentro da janela de 24h deixou de tomar
 * emprestado o texto de uma etapa de cadência (R1): ela tem entrada
 * própria na Biblioteca. Enquanto não houver texto oficial publicado,
 * o motor NÃO responde e informa o motivo — nenhum texto é inventado.
 */
export const AUTO_REPLY_STEP = "RESPOSTA_AUTOMATICA";

/**
 * Etapas SEM texto oficial. O Word da Jornada do Investidor NÃO contém
 * E27 nem a resposta automática — a ausência é intencional e é
 * preservada: elas continuam como slot vazio e inativo, e o motor
 * bloqueia o envio com motivo legível em vez de inventar mensagem.
 */
export const PENDING_TEXT_STEPS = ["E27", AUTO_REPLY_STEP] as const;

/**
 * Etapas oficiais do Word, já traduzidas para a CHAVE TÉCNICA do motor,
 * na ordem em que o documento as apresenta. O nome editorial do Word
 * (E2, E5, E6, E7) vive no rótulo; a chave é a do motor.
 */
export const WORD_STEP_ORDER: string[] = [
  "E0",
  "E1",
  "E3",
  "E4",
  "E12",
  "E20",
  "FINALIZACAO",
  "R1",
  "R2",
  "R3",
  "RE0",
  "RE1",
  "RE2",
  "RE3",
  "RF0",
  "RF1",
];

/**
 * Etapas que existiam antes e permanecem no banco por causa do
 * HISTÓRICO (envios, filas e snapshots já gravados). Elas não fazem
 * parte da nomenclatura oficial e não recebem conteúdo novo.
 */
export const LEGACY_STEPS: string[] = ["E0_V1", "V3", "V4"];

/** Chaves antigas mantidas apenas por histórico; não são executáveis. */
export const WORD_ALIAS_STEPS: string[] = ["E2", "E5", "E6", "E7"];

export const LIBRARY_STEP_ORDER: string[] = [
  ...WORD_STEP_ORDER,
  ...LEGACY_STEPS,
  ...PENDING_TEXT_STEPS,
];

/**
 * Rótulos padrão. A chave técnica (E20, E27…) permanece intocada no
 * banco, na fila e nos snapshots — isto é apresentação. A Gestão pode
 * sobrescrever o rótulo pela Biblioteca sem gerar versão nova de texto.
 */
const STEP_LABEL = DEFAULT_STEP_LABELS;

function toMessage(row: Record<string, any>): LibraryMessage {
  return {
    id: row["id"],
    stepKey: row["step_key"] ?? String(row["purpose"] ?? "").toUpperCase(),
    code: row["code"] ?? null,
    title: row["title"],
    displayLabel: stepDisplayLabel(
      row["step_key"] ?? String(row["purpose"] ?? "").toUpperCase(),
      row["title"],
    ),
    purpose: row["purpose"],
    body: row["body"] ?? "",
    bodyWithoutName: row["body_without_name"] ?? null,
    version: row["version"] ?? 1,
    active: Boolean(row["active"]),
    contentGroup: row["content_group"] ?? null,
    contentUrl: row["content_url"] ?? null,
    contentLabel: row["content_label"] ?? null,
    buttonKind: (row["button_kind"] ?? null) as LibraryMessage["buttonKind"],
    usesInvestorName: String(row["body"] ?? "").includes("{{nome_investidor}}"),
    createdAt: row["created_at"],
    createdByName: row["created_by_name"] ?? "sistema",
    notes: row["notes"] ?? null,
    sourceKind: row["source_kind"] ?? null,
    sourceReference: row["source_reference"] ?? null,
    displayPosition:
      row["display_position"] === null || row["display_position"] === undefined
        ? null
        : Number(row["display_position"]),
    awaitingOfficialText:
      !row["active"] || String(row["body"] ?? "").trim().length === 0,
  };
}

/**
 * BLOCO 3 — POSIÇÃO VISUAL DA BIBLIOTECA.
 *
 * `display_position` é ordenação de VITRINE. Não é ordem de execução:
 * fluxo, prazo e sequência do motor continuam em `STEPS`/`FLOW_SEQUENCE`.
 * A posição é atributo da ETAPA (step_key), por isso todas as versões
 * da mesma etapa carregam o mesmo número.
 */
async function assignMissingPositions(): Promise<void> {
  const { data } = await supabaseAdmin
    .from("relationship_message_library")
    .select("step_key, display_position" as any)
    .eq("scope", "production");
  const rows = (data ?? []) as any[];
  const missing = [
    ...new Set(
      rows
        .filter((r) => r.display_position === null || r.display_position === undefined)
        .map((r) => r.step_key)
        .filter(Boolean),
    ),
  ].sort();
  if (missing.length === 0) return;
  let next =
    Math.max(0, ...rows.map((r) => Number(r.display_position ?? 0) || 0)) + 10;
  for (const step of missing) {
    await supabaseAdmin
      .from("relationship_message_library")
      .update({ display_position: next } as any)
      .eq("scope", "production")
      .eq("step_key", step);
    next += 10;
  }
}

/**
 * Semeadura única: garante que cada etapa possua ao menos a versão 1.
 * Idempotente — só insere o que ainda não existe.
 */
export async function ensureLibrarySeed(): Promise<void> {
  const { data } = await supabaseAdmin
    .from("relationship_message_library")
    .select("step_key")
    .eq("scope", "production");
  const known = new Set((data ?? []).map((r: any) => r.step_key).filter(Boolean));

  const rows: Record<string, unknown>[] = [];
  for (const step of LIBRARY_STEP_ORDER) {
    if (known.has(step)) continue;
    const fixed = (HOMOLOGATION_MESSAGES as Record<string, any>)[step];
    if (fixed) {
      rows.push({
        scope: "production",
        step_key: step,
        code: fixed.code,
        title: `${step} — ${String(fixed.purpose).replaceAll("_", " ")}`,
        purpose: fixed.purpose,
        body: fixed.text,
        version: 1,
        active: true,
        content_group: fixed.contentGroup,
        button_kind: fixed.button,
        created_by_name: "Motor de Relacionamento",
        notes: "Versão 1 importada do texto oficial já validado no projeto.",
      });
    } else {
      rows.push({
        scope: "production",
        step_key: step,
        code: `LIB-${step}`,
        title: STEP_LABEL[step] ?? step,
        purpose: step.toLowerCase(),
        body: "",
        version: 1,
        active: false,
        content_group: step === "FINALIZACAO" ? "FINALIZACAO" : null,
        button_kind: step === "E20" ? "portal" : null,
        created_by_name: "Motor de Relacionamento",
        notes:
          "Slot aguardando texto oficial. Nenhuma mensagem é inventada pelo sistema.",
      });
    }
  }

  if (rows.length > 0) {
    await supabaseAdmin.from("relationship_message_library").insert(rows as any);
  }
}

/** Todas as versões de todas as etapas, mais novas primeiro. */
export async function listLibraryMessages(): Promise<LibraryMessage[]> {
  await ensureLibrarySeed();
  const { data, error } = await supabaseAdmin
    .from("relationship_message_library")
    .select("*")
    .eq("scope", "production")
    .order("step_key", { ascending: true })
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMessage);
}

/**
 * RENOMEIA APENAS O RÓTULO VISÍVEL da etapa.
 *
 * Não cria versão, não altera texto, não toca em fila, snapshot ou
 * histórico: grava o título da versão ativa. A chave técnica é imutável.
 * Rótulo vazio devolve a etapa ao padrão do sistema.
 */
export async function renameLibraryStep(params: {
  stepKey: string;
  label: string;
}): Promise<LibraryMessage[]> {
  await ensureLibrarySeed();
  const label = params.label.trim();
  const title = label || DEFAULT_STEP_LABELS[params.stepKey] || params.stepKey;

  /**
   * Etapas AGUARDANDO TEXTO OFICIAL (E27, resposta automática, E20 e
   * finalização antes da ativação) não têm versão ativa. O rótulo delas
   * também precisa ser editável, então a gravação recai sobre a versão
   * mais recente quando não existe versão ativa.
   */
  const { data: rows } = await supabaseAdmin
    .from("relationship_message_library")
    .select("id,active,version")
    .eq("scope", "production")
    .eq("step_key", params.stepKey)
    .order("version", { ascending: false });
  const target =
    (rows ?? []).find((r: any) => r.active) ?? (rows ?? [])[0] ?? null;
  if (!target) return listLibraryMessages();

  const { error } = await supabaseAdmin
    .from("relationship_message_library")
    .update({ title } as any)
    .eq("id", (target as any).id);
  if (error) throw new Error(error.message);
  return listLibraryMessages();
}

/** Versão ATIVA de uma etapa (a única elegível para novos envios). */
export async function getActiveLibraryMessage(
  stepKey: string,
): Promise<LibraryMessage | null> {
  const { data } = await supabaseAdmin
    .from("relationship_message_library")
    .select("*")
    .eq("scope", "production")
    .eq("step_key", stepKey)
    .eq("active", true)
    .maybeSingle();
  if (data) return toMessage(data);
  await ensureLibrarySeed();
  const { data: seeded } = await supabaseAdmin
    .from("relationship_message_library")
    .select("*")
    .eq("scope", "production")
    .eq("step_key", stepKey)
    .eq("active", true)
    .maybeSingle();
  return seeded ? toMessage(seeded) : null;
}

/**
 * Publica uma NOVA versão da etapa. A versão anterior é apenas
 * desativada — o conteúdo dela nunca é alterado nem apagado.
 */
export async function publishLibraryVersion(params: {
  stepKey: string;
  body: string;
  bodyWithoutName?: string | null;
  title?: string | null;
  contentGroup?: string | null;
  contentUrl?: string | null;
  contentLabel?: string | null;
  buttonKind?: "portal" | "content" | null;
  notes?: string | null;
  actorId?: string | null;
  actorName: string;
  sourceKind?: string | null;
  sourceReference?: string | null;
}): Promise<LibraryMessage> {
  await ensureLibrarySeed();
  const { data: history } = await supabaseAdmin
    .from("relationship_message_library")
    .select("*")
    .eq("scope", "production")
    .eq("step_key", params.stepKey)
    .order("version", { ascending: false });
  const rows = history ?? [];
  const current = rows.find((r: any) => r.active) ?? rows[0] ?? null;
  const nextVersion = (rows[0] as any)?.version ? Number((rows[0] as any).version) + 1 : 1;

  if (current) {
    await supabaseAdmin
      .from("relationship_message_library")
      .update({ active: false } as any)
      .eq("id", (current as any).id);
  }

  const { data, error } = await supabaseAdmin
    .from("relationship_message_library")
    .insert({
      scope: "production",
      step_key: params.stepKey,
      code: (current as any)?.code ?? `LIB-${params.stepKey}`,
      title: params.title ?? (current as any)?.title ?? params.stepKey,
      purpose: (current as any)?.purpose ?? params.stepKey.toLowerCase(),
      body: params.body,
      body_without_name: params.bodyWithoutName ?? null,
      version: nextVersion,
      active: params.body.trim().length > 0,
      content_group:
        params.contentGroup !== undefined
          ? params.contentGroup
          : ((current as any)?.content_group ?? null),
      content_url:
        params.contentUrl !== undefined
          ? (params.contentUrl?.trim() || null)
          : ((current as any)?.content_url ?? null),
      content_label:
        params.contentLabel !== undefined
          ? (params.contentLabel?.trim() || null)
          : ((current as any)?.content_label ?? null),
      button_kind:
        params.buttonKind !== undefined
          ? params.buttonKind
          : ((current as any)?.button_kind ?? null),
      supersedes_id: (current as any)?.id ?? null,
      created_by: params.actorId ?? null,
      created_by_name: params.actorName,
      notes: params.notes ?? null,
      source_kind: params.sourceKind ?? null,
      source_reference: params.sourceReference ?? null,
      ...(params.sourceKind
        ? { imported_at: new Date().toISOString(), import_version: nextVersion }
        : {}),
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toMessage(data);
}

/**
 * Renderiza a etapa a partir da versão ATIVA da Biblioteca.
 *
 * O Word oficial traz DUAS redações por etapa: "com nome" e "sem nome".
 * Elas não são a mesma frase com uma substituição — são textos próprios.
 * Por isso a escolha acontece aqui, antes da renderização: nome validado
 * usa a versão com nome; qualquer outro caso usa a versão sem nome.
 */
export async function renderFromLibrary(
  stepKey: string,
  input: RenderInput,
): Promise<{ result: RenderResult; message: LibraryMessage | null }> {
  /**
   * ETAPA DESCONHECIDA NÃO RENDERIZA. Nenhum texto é montado para uma
   * chave que o motor não reconhece — o erro aparece explícito.
   */
  const { ensureKnownSteps } = await import("@/server/relationship/step-registry.server");
  await ensureKnownSteps();
  if (!isKnownStep(stepKey)) {
    return { result: { ok: false, reason: unknownStepReason(stepKey) }, message: null };
  }

  const message = await getActiveLibraryMessage(stepKey);
  if (!message || !message.body.trim()) {
    return {
      result: {
        ok: false,
        reason: `Etapa ${stepKey} sem versão ativa na Biblioteca de Mensagens — envio bloqueado.`,
      },
      message,
    };
  }

  const treatment = resolveTreatment({
    confirmedName: input.confirmedInvestorName ?? null,
    executiveProvidedName: input.executiveProvidedName ?? null,
    rawName: input.rawInvestorName ?? null,
    manuallyRejected: input.nameRejected ?? false,
  });
  const useWithoutName =
    !treatment.personalized && Boolean(message.bodyWithoutName?.trim());
  const text = useWithoutName ? message.bodyWithoutName!.trim() : message.body;

  const spec: MessageSpec = {
    step: stepKey,
    text,
    usesInvestorName: text.includes("{{nome_investidor}}"),
    button: message.buttonKind,
    contentGroup: message.contentGroup,
    contentUrl: message.contentUrl,
    contentLabel: message.contentLabel,
  };
  return { result: renderMessageSpec(spec, input), message };
}


/**
 * SNAPSHOT IMUTÁVEL DO ENVIO.
 *
 * Congela, no instante do envio, tudo que é necessário para reconstruir
 * o histórico SEM voltar à Biblioteca: texto original, texto renderizado,
 * versão, etapa, lead, responsável e origem. Uma edição futura da
 * mensagem nunca reescreve o passado.
 */
export async function recordMessageSnapshot(params: {
  leadId: string;
  step: string;
  purpose?: string | null;
  renderedBody: string;
  templateBody: string;
  libraryId?: string | null;
  libraryVersion?: number | null;
  libraryCode?: string | null;
  investorNameUsed?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  origin: "motor" | "executivo" | "remarketing" | "portal";
  instanceSeq?: number;
  cadenceId?: string | null;
  occurrenceId?: string | null;
  messageId?: string | null;
  contentId?: string | null;
  contentUrl?: string | null;
  metaTemplateName?: string | null;
  channel?: string;
  simulated?: boolean;
  sentAt?: string;
  /**
   * CONGELAMENTO DOS DESTINOS (E0 dinâmica). O responsável e os links
   * usados no envio ficam gravados aqui: uma redistribuição futura do
   * lead não pode reescrever o que já foi entregue.
   */
  executiveId?: string | null;
  executiveName?: string | null;
  portalDestination?: string | null;
  contactDestination?: string | null;
  contactPhone?: string | null;
  buttonDestinations?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("relationship_message_sends").insert({
    scope: "production",
    lead_id: params.leadId,
    step: params.step,
    purpose: params.purpose ?? params.step.toLowerCase(),
    rendered_body: params.renderedBody,
    template_body: params.templateBody,
    library_id: params.libraryId ?? null,
    library_version: params.libraryVersion ?? null,
    library_code: params.libraryCode ?? null,
    investor_name_used: params.investorNameUsed ?? null,
    actor_id: params.actorId ?? null,
    actor_name: params.actorName ?? null,
    origin: params.origin,
    instance_seq: params.instanceSeq ?? 1,
    cadence_id: params.cadenceId ?? null,
    occurrence_id: params.occurrenceId ?? null,
    message_id: params.messageId ?? null,
    content_id: params.contentId ?? null,
    content_url: params.contentUrl ?? null,
    meta_template_name: params.metaTemplateName ?? null,
    channel: params.channel ?? "whatsapp",
    simulated: params.simulated ?? false,
    sent_at: params.sentAt ?? new Date().toISOString(),
    executive_id: params.executiveId ?? null,
    executive_name: params.executiveName ?? null,
    portal_destination: params.portalDestination ?? null,
    contact_destination: params.contactDestination ?? null,
    contact_phone: params.contactPhone ?? null,
    button_destinations: (params.buttonDestinations ?? null) as any,
  } as any);
  // Duplicidade (mesmo message_id) não é erro: o snapshot já existe.
  if (error && error.code !== "23505") throw new Error(error.message);
}

/** Snapshots de um lead — SEMPRE a leitura oficial do histórico. */
export async function listMessageSnapshots(leadId: string) {
  const { data } = await supabaseAdmin
    .from("relationship_message_sends")
    .select("*")
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: true });
  return data ?? [];
}
