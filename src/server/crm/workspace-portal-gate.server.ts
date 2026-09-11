import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATE_ID = "workspace-portal-gate-f";
const GATE_KIND = "workspace_portal_gate";

export type WorkspacePortalGateStatus = { closed: boolean };

/** Fail-closed: ausência ou falha de leitura mantém a homologação protegida. */
export async function workspacePortalGateStatus(): Promise<WorkspacePortalGateStatus> {
  try {
    const { data, error } = await supabaseAdmin
      .from("test_batches")
      .select("status")
      .eq("id", GATE_ID)
      .maybeSingle();
    if (error) return { closed: true };
    return { closed: data?.status !== "ABERTO" };
  } catch {
    return { closed: true };
  }
}

export async function mayMaterializeFinancialWorkspaceCard(externalId?: string | null): Promise<boolean> {
  const { closed } = await workspacePortalGateStatus();
  if (!closed) return true;
  if (!externalId) return false;
  const { GREENSALES_WORKSPACE_ALLOWED_EXTERNAL_IDS } = await import("@/lib/crm/workspace-card-policy");
  return GREENSALES_WORKSPACE_ALLOWED_EXTERNAL_IDS.has(String(externalId));
}

export async function closeWorkspacePortalGate(actorId: string, actorName: string): Promise<WorkspacePortalGateStatus> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("test_batches").upsert({
    id: GATE_ID,
    kind: GATE_KIND,
    label: "Portal dos Leads — bloqueado para homologação",
    status: "FECHADO",
    lead_count: 4,
    created_by: actorId,
    created_by_name: actorName,
    started_at: now,
    ends_at: null,
    scenarios: { allowedExternalIds: ["59034", "59037", "59081", "59279"] } as never,
  } as never, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return { closed: true };
}

export async function openWorkspacePortalGate(): Promise<WorkspacePortalGateStatus> {
  const { error } = await supabaseAdmin.from("test_batches").upsert({
    id: GATE_ID,
    kind: GATE_KIND,
    label: "Portal dos Leads — operação normal",
    status: "ABERTO",
    lead_count: 0,
    created_by_name: "Administrador",
    ends_at: new Date().toISOString(),
    scenarios: [] as never,
  } as never, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return { closed: false };
}