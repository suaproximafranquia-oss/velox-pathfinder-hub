/**
 * §13/§14 — SITUAÇÃO DO USUÁRIO COM AUTORIDADE NO SERVIDOR.
 *
 * Ativar ou desativar um usuário deixou de ser uma marca no navegador do
 * Administrador: a decisão vive no banco. Toda sessão consulta esta
 * fonte periodicamente, de modo que a desativação encerra o acesso
 * imediatamente e um novo login é recusado pelo próprio servidor.
 *
 * Desativação NUNCA apaga histórico, conversas ou leads (§16).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExecutiveStatusRow = {
  executiveId: string;
  status: "ativo" | "inativo";
  updatedAt: string;
  updatedByName: string;
};

/** Leitura aberta a qualquer membro autenticado — a interface precisa reagir. */
export const listExecutiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExecutiveStatusRow[]> => {
    const { data, error } = await context.supabase
      .from("executive_user_status")
      .select("executive_id,status,updated_at,updated_by_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      executiveId: String(row.executive_id),
      status: row.status === "inativo" ? "inativo" : "ativo",
      updatedAt: String(row.updated_at),
      updatedByName: row.updated_by_name ?? "",
    }));
  });

/** Gravação restrita ao Administrador — quem recusa é a política do banco. */
export const setExecutiveStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        executiveId: z.string().min(1),
        status: z.enum(["ativo", "inativo"]),
        actorName: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("executive_user_status").upsert(
      {
        executive_id: data.executiveId,
        status: data.status,
        updated_at: new Date().toISOString(),
        updated_by_name: data.actorName ?? "",
      } as never,
      { onConflict: "executive_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
