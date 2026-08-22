/**
 * ENGAJAMENTO DO PORTAL — agregação REAL no servidor.
 *
 * Cada evento verdadeiro da jornada (Manual, Material, Calculadora, IA,
 * retorno ao Portal) atualiza aqui os números que o CRM exibe. Nada é
 * estimado por IA e nada é inventado: sessões, retornos, tempo ativo e
 * módulos derivam exclusivamente dos eventos recebidos.
 *
 * Regras objetivas:
 *  • Sessão nova    → mais de 2 horas sem nenhum evento.
 *  • Tempo ativo    → soma dos intervalos entre eventos, cada intervalo
 *                     limitado a 5 minutos. Aba aberta e parada NÃO conta.
 *  • Primeiro acesso a um módulo → gravado uma única vez.
 */
export const SESSION_GAP_MS = 2 * 60 * 60 * 1000;
export const MAX_ACTIVE_GAP_MS = 5 * 60 * 1000;

export type EngagementUpdate = {
  investorId: string;
  module?: string | undefined;
};

export type EngagementResult = {
  /** Primeiro acesso do investidor a este módulo (gera alerta único). */
  firstModuleAccess: boolean;
  /** O evento inaugurou uma nova sessão (retorno ao Portal). */
  newSession: boolean;
  sessions: number;
  returns: number;
};

/** Módulos comercialmente relevantes — o restante não vira métrica. */
const TRACKED = new Set([
  "manual",
  "material",
  "simulador",
  "ia",
  "portal",
  "revista",
  "estrutura",
  "principios",
]);

export async function applyEngagementEvent(
  input: EngagementUpdate,
): Promise<EngagementResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const module = input.module && TRACKED.has(input.module) ? input.module : null;

  const { data: row } = await supabaseAdmin
    .from("portal_engagement")
    .select("investor_id,sessions,returns,active_ms,modules,modules_last,first_access_at,last_access_at")
    .eq("investor_id", input.investorId)
    .maybeSingle();

  if (!row) {
    const modules = module ? { [module]: now } : {};
    await supabaseAdmin.from("portal_engagement").insert({
      investor_id: input.investorId,
      sessions: 1,
      returns: 0,
      active_ms: 0,
      modules,
      modules_last: modules,
      first_access_at: now,
      last_access_at: now,
      session_started_at: now,
    });
    return { firstModuleAccess: Boolean(module), newSession: true, sessions: 1, returns: 0 };
  }

  const previous = Date.parse(String(row.last_access_at));
  const gap = Number.isFinite(previous) ? nowMs - previous : Number.MAX_SAFE_INTEGER;
  const newSession = gap > SESSION_GAP_MS;
  const modules = { ...((row.modules as Record<string, string> | null) ?? {}) };
  const firstModuleAccess = Boolean(module && !modules[module]);
  if (module && !modules[module]) modules[module] = now;
  // `modules` guarda o PRIMEIRO acesso; `modules_last`, o mais recente —
  // é este que a Ficha do Investidor exibe.
  const modulesLast = { ...((row.modules_last as Record<string, string> | null) ?? {}) };
  if (module) modulesLast[module] = now;

  const patch: Record<string, unknown> = {
    last_access_at: now,
    modules,
    modules_last: modulesLast,
  };
  if (newSession) {
    patch["sessions"] = Number(row.sessions ?? 0) + 1;
    patch["returns"] = Number(row.returns ?? 0) + 1;
    patch["session_started_at"] = now;
  } else if (gap > 0 && gap <= MAX_ACTIVE_GAP_MS) {
    patch["active_ms"] = Number(row.active_ms ?? 0) + gap;
  }

  await supabaseAdmin
    .from("portal_engagement")
    .update(patch as never)
    .eq("investor_id", input.investorId);

  return {
    firstModuleAccess,
    newSession,
    sessions: Number(patch["sessions"] ?? row.sessions ?? 0),
    returns: Number(patch["returns"] ?? row.returns ?? 0),
  };
}
