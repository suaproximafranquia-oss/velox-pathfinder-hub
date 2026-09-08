/**
 * BIBLIOTECA DE MENSAGENS — FONTE OFICIAL VERSIONADA (SERVER ONLY).
 *
 * ÚNICA FONTE OPERACIONAL de texto do motor: a tabela
 * `relationship_message_library`. Word, Git, constantes do código e IA
 * NÃO são fontes de mensagem — apenas referência histórica.
 *
 * IDENTIDADE OPERACIONAL ATUAL (Financeira /f): E0–E8, R1–R4, RE0–RE3
 * (régua V2) + RESPOSTA_AUTOMATICA. Vem de `operational-steps.ts`.
 * Chaves históricas (E12, E20, E27, FINALIZACAO, RF0/RF1, V3/V4,
 * E0_V1, TESTE…) continuam gravadas e legíveis para auditoria, mas não
 * são identidade de nenhuma etapa atual e não recebem semente nova.
 *
 * REGRAS FECHADAS:
 *  • Uma única versão ativa por COMBINAÇÃO etapa + contexto (índice
 *    único no banco). E7/E8 têm dois contextos independentes
 *    (SEM_CONTATO, MATERIAL_ENVIADO); as demais etapas, contexto único.
 *  • Editar NÃO altera a versão publicada: cria a versão seguinte e
 *    desativa a anterior, que permanece no histórico.
 *  • Slot sem texto nasce VAZIO e INATIVO. O motor bloqueia o envio com
 *    motivo legível — nenhuma mensagem é inventada, copiada ou
 *    reaproveitada de outro contexto/etapa (sem fallback).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isKnownStep, unknownStepReason } from "@/lib/relationship/step-registry";
import {
  renderMessageSpec,
  type MessageSpec,
  type RenderInput,
  type RenderResult,
} from "@/lib/relationship/messages";
import { resolveTreatment } from "@/lib/relationship/names";
import { DEFAULT_STEP_LABELS, stepDisplayLabel } from "@/lib/relationship/step-labels";
import {
  AUTO_REPLY_STEP_KEY,
  OPERATIONAL_STEP_KEYS,
  isContextualStep,
  requiresStepContext,
  isCurrentEditorialStep,
  isHistoricalStep,
  isOperationalStep,
  isValidStepCode,
  parseStepIdentity,
  stepCombinations,
  type StepContext,
} from "@/lib/relationship/operational-steps";

export type LibraryMessage = {
  id: string;
  stepKey: string;
  code: string | null;
  /**
   * Contexto do conteúdo (E7/E8): SEM_CONTATO ou MATERIAL_ENVIADO.
   * Null nas etapas de contexto único.
   */
  stepContext: StepContext | null;
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
   * A etapa existe na CONFIGURAÇÃO OFICIAL do motor. Só etapa oficial é
   * operacional; as demais permanecem apenas como histórico/legado.
   */
  official: boolean;
  /**
   * A chave é identidade ATUAL (régua V2 ou código editorial definido
   * pela Gestão) — e não uma chave histórica. É o que a Biblioteca lista.
   */
  currentIdentity: boolean;
  /**
   * A etapa ainda não pode ser enviada pelo motor: ou não há texto
   * oficial, ou o texto existe mas aguarda ativação pela Gestão.
   */
  awaitingOfficialText: boolean;
};

/**
 * ETAPA PRÓPRIA DA RESPOSTA AUTOMÁTICA (janela de 24h). Enquanto não
 * houver texto publicado, o motor NÃO responde e informa o motivo.
 */
export const AUTO_REPLY_STEP = AUTO_REPLY_STEP_KEY;

/**
 * ETAPAS OFICIAIS DA BIBLIOTECA = IDENTIDADE OPERACIONAL ATUAL.
 *
 * Derivadas da régua V2 (`cadence-v2`) + resposta automática. A
 * Biblioteca NÃO cria etapa: ela guarda mensagem e versionamento das
 * etapas que a operação reconhece. Registros de outras chaves continuam
 * gravados (histórico), mas não são tratados como etapa operacional.
 */
export const OFFICIAL_STEP_KEYS: string[] = [...OPERATIONAL_STEP_KEYS];

export function isOfficialStep(stepKey: string | null | undefined): boolean {
  return isOperationalStep(stepKey);
}

/** Rótulos padrão — apresentação; a chave técnica nunca muda. */
const STEP_LABEL = DEFAULT_STEP_LABELS;

function toMessage(row: Record<string, any>): LibraryMessage {
  return {
    id: row["id"],
    stepKey: row["step_key"] ?? String(row["purpose"] ?? "").toUpperCase(),
    code: row["code"] ?? null,
    stepContext: (row["step_context"] ?? null) as LibraryMessage["stepContext"],
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
    official: isOfficialStep(row["step_key"]),
    currentIdentity: isCurrentEditorialStep(row["step_key"]),
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
 *
 * CONSERVADORA: uma etapa que JÁ tem posição em qualquer versão nunca
 * é reposicionada. A versão nova sem posição apenas herda a posição da
 * etapa. Só uma etapa realmente nova — sem posição em nenhuma versão —
 * recebe um número inédito no fim da lista.
 */
async function assignMissingPositions(): Promise<void> {
  const { data } = await supabaseAdmin
    .from("relationship_message_library")
    .select("step_key, display_position" as any)
    .eq("scope", "production");
  const rows = (data ?? []) as any[];

  /** Posição já existente por etapa (a menor gravada vale). */
  const known = new Map<string, number>();
  for (const row of rows) {
    const step = row.step_key;
    const pos = Number(row.display_position);
    if (!step || !Number.isFinite(pos)) continue;
    const current = known.get(step);
    if (current === undefined || pos < current) known.set(step, pos);
  }

  const missing = [
    ...new Set(
      rows
        .filter((r) => r.display_position === null || r.display_position === undefined)
        .map((r) => r.step_key)
        .filter(Boolean),
    ),
  ].sort();
  if (missing.length === 0) return;

  let next = Math.max(0, ...[...known.values()]) + 10;
  for (const step of missing) {
    const inherited = known.get(step);
    const position = inherited ?? next;
    if (inherited === undefined) {
      known.set(step, position);
      next += 10;
    }
    /* Só as linhas SEM posição são tocadas: nada existente é sobrescrito. */
    await supabaseAdmin
      .from("relationship_message_library")
      .update({ display_position: position } as any)
      .eq("scope", "production")
      .eq("step_key", step)
      .is("display_position", null);
  }
}


/**
 * Semeadura ESTRUTURAL: garante que toda COMBINAÇÃO operacional
 * (etapa + contexto) possua ao menos um slot. O slot nasce VAZIO e
 * INATIVO — nenhum texto é copiado de constantes, Word, Git ou de outra
 * etapa/contexto. Idempotente: só insere o que ainda não existe e nunca
 * apaga nem altera registro antigo. E7/E8 recebem um slot por contexto
 * (SEM_CONTATO e MATERIAL_ENVIADO); as demais, um slot sem contexto.
 */
export async function ensureLibrarySeed(): Promise<void> {
  const { data } = await supabaseAdmin
    .from("relationship_message_library")
    .select("step_key, step_context")
    .eq("scope", "production");
  const known = new Set(
    (data ?? [])
      .filter((r: any) => r.step_key)
      .map((r: any) => `${r.step_key}|${r.step_context ?? ""}`),
  );

  const rows: Record<string, unknown>[] = [];
  for (const step of OFFICIAL_STEP_KEYS) {
    for (const context of stepCombinations(step)) {
      if (known.has(`${step}|${context ?? ""}`)) continue;
      rows.push({
        scope: "production",
        step_key: step,
        step_context: context,
        code: `LIB-${step}`,
        title: STEP_LABEL[step] ?? step,
        purpose: step.toLowerCase(),
        body: "",
        version: 1,
        active: false,
        content_group: null,
        button_kind: null,
        created_by_name: "Motor de Relacionamento",
        notes: context
          ? `Slot estrutural ${step} / ${context} aguardando texto oficial. Nenhuma mensagem é inventada pelo sistema.`
          : "Slot aguardando texto oficial. Nenhuma mensagem é inventada pelo sistema.",
      });
    }
  }

  if (rows.length > 0) {
    await supabaseAdmin.from("relationship_message_library").insert(rows as any);
  }
}

/**
 * Todas as versões de todas as etapas, mais novas primeiro.
 * A ordem entre ETAPAS segue a posição definida pelo usuário.
 */
export async function listLibraryMessages(): Promise<LibraryMessage[]> {
  await ensureLibrarySeed();
  await assignMissingPositions();
  const { data, error } = await supabaseAdmin
    .from("relationship_message_library")
    .select("*")
    .eq("scope", "production")
    .order("display_position" as any, { ascending: true, nullsFirst: false })
    .order("step_key", { ascending: true })
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toMessage);
}

/**
 * PRIMEIRA MENSAGEM DE UMA ETAPA OFICIAL.
 *
 * A Biblioteca NÃO cria etapa. A existência da etapa vem da
 * configuração do motor; aqui apenas nasce o slot de mensagem de uma
 * etapa oficial que ainda não tem registro. Chave fora da configuração
 * é recusada com motivo legível.
 */
export async function createLibraryStep(params: {
  stepKey: string;
  title?: string | null;
  body?: string | null;
  bodyWithoutName?: string | null;
  purpose?: string | null;
  contentGroup?: string | null;
  contentUrl?: string | null;
  contentLabel?: string | null;
  buttonKind?: "portal" | "content" | null;
  notes?: string | null;
  actorId?: string | null;
  actorName: string;
}): Promise<LibraryMessage[]> {
  const stepKey = params.stepKey.trim().toUpperCase();
  if (!isOfficialStep(stepKey)) {
    throw new Error(
      `A etapa ${stepKey} não existe na configuração do motor. A Biblioteca guarda mensagens de etapas oficiais — uma etapa nova nasce na configuração e aparece aqui automaticamente.`,
    );
  }
  await ensureLibrarySeed();
  await assignMissingPositions();


  const { data: existing } = await supabaseAdmin
    .from("relationship_message_library")
    .select("id")
    .eq("scope", "production")
    .eq("step_key", stepKey)
    .limit(1);
  if ((existing ?? []).length > 0) {
    throw new Error(`A etapa ${stepKey} já existe na Biblioteca.`);
  }

  const { data: positions } = await supabaseAdmin
    .from("relationship_message_library")
    .select("display_position" as any)
    .eq("scope", "production");
  const next =
    Math.max(
      0,
      ...((positions ?? []) as any[]).map((r) => Number(r.display_position ?? 0) || 0),
    ) + 10;

  const body = (params.body ?? "").trim();
  const { error } = await supabaseAdmin.from("relationship_message_library").insert({
    scope: "production",
    step_key: stepKey,
    code: `LIB-${stepKey}`,
    title: params.title?.trim() || stepKey,
    purpose: params.purpose?.trim() || stepKey.toLowerCase(),
    body,
    body_without_name: params.bodyWithoutName?.trim() || null,
    version: 1,
    /* Sem texto = slot vazio e inativo: o motor não inventa mensagem. */
    active: body.length > 0,
    content_group: params.contentGroup?.trim() || null,
    content_url: params.contentUrl?.trim() || null,
    content_label: params.contentLabel?.trim() || null,
    button_kind: params.buttonKind ?? null,
    display_position: next,
    created_by: params.actorId ?? null,
    created_by_name: params.actorName,
    notes: params.notes ?? "Primeira mensagem da etapa oficial.",
  } as any);
  if (error) throw new Error(error.message);

  return listLibraryMessages();
}

/**
 * BLOCO 3 — ORDENAÇÃO MANUAL PERSISTENTE.
 *
 * Grava apenas `display_position`. Não toca em texto, versão, histórico,
 * fila, ciclo ou fluxo — e jamais altera o `step_key`.
 */
export async function reorderLibrarySteps(
  orderedStepKeys: string[],
): Promise<LibraryMessage[]> {
  const seen = new Set<string>();
  let position = 10;
  for (const raw of orderedStepKeys) {
    const stepKey = String(raw ?? "").trim().toUpperCase();
    if (!stepKey || seen.has(stepKey)) continue;
    seen.add(stepKey);
    const { error } = await supabaseAdmin
      .from("relationship_message_library")
      .update({ display_position: position } as any)
      .eq("scope", "production")
      .eq("step_key", stepKey);
    if (error) throw new Error(error.message);
    position += 10;
  }
  return listLibraryMessages();
}

/**
 * IDENTIDADE DA ETAPA = CÓDIGO ATUAL = CHAVE TÉCNICA.
 *
 * A Gestão edita um único campo ("E5 — Apresentação Digital"). Ele é
 * separado em CÓDIGO (E5) + TÍTULO (Apresentação Digital):
 *  • código igual ao atual (ou ausente) → só o título muda; a chave não;
 *  • código diferente → a chave técnica ACOMPANHA: todas as versões da
 *    etapa (histórico incluído) passam para o novo código, em uma única
 *    transação (`library_rename_step_key`). Nada é apagado nem reescrito.
 *  • código já usado por outra etapa com mensagem → recusa com aviso;
 *    nada é sobrescrito nem misturado.
 * O código é exatamente o digitado: ER0 não vira E0, R3 não vira E3.
 * E7/E8 mantêm a estrutura de contextos: não trocam de código nem
 * recebem outra etapa nesta construção.
 */
export async function renameLibraryStep(params: {
  stepKey: string;
  label: string;
}): Promise<{ stepKey: string; messages: LibraryMessage[] }> {
  await ensureLibrarySeed();
  const fromKey = params.stepKey.trim().toUpperCase();
  const { code, title: parsedTitle } = parseStepIdentity(params.label);
  const toKey = code && code !== fromKey ? code : fromKey;

  if (toKey !== fromKey) {
    if (!isValidStepCode(toKey)) {
      throw new Error(`Código de etapa inválido: ${toKey}. Use o código editorial da régua (ex.: E5, R3, RE0).`);
    }
    if (isHistoricalStep(toKey)) {
      throw new Error(`${toKey} é uma chave histórica e não pode ser usada como identidade atual.`);
    }
    if (isContextualStep(fromKey) || isContextualStep(toKey)) {
      throw new Error(
        `${isContextualStep(fromKey) ? fromKey : toKey} possui estrutura de contextos próprios e não troca de código nesta operação.`,
      );
    }
  }

  /* Título gravado SEMPRE com o prefixo do código atual, para que rótulo e
     chave técnica nunca divirjam. Vazio devolve o padrão do sistema. */
  const fullTitle = parsedTitle
    ? `${toKey} — ${parsedTitle}`
    : DEFAULT_STEP_LABELS[toKey] || toKey;

  if (toKey !== fromKey) {
    const { error } = await supabaseAdmin.rpc("library_rename_step_key" as any, {
      p_scope: "production",
      p_from: fromKey,
      p_to: toKey,
      p_title: fullTitle,
    } as any);
    if (error) {
      throw new Error(
        error.code === "23505" || /já está sendo utilizado/.test(error.message)
          ? `O código ${toKey} já está sendo utilizado por outra etapa. Escolha outro código — nada foi alterado.`
          : error.message,
      );
    }
    return { stepKey: toKey, messages: await listLibraryMessages() };
  }

  /**
   * SÓ TÍTULO: gravado na versão vigente de cada contexto da etapa (slots
   * sem versão ativa recebem na mais recente). Chave técnica intacta.
   */
  for (const context of stepCombinations(fromKey)) {
    let query = supabaseAdmin
      .from("relationship_message_library")
      .select("id,active,version")
      .eq("scope", "production")
      .eq("step_key", fromKey);
    query = context ? query.eq("step_context", context) : query.is("step_context", null);
    const { data: rows } = await query.order("version", { ascending: false });
    const target =
      (rows ?? []).find((r: any) => r.active) ?? (rows ?? [])[0] ?? null;
    if (!target) continue;
    const { error } = await supabaseAdmin
      .from("relationship_message_library")
      .update({ title: fullTitle } as any)
      .eq("id", (target as any).id);
    if (error) throw new Error(error.message);
  }
  return { stepKey: fromKey, messages: await listLibraryMessages() };
}

/**
 * Versão ATIVA de uma combinação etapa + contexto — a única elegível
 * para novos envios/cópias. SEM FALLBACK: E7/E8 exigem o contexto e
 * nunca reaproveitam texto do outro contexto nem de uma linha sem
 * contexto; etapas de contexto único só leem a linha sem contexto.
 */
export async function getActiveLibraryMessage(
  stepKey: string,
  stepContext?: StepContext | null,
): Promise<LibraryMessage | null> {
  const key = stepKey.trim().toUpperCase();
  const context = stepContext ?? null;
  if (requiresStepContext(key) && !context) return null;

  let query = supabaseAdmin
    .from("relationship_message_library")
    .select("*")
    .eq("scope", "production")
    .eq("step_key", key)
    .eq("active", true);
  query = context ? query.eq("step_context", context) : query.is("step_context", null);
  const { data } = await query.maybeSingle();
  return data ? toMessage(data) : null;
}

/**
 * Publica uma NOVA versão da etapa. A versão anterior é apenas
 * desativada — o conteúdo dela nunca é alterado nem apagado.
 */
export async function publishLibraryVersion(params: {
  stepKey: string;
  /**
   * EIXO DE CONTEXTO (E7/E8). Cada contexto tem versionamento e ativação
   * PRÓPRIOS: publicar em SEM_CONTATO nunca desativa MATERIAL_ENVIADO e
   * nunca empresta texto de um contexto para o outro.
   */
  stepContext?: StepContext | null;
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
  const stepContext = params.stepContext ?? null;
  let historyQuery = supabaseAdmin
    .from("relationship_message_library")
    .select("*")
    .eq("scope", "production")
    .eq("step_key", params.stepKey);
  historyQuery = stepContext
    ? historyQuery.eq("step_context", stepContext)
    : historyQuery.is("step_context", null);
  const { data: history } = await historyQuery.order("version", { ascending: false });
  const rows = history ?? [];
  const current = rows.find((r: any) => r.active) ?? rows[0] ?? null;
  const nextVersion = (rows[0] as any)?.version ? Number((rows[0] as any).version) + 1 : 1;

  /**
   * POSIÇÃO PERTENCE À ETAPA, NÃO À VERSÃO. A versão nova herda a
   * posição já existente da etapa — publicar jamais move o cartão para
   * o fim da lista.
   */
  const inheritedPosition =
    rows
      .map((r: any) => Number(r.display_position))
      .filter((n: number) => Number.isFinite(n))
      .sort((a: number, b: number) => a - b)[0] ?? null;

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
      step_context: stepContext,
      code: (current as any)?.code ?? `LIB-${params.stepKey}`,
      title: params.title ?? (current as any)?.title ?? params.stepKey,
      purpose: (current as any)?.purpose ?? params.stepKey.toLowerCase(),
      body: params.body,
      body_without_name: params.bodyWithoutName ?? null,
      version: nextVersion,
      display_position: inheritedPosition,
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
  stepContext?: StepContext | null,
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

  /**
   * Contexto OBRIGATÓRIO (E7/E8 e R3): sem contexto não existe texto
   * elegível — e nunca há aproveitamento do texto de outro contexto.
   * E1/E2/E3 continuam com contexto normal (linha sem contexto) quando
   * o motor não abriu o caminho V.
   */
  if (requiresStepContext(stepKey) && !stepContext) {
    return {
      result: {
        ok: false,
        reason: `Etapa ${stepKey} exige contexto e nenhum foi informado. Nada foi enviado.`,
      },
      message: null,
    };
  }

  const message = await getActiveLibraryMessage(stepKey, stepContext ?? null);
  if (!message || !message.body.trim()) {
    return {
      result: {
        ok: false,
        reason: stepContext
          ? `Sem mensagem oficial cadastrada para esta etapa e contexto (${stepKey} / ${stepContext}). Nada foi enviado.`
          : `Sem mensagem oficial ativa cadastrada para a etapa ${stepKey}. Nada foi enviado.`,
      },
      message,
    };
  }

  /**
   * CENTRAL DOS NOMES: a base oficial já existente é consultada aqui,
   * antes de qualquer renderização, e devolve SOMENTE o primeiro nome.
   */
  const { resolveCentralFirstName } = await import(
    "@/server/relationship/name-central-lookup.server"
  );
  const centralFirstName = input.nameRejected
    ? null
    : await resolveCentralFirstName(input.rawInvestorName ?? null);
  const renderInput: RenderInput = { ...input, centralFirstName };

  const treatment = resolveTreatment({
    confirmedName: input.confirmedInvestorName ?? null,
    executiveProvidedName: input.executiveProvidedName ?? null,
    rawName: input.rawInvestorName ?? null,
    manuallyRejected: input.nameRejected ?? false,
    centralFirstName,
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
  return { result: renderMessageSpec(spec, renderInput), message };
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

/**
 * CONTEÚDO OFICIAL DO RF (relacionamento esfriado).
 *
 * RF0 e RF1 nascem com texto oficial — não são slots vazios. As quatro
 * combinações exigidas existem: cada etapa tem a redação COM NOME
 * (`body`) e SEM NOME (`body_without_name`), exatamente como as demais
 * etapas da Biblioteca.
 *
 * A identidade técnica (RF0 / RF1) é estável: editar o texto no futuro
 * publica uma nova VERSÃO, sem trocar a chave da etapa e sem alterar
 * nenhum conteúdo histórico.
 */
const COLD_LIBRARY_CONTENT: Record<
  string,
  {
    purpose: string;
    title: string;
    body: string;
    bodyWithoutName: string;
    contentGroup: string | null;
    buttonKind: "portal" | "content" | null;
  }
> = {
  RF0: {
    purpose: "relacionamento_frio_retomada",
    title: "RF0 — Relacionamento esfriado: retomada",
    contentGroup: null,
    buttonKind: null,
    body: `Olá, {{nome_investidor}}, tudo bem?

Nós tínhamos combinado um horário para conversarmos, mas acabou que não conseguimos evoluir com este bate-papo.

Eu entendo que a correria do dia a dia muitas vezes atrapalha e está tudo bem.

Quando fizer sentido para você, me envie duas opções de horário que funcionem melhor e eu organizo um novo horário para conversarmos.

Fico à disposição.`,
    bodyWithoutName: `Olá, tudo bem?

Nós tínhamos combinado um horário para conversarmos, mas acabou que não conseguimos evoluir com este bate-papo.

Eu entendo que a correria do dia a dia muitas vezes atrapalha e está tudo bem.

Quando fizer sentido para você, me envie duas opções de horário que funcionem melhor e eu organizo um novo horário para conversarmos.

Fico à disposição.`,
  },
  RF1: {
    purpose: "relacionamento_frio_encerramento",
    title: "RF1 — Relacionamento esfriado: encerramento",
    contentGroup: "FINALIZACAO",
    buttonKind: "content",
    body: `Olá, {{nome_investidor}}.

Como não conseguimos retomar nossa conversa, não quero ser insistente e vou encerrar minhas tentativas de contato por aqui.

Antes de encerrar, quero deixar com você uma última reflexão que acredito que faça sentido neste momento.

Afinal, você prefere continuar acompanhando a história de quem está crescendo ou começar a construir a sua própria história?`,
    bodyWithoutName: `Olá, tudo bem?

Como não conseguimos retomar nossa conversa, não quero ser insistente e vou encerrar minhas tentativas de contato por aqui.

Antes de encerrar, quero deixar com você uma última reflexão que acredito que faça sentido neste momento.

Afinal, você prefere continuar acompanhando a história de quem está crescendo ou começar a construir a sua própria história?`,
  },
};

/**
 * Garante o conteúdo oficial de RF0/RF1. Idempotente: se já existe
 * versão ATIVA com texto, nada é publicado e nenhum texto editado pela
 * Gestão é sobrescrito.
 */
export async function ensureColdRelationshipLibrary(): Promise<void> {
  for (const [stepKey, spec] of Object.entries(COLD_LIBRARY_CONTENT)) {
    const active = await getActiveLibraryMessage(stepKey, null);
    if (active && (active.body ?? "").trim().length > 0) continue;
    const published = await publishLibraryVersion({
      stepKey,
      body: spec.body,
      bodyWithoutName: spec.bodyWithoutName,
      title: spec.title,
      contentGroup: spec.contentGroup,
      buttonKind: spec.buttonKind,
      notes: "Conteúdo oficial inicial do relacionamento esfriado (RF).",
      actorName: "Motor de Relacionamento",
      sourceKind: "motor",
      sourceReference: "RF",
    });
    /* A finalidade oficial do RF não é derivada da chave da etapa. */
    await supabaseAdmin
      .from("relationship_message_library")
      .update({ purpose: spec.purpose } as any)
      .eq("id", published.id);
  }
}
