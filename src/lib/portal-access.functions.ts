/**
 * Autorização e progresso do Portal do Investidor — fonte de verdade no
 * servidor.
 *
 * Antes desta camada a liberação manual feita pelo Executivo e o
 * progresso do Manual viviam apenas no navegador de quem executou a
 * ação: o CRM liberava, mas o investidor (outro navegador, outro
 * dispositivo) continuava bloqueado, e a leitura do Manual jamais
 * chegava ao CRM. Aqui tudo é persistido em `portal_leads` e consultado
 * pelas duas pontas — sem depender de F5, cache, cookie ou sessão.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalAccessState = {
  investorId: string;
  released: boolean;
  releasedAt: string | null;
  releasedByName: string | null;
  releaseReason: string | null;
  confirmedAt: string | null;
  journeyPercent: number;
  journeyChapter: string | null;
  journeyStage: string | null;
  journeyStartedAt: string | null;
  journeyCompletedAt: string | null;
  journeyLastEventAt: string | null;
};

const ACCESS_COLUMNS =
  "id,portal_released_at,portal_released_by,portal_release_reason,whatsapp_confirmed_at,journey_percent,journey_chapter,journey_stage,journey_started_at,journey_completed_at,journey_last_event_at";

function toState(row: Record<string, unknown>): PortalAccessState {
  return {
    investorId: String(row["id"]),
    released: Boolean(row["portal_released_at"]),
    releasedAt: (row["portal_released_at"] as string) ?? null,
    releasedByName: (row["portal_released_by"] as string) ?? null,
    releaseReason: (row["portal_release_reason"] as string) ?? null,
    confirmedAt: (row["whatsapp_confirmed_at"] as string) ?? null,
    journeyPercent: Number(row["journey_percent"] ?? 0),
    journeyChapter: (row["journey_chapter"] as string) ?? null,
    journeyStage: (row["journey_stage"] as string) ?? null,
    journeyStartedAt: (row["journey_started_at"] as string) ?? null,
    journeyCompletedAt: (row["journey_completed_at"] as string) ?? null,
    journeyLastEventAt: (row["journey_last_event_at"] as string) ?? null,
  };
}

/**
 * Consulta pública: quem pergunta é o próprio visitante, que não possui
 * sessão autenticada. Devolve apenas o estado de autorização do seu
 * identificador — nunca dados de terceiros nem listagem da base.
 */
export const fetchPortalAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ investorId: z.string().min(3) }).parse(data))
  .handler(async ({ data }): Promise<PortalAccessState | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("portal_leads")
      .select(ACCESS_COLUMNS)
      .eq("id", data.investorId)
      .maybeSingle();
    return row ? toState(row as Record<string, unknown>) : null;
  });

/**
 * Liberação manual (Administrador/Gestora). Persistida no banco: passa a
 * valer para qualquer navegador e dispositivo do investidor.
 */
export const releasePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        investorId: z.string().min(3),
        actorName: z.string().min(1),
        reason: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const releasedAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("portal_leads")
      .update({
        portal_released_at: releasedAt,
        portal_released_by: data.actorName,
        portal_release_reason: data.reason,
      })
      .eq("id", data.investorId);
    if (error) throw new Error(error.message);
    return { ok: true as const, releasedAt };
  });

/** Confirmação oficial do WhatsApp — registrada no servidor. */
export const confirmPortalWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ investorId: z.string().min(3), token: z.string().min(10) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyToken } = await import("@/server/portal-token.server");
    if (!(await verifyToken(data.token, data.investorId))) {
      return { ok: false as const, reason: "nao_autorizado" as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const confirmedAt = new Date().toISOString();
    await supabaseAdmin
      .from("portal_leads")
      .update({ whatsapp_confirmed_at: confirmedAt })
      .eq("id", data.investorId)
      .is("whatsapp_confirmed_at", null);
    return { ok: true as const, confirmedAt };
  });

const progressSchema = z.object({
  investorId: z.string().min(3),
  /** Credencial assinada emitida pelo servidor para este investidor. */
  token: z.string().min(10),
  /** Evento real ocorrido: nunca é inferido nem inventado. */
  event: z.string().min(2),
  module: z.string().optional(),
  detail: z.string().optional(),
  percent: z.number().min(0).max(100).optional(),
  chapter: z.string().optional(),
  stage: z.string().optional(),
  completed: z.boolean().optional(),
  firstAccess: z.boolean().optional(),
});

