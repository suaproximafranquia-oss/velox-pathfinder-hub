/**
 * Leitura do MOTOR DE RELACIONAMENTO — SOMENTE LEITURA.
 *
 * Reconstrói a linha do tempo de qualquer lead (COMANDO 2A §68, §116) e
 * expõe o estado do motor. Nenhuma função aqui envia mensagem, cria
 * lead, altera estado ou apaga dado — nem em produção, nem em
 * homologação. É também a base da futura "Auditoria do CRM real".
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scopeSchema = z.enum(["production", "homologation"]).default("production");

export const getRelationshipEngineStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ scope: scopeSchema }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { assertRelationshipReadAccess } = await import(
      "@/server/relationship/authorization.server"
    );
    await assertRelationshipReadAccess(context.supabase as never, context.userId, data.scope);
    const { readEngineStatus } = await import("@/server/relationship/audit.server");
    return readEngineStatus(data.scope);
  });

export const getRelationshipTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ scope: scopeSchema, leadId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertRelationshipReadAccess } = await import(
      "@/server/relationship/authorization.server"
    );
    await assertRelationshipReadAccess(
      context.supabase as never,
      context.userId,
      data.scope,
      data.leadId,
    );
    const { readLeadTimeline } = await import("@/server/relationship/audit.server");
    return readLeadTimeline(data.scope, data.leadId);
  });