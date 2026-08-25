/**
 * Ponte tipada entre o CRM de Remarketing (navegador) e o motor no
 * servidor. Nenhuma regra de negócio vive aqui.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RemarketingCampaign, RemarketingContact } from "@/lib/remarketing/types";

export const listRemarketingCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<RemarketingCampaign[]> => {
    const { listCampaigns } = await import("@/server/remarketing/engine.server");
    return listCampaigns();
  });

export const listRemarketingContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ campaignId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<RemarketingContact[]> => {
    const { listContacts } = await import("@/server/remarketing/engine.server");
    return listContacts(data.campaignId);
  });

export const createRemarketingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        templateName: z.string().trim().min(1).max(200),
        templateLabel: z.string().trim().max(200).default(""),
        templateLanguage: z.string().trim().max(20).nullable().default(null),
        templateBody: z.string().max(4000).default(""),
        createdByName: z.string().trim().max(120).default(""),
        contacts: z
          .array(z.object({ raw: z.string().max(120), phone: z.string().min(10).max(20) }))
          .min(1)
          .max(5000),
        invalidCount: z.number().int().min(0).max(100000).default(0),
        duplicateCount: z.number().int().min(0).max(100000).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<RemarketingCampaign> => {
    const { createCampaign } = await import("@/server/remarketing/engine.server");
    return createCampaign({ ...data, createdBy: context.userId ?? null });
  });

export const updateRemarketingCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        campaignId: z.string().uuid(),
        status: z.enum(["em_execucao", "pausada", "cancelada"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { setCampaignStatus, listCampaigns } = await import(
      "@/server/remarketing/engine.server"
    );
    await setCampaignStatus(data.campaignId, data.status);
    return listCampaigns();
  });

export const deleteRemarketingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ campaignId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteCampaign, listCampaigns } = await import("@/server/remarketing/engine.server");
    await deleteCampaign(data.campaignId);
    return listCampaigns();
  });
