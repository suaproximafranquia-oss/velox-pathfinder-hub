/**
 * POC GreenSales → Atlas (somente leitura na origem).
 *
 * Importa para o Portal apenas os leads criados HOJE no GreenSales,
 * identificados de forma permanente por `external_source = 'greensales'`
 * e `external_id = id original`. Nenhuma escrita é feita no GreenSales.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GreenSalesImportResult = {
  ok: boolean;
  stage: "autenticacao" | "consulta" | "importacao" | "concluido";
  message?: string;
  day?: string;
  windowStart?: string;
  windowEnd?: string;
  pagesScanned?: number;
  found: number;
  imported: number;
  duplicated: number;
  failed: number;
  processed: number;
  errors: string[];
  sample?: {
    greensales: Record<string, unknown>;
    atlas: Record<string, unknown>;
  } | null;
};

const EMPTY: GreenSalesImportResult = {
  ok: false,
  stage: "autenticacao",
  found: 0,
  imported: 0,
  duplicated: 0,
  failed: 0,
  processed: 0,
  errors: [],
  sample: null,
};

export const importGreenSalesTodayLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GreenSalesImportResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return { ...EMPTY, stage: "autenticacao", message: "Acesso restrito ao Administrador." };
    }

    const {
      greenSalesLogin,
      fetchTodayLeads,
      GreenSalesError,
      operationDayWindow,
    } = await import("@/server/greensales.server");
    const win = operationDayWindow();
    const base = {
      ...EMPTY,
      day: win.day,
      windowStart: win.startUtc.toISOString(),
      windowEnd: win.endUtc.toISOString(),
    };

    let token: string;
    try {
      token = await greenSalesLogin();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha desconhecida.";
      return { ...base, stage: "autenticacao", message: msg };
    }

    let leads: Awaited<ReturnType<typeof fetchTodayLeads>>;
    try {
      leads = await fetchTodayLeads(token);
    } catch (error) {
      const msg =
        error instanceof GreenSalesError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Falha desconhecida.";
      return { ...base, stage: "consulta", message: msg };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const externalIds = leads.leads.map((l) => String(l.id));
    const { data: existing } = externalIds.length
      ? await supabaseAdmin
          .from("portal_leads")
          .select("external_id")
          .eq("external_source", "greensales")
          .in("external_id", externalIds)
      : { data: [] as { external_id: string | null }[] };
    const known = new Set((existing ?? []).map((r) => r.external_id));

    let imported = 0;
    let duplicated = 0;
    let failed = 0;
    const errors: string[] = [];
    let sample: GreenSalesImportResult["sample"] = null;

    for (const lead of leads.leads) {
      const externalId = String(lead.id);
      if (known.has(externalId)) {
        duplicated += 1;
        continue;
      }
      const row = {
        id: `gs_${externalId}`,
        name: (lead.name ?? "").toString().trim() || "Sem nome",
        email: (lead.email ?? "").toString().trim().toLowerCase(),
        whatsapp: (lead.phone ?? "").toString().trim(),
        city: "",
        origin: "GreenSales",
        material: (lead.origin ?? "").toString(),
        scope: "portal" as const,
        personalized: false,
        responsible_executive_id: null,
        responsible_executive_slug: null,
        campaign: null,
        device: null,
        created_at: lead.created_at ?? new Date().toISOString(),
        last_activity_at: lead.updated_at ?? lead.created_at ?? new Date().toISOString(),
        journey: {} as never,
        external_source: "greensales",
        external_id: externalId,
        external_created_at: lead.created_at ?? null,
        external_updated_at: lead.updated_at ?? null,
        external_payload: lead as never,
      };
      const { error } = await supabaseAdmin
        .from("portal_leads")
        .upsert(row, { onConflict: "id" });
      if (error) {
        failed += 1;
        errors.push(`Lead ${externalId}: ${error.message}`);
        continue;
      }
      known.add(externalId);
      imported += 1;
      if (!sample) {
        sample = {
          greensales: {
            id: lead.id,
            name: lead.name ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            origin: lead.origin ?? "",
            status: lead.status ?? "",
            created_at: lead.created_at ?? "",
            updated_at: lead.updated_at ?? "",
          },
          atlas: {
            id: row.id,
            external_source: row.external_source,
            external_id: row.external_id,
            name: row.name,
            email: row.email,
            whatsapp: row.whatsapp,
            origin: row.origin,
            scope: row.scope,
            external_created_at: row.external_created_at,
            external_updated_at: row.external_updated_at,
          },
        };
      }
    }

    return {
      ok: true,
      stage: "concluido",
      day: leads.window.day,
      windowStart: leads.window.startUtc.toISOString(),
      windowEnd: leads.window.endUtc.toISOString(),
      pagesScanned: leads.pagesScanned,
      found: leads.leads.length,
      imported,
      duplicated,
      failed,
      processed: leads.leads.length,
      errors: errors.slice(0, 20),
      sample,
    };
  });
