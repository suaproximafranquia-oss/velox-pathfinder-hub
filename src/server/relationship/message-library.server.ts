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
import {
  HOMOLOGATION_MESSAGES,
  renderMessageSpec,
  type MessageSpec,
  type RenderInput,
  type RenderResult,
} from "@/lib/relationship/messages";
import { resolveTreatment } from "@/lib/relationship/names";
import {
  WORD_MESSAGES,
  WORD_SOURCE_REFERENCE,
  type WordMessage,
} from "@/lib/relationship/word-library";

export type LibraryMessage = {
  id: string;
  stepKey: string;
  code: string | null;
  title: string;
  purpose: string;
  body: string;
  version: number;
  active: boolean;
  contentGroup: string | null;
  buttonKind: "portal" | "content" | null;
  usesInvestorName: boolean;
  createdAt: string;
  createdByName: string;
  notes: string | null;
};

/** Etapas sem texto oficial: entram como slot vazio, nunca inventado. */
export const PENDING_TEXT_STEPS = ["E20", "E27", "FINALIZACAO"] as const;

export const LIBRARY_STEP_ORDER: string[] = [
  "E0",
  "E0_V1",
  "E1",
  "E3",
  "E4",
  "E12",
  "V3",
  "V4",
  "R1",
  "R2",
  "R3",
  "RE0",
  "RE1",
  "RE2",
  "RE3",
  "RF0",
  "RF1",
  ...PENDING_TEXT_STEPS,
];

const STEP_LABEL: Record<string, string> = {
  E20: "E20 — Convite ao Portal do Investidor",
  E27: "E27 — Checkpoint do convite (7 dias)",
  FINALIZACAO: "FINALIZAÇÃO — Encerramento do ciclo",
};

function toMessage(row: Record<string, any>): LibraryMessage {
  return {
    id: row["id"],
    stepKey: row["step_key"] ?? String(row["purpose"] ?? "").toUpperCase(),
    code: row["code"] ?? null,
    title: row["title"],
    purpose: row["purpose"],
    body: row["body"] ?? "",
    version: row["version"] ?? 1,
    active: Boolean(row["active"]),
    contentGroup: row["content_group"] ?? null,
    buttonKind: (row["button_kind"] ?? null) as LibraryMessage["buttonKind"],
    usesInvestorName: String(row["body"] ?? "").includes("{{nome_investidor}}"),
    createdAt: row["created_at"],
    createdByName: row["created_by_name"] ?? "sistema",
    notes: row["notes"] ?? null,
  };
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
          "Slot aguardando texto do executivo. Nenhuma mensagem é inventada pelo sistema.",
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
  title?: string | null;
  contentGroup?: string | null;
  buttonKind?: "portal" | "content" | null;
  notes?: string | null;
  actorId?: string | null;
  actorName: string;
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
      version: nextVersion,
      active: params.body.trim().length > 0,
      content_group:
        params.contentGroup !== undefined
          ? params.contentGroup
          : ((current as any)?.content_group ?? null),
      button_kind:
        params.buttonKind !== undefined
          ? params.buttonKind
          : ((current as any)?.button_kind ?? null),
      supersedes_id: (current as any)?.id ?? null,
      created_by: params.actorId ?? null,
      created_by_name: params.actorName,
      notes: params.notes ?? null,
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toMessage(data);
}

/** Renderiza a etapa a partir da versão ATIVA da Biblioteca. */
export async function renderFromLibrary(
  stepKey: string,
  input: RenderInput,
): Promise<{ result: RenderResult; message: LibraryMessage | null }> {
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
  const spec: MessageSpec = {
    step: stepKey,
    text: message.body,
    usesInvestorName: message.usesInvestorName,
    button: message.buttonKind,
    contentGroup: message.contentGroup,
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
