import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { simulationSchema, simulationDirectory, decodeSimulationPdf } from "./simulation-storage";
import type { SimulationRecord } from "./simulator-history";

export const saveSimulationReport = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(10), record: simulationSchema }).parse(data))
  .handler(async ({ data }) => {
    const { verifyToken } = await import("@/server/portal-token.server");
    if (!(await verifyToken(data.token, data.record.investorId))) throw new Error("Acesso não autorizado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin.from("portal_leads").select("id,scope,origin").eq("id", data.record.investorId).maybeSingle();
    if (error || !lead || !["portal", "green_sales", "tiktok", "meta", "redistribuicao"].includes(lead.scope) || /velox (solar|seguros)/i.test(lead.origin)) throw new Error("Investidor não disponível na Financeira.");
    const bytes = decodeSimulationPdf(data.record.pdfDataUri);
    const dir = simulationDirectory(lead.id);
    const store = supabaseAdmin.storage.from("revista");
    const pdfPath = `${dir}/${data.record.id}.pdf`;
    const { error: pdfError } = await store.upload(pdfPath, bytes, { contentType: "application/pdf", upsert: true });
    if (pdfError) throw new Error("Não foi possível salvar o PDF. Tente novamente.");
    const record = { ...data.record, pdfDataUri: "", storagePath: pdfPath };
    const { error: metaError } = await store.upload(`${dir}/${record.id}.json`, JSON.stringify(record), { contentType: "application/json", upsert: true });
    if (metaError) throw new Error("Não foi possível confirmar o relatório. Tente novamente.");
    return { ok: true as const, id: record.id };
  });

export const listSimulationReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ investorId: z.string().min(3).max(150) }).parse(data))
  .handler(async ({ data, context }): Promise<SimulationRecord[]> => {
    const { assertWorkspaceAccess } = await import("@/server/workspace-authorization.server");
    const identity = await assertWorkspaceAccess(context, "portal_leads");
    const { data: lead, error } = await context.supabase.from("portal_leads").select("id,scope,origin,responsible_executive_id").eq("id", data.investorId).maybeSingle();
    if (error || !lead || !["portal", "green_sales", "tiktok", "meta", "redistribuicao"].includes(lead.scope) || /velox (solar|seguros)/i.test(lead.origin)) throw new Error("Acesso não autorizado ao investidor.");
    if (identity.role === "executivo" && (!identity.executiveId || lead.responsible_executive_id !== identity.executiveId)) throw new Error("Acesso não autorizado ao investidor.");
    // O acesso ao lead já foi validado como o usuário; apenas o acervo privado usa privilégio.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const store = supabaseAdmin.storage.from("revista");
    const dir = simulationDirectory(lead.id);
    const files: { name: string }[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data: batch, error: listError } = await store.list(dir, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (listError) throw new Error("Não foi possível carregar os relatórios.");
      files.push(...(batch ?? []));
      if ((batch?.length ?? 0) < 100) break;
    }
    const records = await Promise.all(files.filter((file) => file.name.endsWith(".json")).map(async (file) => {
      const { data: blob, error: readError } = await store.download(`${dir}/${file.name}`);
      if (readError || !blob) throw new Error("Não foi possível carregar um relatório.");
      const record = simulationSchema.parse(JSON.parse(await blob.text()));
      if (record.investorId !== lead.id || file.name !== `${record.id}.json`) throw new Error("Relatório inválido.");
      const { data: signed, error: signError } = await store.createSignedUrl(`${dir}/${record.id}.pdf`, 300);
      if (signError || !signed) throw new Error("PDF indisponível.");
      return { ...record, pdfUrl: signed.signedUrl };
    }));
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });