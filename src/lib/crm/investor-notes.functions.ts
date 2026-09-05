/**
 * NOTAS DO EXECUTIVO — acesso da interface.
 *
 * O navegador nunca é fonte de verdade: ele apenas lê e escreve no
 * backend. O autor da nota vem SEMPRE da sessão autenticada.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InvestorNoteView = {
  id: string;
  leadId: string;
  body: string;
  authorName: string | null;
  createdAt: string;
};

async function currentExecutiveId(context: { supabase: never }): Promise<string | null> {
  const supabase = context.supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data } = await supabase.rpc("current_executive_id");
  return typeof data === "string" && data ? data : null;
}

export const listInvestorNotesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }): Promise<InvestorNoteView[]> => {
    const { listInvestorNotes } = await import("@/server/crm/investor-notes.server");
    const rows = await listInvestorNotes(data.leadId);
    return rows.map((row) => ({
      id: row.id,
      leadId: row.leadId,
      body: row.body,
      authorName: row.authorName,
      createdAt: row.createdAt,
    }));
  });

export const addInvestorNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leadId: string; body: string; scope?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const executiveId = await currentExecutiveId(context as never);
    const { addInvestorNote } = await import("@/server/crm/investor-notes.server");
    await addInvestorNote({
      leadId: data.leadId,
      body: data.body,
      scope: data.scope ?? null,
      userId: context.userId,
      executiveId,
    });
    return { ok: true as const };
  });