/**
 * Registro do progresso REAL do investidor. Chamado pelo navegador do
 * visitante (sem autenticação) e independente da confirmação do
 * WhatsApp: se o conteúdo foi acessado, o evento existe.
 */
export const trackPortalProgress = createServerFn({ method: "POST" })
  .inputValidator((data) => progressSchema.parse(data))
  .handler(async ({ data }) => {
    // Sem o token assinado, informar um identificador existente não
    // autoriza mais nenhuma gravação de progresso.
    const { verifyToken } = await import("@/server/portal-token.server");
    if (!(await verifyToken(data.token, data.investorId))) {
      return { ok: false as const, reason: "nao_autorizado" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const { data: row } = await supabaseAdmin
      .from("portal_leads")
      .select("id,journey_percent,journey_first_access_at,journey_started_at,journey_completed_at")
      .eq("id", data.investorId)
      .maybeSingle();
    // Jornada Digital ainda não sincronizada: o evento é ignorado em vez
    // de criar um registro sem origem real.
    if (!row) return { ok: false as const, reason: "lead_inexistente" };

    const current = row as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      journey_last_event_at: now,
      last_activity_at: now,
    };
    if (!current["journey_first_access_at"]) patch["journey_first_access_at"] = now;
    if (data.module === "manual" && !current["journey_started_at"]) {
      patch["journey_started_at"] = now;
    }
    // O percentual nunca regride: representa o ponto mais avançado real.
    if (typeof data.percent === "number") {
      const previous = Number(current["journey_percent"] ?? 0);
      if (data.percent > previous) patch["journey_percent"] = Math.round(data.percent);
    }
    if (data.chapter) patch["journey_chapter"] = data.chapter;
    if (data.stage) patch["journey_stage"] = data.stage;
    if (data.completed && !current["journey_completed_at"]) {
      patch["journey_completed_at"] = now;
      patch["journey_percent"] = 100;
    }

    const { error } = await supabaseAdmin
      .from("portal_leads")
      .update(patch as never)
      .eq("id", data.investorId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("portal_journey_events").insert({
      investor_id: data.investorId,
      event: data.event,
      module: data.module ?? null,
      detail: data.detail ?? null,
      percent: typeof data.percent === "number" ? Math.round(data.percent) : null,
    });
    // Engajamento REAL: sessões, retornos, tempo ativo e primeiro acesso
    // a cada módulo — a base do ranking e dos alertas sem ruído.
    const { applyEngagementEvent } = await import("@/server/portal-engagement.server");
    const engagement = await applyEngagementEvent({
      investorId: data.investorId,
      module: data.module,
    });
    return { ok: true as const, engagement };
  });

/** Histórico auditável dos eventos — consumido pela Ficha do CRM. */
export const listPortalJourneyEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ investorId: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("portal_journey_events")
      .select("id,event,module,detail,percent,created_at")
      .eq("investor_id", data.investorId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ------------------------------------------------------------------ */
/* JORNADA — ESTADO ÚNICO POR MÓDULO (fonte de verdade no servidor)     */
/* ------------------------------------------------------------------ */

export type ModuleProgressStatus = "nao_iniciado" | "em_andamento" | "concluido";
export type ModuleAccessStatus = "nao_acessado" | "acessado" | "concluido";
export type SimulatorStatus = "nao_iniciado" | "iniciado" | "simulado";

export type InvestorJourneyState = {
  investorId: string;
  /** Última atividade REAL do investidor no Portal. */
  lastPortalAt: string | null;
  sessions: number;
  returns: number;
  activeMs: number;
  /** Módulos com pelo menos um acesso registrado. */
  modulesAccessed: number;
  manual: {
    status: ModuleProgressStatus;
    /** Percentual REAL de leitura — nunca estimado. */
    percent: number;
    chapter: string | null;
    firstAt: string | null;
    lastAt: string | null;
    completedAt: string | null;
  };
  /** Progresso mensurável só existe quando o conteúdo o produz. */
  material: { status: ModuleProgressStatus; firstAt: string | null; lastAt: string | null };
  simulador: {
    status: SimulatorStatus;
    simulations: number;
    lastSimulationAt: string | null;
    firstAt: string | null;
    lastAt: string | null;
  };
  /** Conteúdos de leitura: acessado ou não — sem percentual. */
  estrutura: { status: ModuleAccessStatus; lastAt: string | null };
  revista: { status: ModuleAccessStatus; lastAt: string | null; detail: string | null };
  principios: { status: ModuleAccessStatus; lastAt: string | null };
};

/**
 * Estado consolidado da jornada — lido por Ficha, aba Jornada,
 * Engajamento e Central do Executivo. Deriva EXCLUSIVAMENTE do que está
 * persistido: `portal_leads` (progresso do Manual), `portal_engagement`
 * (sessões/tempo/módulos) e `portal_journey_events` (eventos reais).
 * Nenhum percentual é inventado e nenhum estado é inferido do navegador.
 */
export const getInvestorJourneyState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ investorId: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }): Promise<InvestorJourneyState | null> => {
    const { data: lead } = await context.supabase
      .from("portal_leads")
      .select(
        "id,journey_percent,journey_chapter,journey_started_at,journey_completed_at,journey_first_access_at,journey_last_event_at",
      )
      .eq("id", data.investorId)
      .maybeSingle();
    if (!lead) return null;

    const [{ data: eng }, { data: events }] = await Promise.all([
      context.supabase
        .from("portal_engagement")
        .select("sessions,returns,active_ms,modules,modules_last,last_access_at")
        .eq("investor_id", data.investorId)
        .maybeSingle(),
      context.supabase
        .from("portal_journey_events")
        .select("event,module,detail,created_at")
        .eq("investor_id", data.investorId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const row = lead as Record<string, unknown>;
    const first = (eng?.modules as Record<string, string> | null) ?? {};
    const last = (eng?.modules_last as Record<string, string> | null) ?? {};
    const list = (events ?? []) as {
      event: string;
      module: string | null;
      detail: string | null;
      created_at: string;
    }[];

    const has = (event: string) => list.some((e) => e.event === event);
    const simulations = list.filter((e) => e.event === "simulator.completed");
    const revistaEvent = list.find((e) => e.module === "revista");

    const manualPercent = Number(row["journey_percent"] ?? 0);
    const manualCompletedAt = (row["journey_completed_at"] as string) ?? null;
    const manualFirst = first["manual"] ?? (row["journey_started_at"] as string) ?? null;

    const access = (key: string): ModuleAccessStatus =>
      last[key] ? "acessado" : "nao_acessado";

    return {
      investorId: data.investorId,
      lastPortalAt: (eng?.last_access_at as string) ?? (row["journey_last_event_at"] as string) ?? null,
      sessions: Number(eng?.sessions ?? 0),
      returns: Number(eng?.returns ?? 0),
      activeMs: Number(eng?.active_ms ?? 0),
      modulesAccessed: Object.keys(last).filter((k) => k !== "portal").length,
      manual: {
        status: manualCompletedAt
          ? "concluido"
          : manualFirst || manualPercent > 0
            ? "em_andamento"
            : "nao_iniciado",
        percent: manualCompletedAt ? 100 : Math.max(0, Math.min(100, manualPercent)),
        chapter: (row["journey_chapter"] as string) ?? null,
        firstAt: manualFirst,
        lastAt: last["manual"] ?? null,
        completedAt: manualCompletedAt,
      },
      material: {
        // Nunca "em andamento" sem primeiro acesso real.
        status: has("material.completed")
          ? "concluido"
          : last["material"]
            ? "em_andamento"
            : "nao_iniciado",
        firstAt: first["material"] ?? null,
        lastAt: last["material"] ?? null,
      },
      simulador: {
        status: simulations.length > 0 ? "simulado" : last["simulador"] ? "iniciado" : "nao_iniciado",
        simulations: simulations.length,
        lastSimulationAt: simulations[0]?.created_at ?? null,
        firstAt: first["simulador"] ?? null,
        lastAt: last["simulador"] ?? null,
      },
      estrutura: { status: access("estrutura"), lastAt: last["estrutura"] ?? null },
      revista: {
        status: access("revista"),
        lastAt: last["revista"] ?? null,
        detail: revistaEvent?.detail ?? null,
      },
      principios: { status: access("principios"), lastAt: last["principios"] ?? null },
    };
  });
