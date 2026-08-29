/**
 * E20 — GERADOR DE OCORRÊNCIA E LINK DE 7 DIAS (SERVER ONLY).
 *
 * A E20 é o convite formal ao Portal do Investidor. Cada emissão é uma
 * OCORRÊNCIA própria, com link exclusivo e validade contada a partir do
 * momento em que foi gerada — nunca a partir de uma data global.
 *
 * Regras fechadas com a operação:
 *  - Uma segunda E20 NÃO substitui silenciosamente a anterior: a
 *    anterior é encerrada com o motivo `encerrada_por_nova` e uma nova
 *    ocorrência (e nova instância de cadência) nasce independente.
 *  - Validade de 7 dias corridos por emissão. Link vencido não abre.
 *  - Checkpoint em +7 dias (E27) e finalização no dia útil seguinte.
 *  - OPORTUNIDADE é terminal: nada é emitido depois dela.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { openInstance } from "./instances.server";
import {
  renderFromLibrary,
  recordMessageSnapshot,
} from "./message-library.server";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Próximo dia ÚTIL a partir de um instante — calendário oficial único.
 *
 * Correção do Refino Final: a versão anterior lia `getUTCDay()` sobre o
 * instante bruto, o que jogava sexta 21:00 BRT para sábado UTC e
 * ignorava feriados. Agora a data operacional sai do fuso de Brasília
 * e o salto usa `nextBusinessDay` do calendário (fins de semana +
 * feriados nacionais e estaduais de SP).
 */
function nextBusinessDayAfter(from: Date): string {
  const today = operationalDate(from.toISOString());
  return nextBusinessDay(addDays(today, 1));
}


export type E20Occurrence = {
  id: string;
  leadId: string;
  instanceSeq: number;
  token: string;
  linkUrl: string;
  status: string;
  generatedAt: string;
  expiresAt: string;
  firstOpenedAt: string | null;
  openCount: number;
  checkpointDueAt: string;
  finalizationDueOn: string;
  closedAt: string | null;
  closeReason: string | null;
};

function toOccurrence(row: Record<string, any>): E20Occurrence {
  return {
    id: row["id"],
    leadId: row["lead_id"],
    instanceSeq: row["instance_seq"] ?? 1,
    token: row["token"],
    linkUrl: row["link_url"],
    status: row["status"],
    generatedAt: row["generated_at"],
    expiresAt: row["expires_at"],
    firstOpenedAt: row["first_opened_at"] ?? null,
    openCount: row["open_count"] ?? 0,
    checkpointDueAt: row["checkpoint_due_at"],
    finalizationDueOn: row["finalization_due_on"],
    closedAt: row["closed_at"] ?? null,
    closeReason: row["close_reason"] ?? null,
  };
}

export async function listE20Occurrences(leadId: string): Promise<E20Occurrence[]> {
  const { data } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .select("*")
    .eq("lead_id", leadId)
    .order("generated_at", { ascending: false });
  return (data ?? []).map(toOccurrence);
}

/**
 * OCORRÊNCIA VIGENTE. Emitir uma segunda E20 sem necessidade encerra a
 * anterior e abre outra instância de cadência — barulho operacional puro.
 * Enquanto existir um convite ativo e dentro da validade, ele é o convite:
 * a interface reutiliza este link em vez de gerar um novo.
 */
