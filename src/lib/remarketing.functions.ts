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

/* ---------------------------------------------------------------------
 * Caixa de Conversas — ambiente isolado.
 * ------------------------------------------------------------------ */
export const listRemarketingConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listConversations } = await import("@/server/remarketing/conversations.server");
    return listConversations();
  });

export const listRemarketingMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { listMessages, markConversationRead } = await import(
      "@/server/remarketing/conversations.server"
    );
    await markConversationRead(data.conversationId);
    return listMessages(data.conversationId);
  });

export const sendRemarketingReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(3000),
        authorName: z.string().trim().max(120).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { replyManually } = await import("@/server/remarketing/conversations.server");
    return replyManually(data);
  });

export const updateRemarketingConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        conversationId: z.string().uuid(),
        status: z.enum(["aguardando", "respondeu", "em_atendimento", "encerrada"]).optional(),
        contactName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { setConversationStatus, renameConversation, listConversations } = await import(
      "@/server/remarketing/conversations.server"
    );
    if (data.status) await setConversationStatus(data.conversationId, data.status);
    if (data.contactName !== undefined)
      await renameConversation(data.conversationId, data.contactName);
    return listConversations();
  });
