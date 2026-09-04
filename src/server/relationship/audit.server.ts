/**
 * Auditoria do motor — SERVER ONLY e SOMENTE LEITURA.
 *
 * Reconstrói o que aconteceu com um lead sem depender de interpretação
 * humana: eventos, decisões (com motivo) e fila. Nenhuma escrita.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { RELATIONSHIP_CONFIG, ENGINE_TEMPLATE_PURPOSES, OPENING_TEMPLATE_PURPOSES } from "@/lib/relationship/config";
import type { EngineScope } from "@/lib/relationship/types";

export type EngineStatus = {
  scope: EngineScope;
  enabled: boolean;
  cadences: number;
  pending: number;
  blocked: number;
  failed: number;
  /** Finalidades exigidas pelo motor que ainda não têm template oficial. */
  missingTemplatePurposes: string[];
  contentGaps: string[];
};

export async function readEngineStatus(scope: EngineScope): Promise<EngineStatus> {
  const [{ count: cadences }, queue, bindings] = await Promise.all([
    supabaseAdmin
      .from("relationship_cadences")
      .select("id", { count: "exact", head: true })
      .eq("scope", scope),
    supabaseAdmin.from("relationship_queue").select("status").eq("scope", scope),
    supabaseAdmin
      .from("relationship_template_bindings")
      .select("purpose,template_id,approved")
      .eq("scope", scope),
  ]);

  const rows = (queue.data ?? []) as { status: string }[];
  const required = [...ENGINE_TEMPLATE_PURPOSES, ...OPENING_TEMPLATE_PURPOSES];
  const ready = new Set(
    ((bindings.data ?? []) as any[])
      .filter((b) => b.template_id && b.approved)
      .map((b) => b.purpose as string),
  );

  return {
    scope,
    enabled: RELATIONSHIP_CONFIG.enabled,
    cadences: cadences ?? 0,
    pending: rows.filter((r) => r.status === "PENDING" || r.status === "PROCESSING").length,
    blocked: rows.filter((r) => r.status === "BLOCKED" || r.status === "CANCELLED").length,
    failed: rows.filter((r) => r.status === "FAILED").length,
    missingTemplatePurposes: required.filter((p) => !ready.has(p)),
    contentGaps: [],
  };
}

export type TimelineEntry = {
  at: string;
  kind: "evento" | "decisao" | "fila";
  label: string;
  detail: string | null;
};

export async function readLeadTimeline(
  scope: EngineScope,
  leadId: string,
): Promise<{ state: string | null; entries: TimelineEntry[] }> {
  const [record, events, decisions, queue] = await Promise.all([
    supabaseAdmin
      .from("relationship_cadences")
      .select("*")
      .eq("scope", scope)
      .eq("lead_id", leadId)
      .maybeSingle(),
    supabaseAdmin
      .from("relationship_events")
      .select("type,step,occurred_at,historical")
      .eq("scope", scope)
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: true }),
    supabaseAdmin
      .from("relationship_decisions")
      .select("decided_at,step,outcome,reason")
      .eq("scope", scope)
      .eq("lead_id", leadId)
      .order("decided_at", { ascending: true }),
    supabaseAdmin
      .from("relationship_queue")
      .select("step,due_at,status,reason")
      .eq("scope", scope)
      .eq("lead_id", leadId)
      .order("due_at", { ascending: true }),
  ]);

  const entries: TimelineEntry[] = [
    ...((events.data ?? []) as any[]).map((e) => ({
      at: e.occurred_at as string,
      kind: "evento" as const,
      label: e.historical ? `${e.type} (histórico)` : e.type,
      detail: e.step ?? null,
    })),
    ...((decisions.data ?? []) as any[]).map((d) => ({
      at: d.decided_at as string,
      kind: "decisao" as const,
      label: `${d.outcome}${d.step ? ` · ${d.step}` : ""}`,
      detail: d.reason as string,
    })),
    ...((queue.data ?? []) as any[]).map((q) => ({
      at: q.due_at as string,
      kind: "fila" as const,
      label: `${q.step} · ${q.status}`,
      detail: q.reason ?? null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // Serializado como JSON: a auditoria é leitura, não manipulação.
  return { state: record.data ? JSON.stringify(record.data) : null, entries };
}