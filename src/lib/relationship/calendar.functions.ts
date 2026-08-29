/**
 * CALENDÁRIO DE DIAS SEM ENVIO — funções chamáveis pela interface.
 * Somente gestão (admin/manager) administra; leitura é do Portal.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertGestao(context: { supabase: any; userId: string }) {
  const { data: admin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  const { data: manager } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "manager",
  });
  if (!admin && !manager) throw new Error("Apenas a gestão administra o calendário.");
}

export const listarDiasSemEnvio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listExtraNonBusinessDays } = await import(
      "@/server/relationship/calendar-admin.server"
    );
    return listExtraNonBusinessDays();
  });

export const incluirDiaSemEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ day: z.string(), reason: z.string().max(200).default("") }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertGestao(context as never);
    const { addExtraNonBusinessDay, syncNonBusinessCalendar } = await import(
      "@/server/relationship/calendar-admin.server"
    );
    const rows = await addExtraNonBusinessDay(data.day, data.reason, context.userId);
    await syncNonBusinessCalendar();
    return rows;
  });

export const removerDiaSemEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ day: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertGestao(context as never);
    const { removeExtraNonBusinessDay, syncNonBusinessCalendar } = await import(
      "@/server/relationship/calendar-admin.server"
    );
    const rows = await removeExtraNonBusinessDay(data.day);
    await syncNonBusinessCalendar();
    return rows;
  });
