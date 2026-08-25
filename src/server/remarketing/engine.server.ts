/**
 * Motor do CRM de Remarketing — execução persistente no servidor.
 *
 * A campanha continua andando com o navegador fechado: o agendador do
 * banco chama /api/public/remarketing/run a cada minuto e este motor
 * envia o próximo lote. Nenhuma tabela, etapa ou cadência do CRM de
 * Relacionamento é tocada aqui.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { channelMode, onlyDigits } from "@/server/whatsapp.server";
import type {
  RemarketingCampaign,
  RemarketingCampaignStatus,
  RemarketingContact,
  RemarketingContactStatus,
} from "@/lib/remarketing/types";

/** Quantidade máxima de envios por execução (1 por minuto). */
const BATCH_SIZE = 20;
/** Janela de envio, horário de Brasília. */
const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 20;

function saoPauloHour(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

export function withinSendingWindow(now = new Date()): boolean {
  const hour = saoPauloHour(now);
  return hour >= WINDOW_START_HOUR && hour < WINDOW_END_HOUR;
}

type CampaignRow = Record<string, unknown>;

function countsOf(rows: { status: string }[]) {
  const acc = { pendente: 0, enviado: 0, erro: 0, cancelado: 0 };
  for (const r of rows) {
    if (r.status === "pendente") acc.pendente += 1;
    else if (r.status === "enviado") acc.enviado += 1;
    else if (r.status === "erro") acc.erro += 1;
    else if (r.status === "cancelado") acc.cancelado += 1;
  }
  return acc;
}

function toCampaign(row: CampaignRow, counts = { pendente: 0, enviado: 0, erro: 0, cancelado: 0 }): RemarketingCampaign {
  return {
    id: String(row["id"]),
    name: String(row["name"] ?? ""),
    templateName: String(row["template_name"] ?? ""),
    templateLabel: String(row["template_label"] ?? ""),
    templateLanguage: (row["template_language"] as string | null) ?? null,
    templateBody: String(row["template_body"] ?? ""),
    status: String(row["status"] ?? "rascunho") as RemarketingCampaignStatus,
    totalCount: Number(row["total_count"] ?? 0),
    validCount: Number(row["valid_count"] ?? 0),
    invalidCount: Number(row["invalid_count"] ?? 0),
    duplicateCount: Number(row["duplicate_count"] ?? 0),
    pendingCount: counts.pendente,
    sentCount: counts.enviado,
    errorCount: counts.erro,
    cancelledCount: counts.cancelado,
    createdByName: String(row["created_by_name"] ?? ""),
    startedAt: (row["started_at"] as string | null) ?? null,
    finishedAt: (row["finished_at"] as string | null) ?? null,
    lastRunAt: (row["last_run_at"] as string | null) ?? null,
    createdAt: String(row["created_at"] ?? ""),
  };
}

export async function listCampaigns(): Promise<RemarketingCampaign[]> {
  const { data, error } = await supabaseAdmin
    .from("remarketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CampaignRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => String(r["id"]));
  const { data: contacts } = await supabaseAdmin
    .from("remarketing_contacts")
    .select("campaign_id, status")
    .in("campaign_id", ids);

  const byCampaign = new Map<string, { status: string }[]>();
  for (const c of (contacts ?? []) as { campaign_id: string; status: string }[]) {
    const list = byCampaign.get(c.campaign_id) ?? [];
    list.push({ status: c.status });
    byCampaign.set(c.campaign_id, list);
  }

  return rows.map((r) => toCampaign(r, countsOf(byCampaign.get(String(r["id"])) ?? [])));
}

export async function listContacts(campaignId: string): Promise<RemarketingContact[]> {
  const { data, error } = await supabaseAdmin
    .from("remarketing_contacts")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row["id"]),
    campaignId: String(row["campaign_id"]),
    phone: String(row["phone"] ?? ""),
    rawInput: String(row["raw_input"] ?? ""),
    status: String(row["status"] ?? "pendente") as RemarketingContactStatus,
    error: (row["error"] as string | null) ?? null,
    sentAt: (row["sent_at"] as string | null) ?? null,
  }));
}