export async function currentE20(leadId: string): Promise<E20Occurrence | null> {
  const { data } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .select("*")
    .eq("lead_id", leadId)
    .is("closed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toOccurrence(data as Record<string, any>) : null;
}

export type IssueE20Result =
  | { issued: false; reason: string }
  | {
      issued: true;
      occurrence: E20Occurrence;
      replaced: E20Occurrence | null;
      /** Texto oficial da E20 (versão ativa da Biblioteca) já renderizado. */
      message: { body: string; version: number | null } | null;
      /** Motivo legível quando a Biblioteca ainda não tem texto ativo. */
      messageBlockedReason: string | null;
    };

export async function issueE20(params: {
  leadId: string;
  baseUrl: string;
  generatedBy?: string | null;
  generatedByName: string;
  generatedByExecutiveId?: string | null;
  stageKey?: string | null;
}): Promise<IssueE20Result> {
  // Nova instância de cadência: a E20 abre um ciclo próprio. A trava
  // de OPORTUNIDADE vive dentro de `openInstance`.
  const instance = await openInstance({
    leadId: params.leadId,
    openedReason: "e20_emitida",
    closeReason: "encerrada_por_nova",
    startedBy: "manual",
    ...(params.stageKey !== undefined ? { stageKey: params.stageKey } : {}),
  });
  if (!instance.opened) return { issued: false, reason: instance.reason };

  // Encerra a ocorrência anterior que ainda estiver de pé — o histórico
  // permanece visível, apenas deixa de ser a vigente.
  const now = new Date();
  const at = now.toISOString();
  const { data: previousRows } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .update({ status: "encerrada", closed_at: at, close_reason: "encerrada_por_nova" } as any)
    .eq("lead_id", params.leadId)
    .is("closed_at", null)
    .select("*");
  const replaced = (previousRows ?? []).map(toOccurrence)[0] ?? null;

  /**
   * IDENTIDADE REAL NA E20 (COMANDO 2A §5): quem assina o convite é o
   * EXECUTIVO RESPONSÁVEL pelo lead. O usuário que clicou permanece
   * registrado como emissor, mas nunca substitui a assinatura.
   */
  const { resolveLeadExecutive } = await import("./executive-identity.server");
  const responsible = await resolveLeadExecutive(params.leadId);
  const signatureName = responsible.available ? responsible.name : params.generatedByName;
  const responsibleId = responsible.available
    ? responsible.executiveId
    : (params.generatedByExecutiveId ?? null);

  const token = newToken();
  const expiresAt = new Date(now.getTime() + SEVEN_DAYS_MS).toISOString();
  const linkUrl = `${params.baseUrl.replace(/\/+$/, "")}/portal/convite/${token}`;

  const { data, error } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .insert({
      scope: "production",
      lead_id: params.leadId,
      instance_seq: instance.instanceSeq,
      token,
      link_url: linkUrl,
      status: "ativa",
      generated_by: params.generatedBy ?? null,
      generated_by_name: params.generatedByName,
      generated_by_executive_id: responsibleId,
      generated_at: at,
      expires_at: expiresAt,
      checkpoint_due_at: expiresAt,
      finalization_due_on: nextBusinessDay(new Date(expiresAt)),
      snapshot: {
        emitido_por: params.generatedByName,
        assinatura: signatureName,
        instancia: instance.instanceSeq,
      },
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const occurrence = toOccurrence(data as Record<string, any>);

  /**
   * A mensagem da E20 vem da BIBLIOTECA (versão ativa) — nunca de texto
   * fixo no código — e o que sair é congelado como snapshot vinculado a
   * esta ocorrência. Alterar a Biblioteca depois não muda o histórico.
   */
  const { data: leadRow } = await supabaseAdmin
    .from("portal_leads")
    .select("name")
    .eq("id", params.leadId)
    .maybeSingle();
  const { result, message: libraryMessage } = await renderFromLibrary("E20", {
    executiveName: signatureName,
    portalLink: linkUrl,
    rawInvestorName: leadRow?.name ?? null,
  });

  if (!result.ok) {
    return {
      issued: true,
      occurrence,
      replaced,
      message: null,
      messageBlockedReason: result.reason,
    };
  }

  const body = result.button ? `${result.body}\n\n${result.button.url}` : result.body;
  await recordMessageSnapshot({
    leadId: params.leadId,
    step: "E20",
    renderedBody: body,
    templateBody: libraryMessage?.body ?? body,
    libraryId: libraryMessage?.id ?? null,
    libraryVersion: libraryMessage?.version ?? null,
    libraryCode: libraryMessage?.code ?? null,
    investorNameUsed: result.treatment,
    actorId: params.generatedBy ?? null,
    actorName: params.generatedByName,
    origin: "executivo",
    instanceSeq: instance.instanceSeq,
    occurrenceId: occurrence.id,
    contentUrl: linkUrl,
    sentAt: at,
  });

  return {
    issued: true,
    occurrence,
    replaced,
    message: { body, version: libraryMessage?.version ?? null },
    messageBlockedReason: null,
  };
}

export type E20Redemption =
  | { valid: false; reason: string }
  | { valid: true; leadId: string; occurrenceId: string };

/**
 * Resgate do link. A validade é a da EMISSÃO — um link antigo não
 * ganha sobrevida porque outro foi gerado depois.
 */
export async function redeemE20(token: string, userAgent?: string | null): Promise<E20Redemption> {
  const { data } = await supabaseAdmin
    .from("relationship_e20_occurrences")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { valid: false, reason: "Convite não encontrado." };

  const row = data as Record<string, any>;
  const at = new Date().toISOString();
  const expired = new Date(row["expires_at"]).getTime() < Date.now();
  const closed = Boolean(row["closed_at"]) && row["close_reason"] === "encerrada_por_nova";

  await supabaseAdmin.from("relationship_e20_accesses").insert({
    occurrence_id: row["id"],
    lead_id: row["lead_id"],
    accessed_at: at,
    user_agent: userAgent ?? null,
    outcome: expired ? "expirado" : closed ? "substituido" : "ok",
  } as any);

  if (expired) {
    await supabaseAdmin
      .from("relationship_e20_occurrences")
      .update({ status: "expirada" } as any)
      .eq("id", row["id"]);
    return { valid: false, reason: "Este convite expirou. Peça um novo ao seu executivo." };
  }
  if (closed) {
    return {
      valid: false,
      reason: "Este convite foi substituído por um mais recente. Use o último link recebido.",
    };
  }

  await supabaseAdmin
    .from("relationship_e20_occurrences")
    .update({
      first_opened_at: row["first_opened_at"] ?? at,
      open_count: (row["open_count"] ?? 0) + 1,
      status: "aberta",
      updated_at: at,
    } as any)
    .eq("id", row["id"]);

  return { valid: true, leadId: row["lead_id"], occurrenceId: row["id"] };
}