export async function createCampaign(input: {
  name: string;
  templateName: string;
  templateLabel: string;
  templateLanguage: string | null;
  templateBody: string;
  contacts: { raw: string; phone: string }[];
  invalidCount: number;
  duplicateCount: number;
  createdBy: string | null;
  createdByName: string;
}): Promise<RemarketingCampaign> {
  const unique = new Map<string, string>();
  for (const c of input.contacts) unique.set(onlyDigits(c.phone), c.raw);

  const { data, error } = await supabaseAdmin
    .from("remarketing_campaigns")
    .insert({
      name: input.name,
      template_name: input.templateName,
      template_label: input.templateLabel,
      template_language: input.templateLanguage,
      template_body: input.templateBody,
      status: "pronta",
      total_count: unique.size + input.invalidCount + input.duplicateCount,
      valid_count: unique.size,
      invalid_count: input.invalidCount,
      duplicate_count: input.duplicateCount,
      created_by: input.createdBy,
      created_by_name: input.createdByName,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const campaignId = String((data as CampaignRow)["id"]);
  const rows = [...unique.entries()].map(([phone, raw]) => ({
    campaign_id: campaignId,
    phone,
    raw_input: raw,
    status: "pendente",
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: insertError } = await supabaseAdmin
      .from("remarketing_contacts")
      .insert(rows.slice(i, i + 500));
    if (insertError) throw new Error(insertError.message);
  }

  return toCampaign(data as CampaignRow, { pendente: rows.length, enviado: 0, erro: 0, cancelado: 0 });
}

export async function setCampaignStatus(
  campaignId: string,
  status: RemarketingCampaignStatus,
): Promise<void> {
  const patch: {
    status: RemarketingCampaignStatus;
    started_at?: string;
    finished_at?: string;
  } = { status };
  if (status === "em_execucao") patch.started_at = new Date().toISOString();
  if (status === "cancelada" || status === "concluida")
    patch.finished_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("remarketing_campaigns")
    .update(patch)
    .eq("id", campaignId);
  if (error) throw new Error(error.message);

  if (status === "cancelada") {
    await supabaseAdmin
      .from("remarketing_contacts")
      .update({ status: "cancelado" })
      .eq("campaign_id", campaignId)
      .eq("status", "pendente");
  }
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("remarketing_campaigns")
    .delete()
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
}

/** Envio do template oficial pelo canal ativo. */
async function sendTemplate(input: {
  phone: string;
  templateName: string;
  language: string | null;
}): Promise<{ delivered: boolean; error?: string }> {
  const mode = channelMode();
  if (mode === "simulator") return { delivered: true };
  if (mode === "unavailable")
    return { delivered: false, error: "Canal oficial não configurado." };
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${process.env["WHATSAPP_PHONE_NUMBER_ID"]}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env["WHATSAPP_TOKEN"]}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.phone,
          type: "template",
          template: {
            name: input.templateName,
            language: { code: input.language || "pt_BR" },
          },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      return { delivered: false, error: `Meta respondeu ${res.status}: ${detail.slice(0, 180)}` };
    }
    return { delivered: true };
  } catch (e) {
    return { delivered: false, error: e instanceof Error ? e.message : "Falha no envio" };
  }
}

export type RemarketingRunResult = {
  ok: true;
  processedCampaigns: number;
  sent: number;
  failed: number;
  skipped?: string;
};

/** Um passo do motor: envia o próximo lote das campanhas em execução. */
export async function runRemarketingEngine(now = new Date()): Promise<RemarketingRunResult> {
  if (!withinSendingWindow(now))
    return { ok: true, processedCampaigns: 0, sent: 0, failed: 0, skipped: "fora da janela" };

  const { data, error } = await supabaseAdmin
    .from("remarketing_campaigns")
    .select("*")
    .eq("status", "em_execucao")
    .order("started_at", { ascending: true })
    .limit(3);
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  const campaigns = (data ?? []) as CampaignRow[];

  for (const row of campaigns) {
    const campaignId = String(row["id"]);
    const templateName = String(row["template_name"] ?? "");
    const language = (row["template_language"] as string | null) ?? null;

    const { data: pending } = await supabaseAdmin
      .from("remarketing_contacts")
      .select("id, phone")
      .eq("campaign_id", campaignId)
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    const batch = (pending ?? []) as { id: string; phone: string }[];
    if (batch.length === 0) {
      await setCampaignStatus(campaignId, "concluida");
      continue;
    }

    for (const contact of batch) {
      const result = await sendTemplate({ phone: contact.phone, templateName, language });
      if (result.delivered) sent += 1;
      else failed += 1;
      await supabaseAdmin
        .from("remarketing_contacts")
        .update({
          status: result.delivered ? "enviado" : "erro",
          error: result.error ?? null,
          sent_at: result.delivered ? new Date().toISOString() : null,
        })
        .eq("id", contact.id);
    }

    await supabaseAdmin
      .from("remarketing_campaigns")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  return { ok: true, processedCampaigns: campaigns.length, sent, failed };
}
