/**
 * RELÓGIO DO AMBIENTE — SERVER ONLY (somente Financeira /f, homologação).
 *
 * Não existe segundo motor, segunda régua nem simulação paralela: o que
 * muda aqui é APENAS a fonte de tempo consultada pelo motor, pelas
 * cadências e pela Ação do Dia. Quando o relógio acelerado está
 * desligado (padrão, e sempre em produção), `envNow()` devolve
 * exatamente `new Date()`.
 *
 * Estado persistido: uma linha em `test_batches`
 * (`kind = environment_clock`), sem nova tabela nem migração.
 *
 * Fail-closed: qualquer falha de leitura mantém o relógio REAL.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createVirtualClock, realClock, type EngineClock } from "@/lib/relationship/clock";

export const ENVIRONMENT_CLOCK_KIND = "environment_clock";
export const ENVIRONMENT_CLOCK_ID = "environment-clock-f";
/** 5 minutos reais = 1 dia lógico. */
export const ENVIRONMENT_CLOCK_FACTOR = 288;

type ClockState = {
  active: boolean;
  factor: number;
  startedAtReal: string;
  startedAtVirtual: string;
};

const INACTIVE: ClockState = {
  active: false,
  factor: 1,
  startedAtReal: new Date(0).toISOString(),
  startedAtVirtual: new Date(0).toISOString(),
};

let cache: { state: ClockState; loadedAt: number } | null = null;
let inflight: Promise<ClockState> | null = null;
/** Enquanto o estado não muda, a hora continua correndo sozinha. */
const TTL_MS = 10_000;

function parseState(row: Record<string, any> | null): ClockState {
  if (!row || String(row.status) !== "ATIVO") return INACTIVE;
  const raw = (row.scenarios ?? {}) as Record<string, unknown>;
  const startedAtReal = String(raw["startedAtReal"] ?? row.started_at ?? "");
  const startedAtVirtual = String(raw["startedAtVirtual"] ?? startedAtReal);
  const factor = Number(raw["factor"] ?? ENVIRONMENT_CLOCK_FACTOR);
  if (!startedAtReal || Number.isNaN(new Date(startedAtReal).getTime())) return INACTIVE;
  if (!Number.isFinite(factor) || factor <= 1) return INACTIVE;
  return { active: true, factor, startedAtReal, startedAtVirtual };
}

async function readState(): Promise<ClockState> {
  try {
    const { data, error } = await supabaseAdmin
      .from("test_batches")
      .select("id,status,scenarios,started_at")
      .eq("id", ENVIRONMENT_CLOCK_ID)
      .maybeSingle();
    if (error) return INACTIVE;
    return parseState((data ?? null) as Record<string, any> | null);
  } catch {
    return INACTIVE;
  }
}

/** Recarrega o estado do relógio (chamado nas entradas server-side). */
export async function refreshEnvironmentClock(): Promise<ClockState> {
  inflight ??= readState()
    .then((state) => {
      cache = { state, loadedAt: Date.now() };
      return state;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function currentState(): ClockState {
  if (!cache) {
    void refreshEnvironmentClock();
    return INACTIVE;
  }
  if (Date.now() - cache.loadedAt > TTL_MS) void refreshEnvironmentClock();
  return cache.state;
}

/** Instante atual do ambiente: real em produção, lógico na homologação. */
export function envNow(): Date {
  const state = currentState();
  if (!state.active) return new Date();
  const elapsed = Date.now() - new Date(state.startedAtReal).getTime();
  return new Date(new Date(state.startedAtVirtual).getTime() + Math.max(0, elapsed) * state.factor);
}

export function envNowIso(): string {
  return envNow().toISOString();
}

/** Relógio do motor: mesma abstração `EngineClock` já usada pela régua. */
export function environmentClock(): EngineClock {
  const state = currentState();
  if (!state.active) return realClock;
  return createVirtualClock({
    startedAtReal: state.startedAtReal,
    startedAtVirtual: state.startedAtVirtual,
    factor: state.factor,
  });
}

/** Carregado sob demanda para não criar ciclo de importação. */
async function validationLeads(): Promise<ReadonlyArray<{ crmId: string; leadId: string; name: string }>> {
  const { CONTROLLED_LEADS } = await import("@/server/relationship/controlled-test.server");
  return CONTROLLED_LEADS as unknown as ReadonlyArray<{ crmId: string; leadId: string; name: string }>;
}

export type EnvironmentClockStatus = {
  active: boolean;
  factor: number;
  realNowIso: string;
  logicalNowIso: string;
  startedAtReal: string | null;
  startedAtVirtual: string | null;
  leads: Array<{ leadId: string; name: string }>;
};

export async function environmentClockStatus(): Promise<EnvironmentClockStatus> {
  const state = await refreshEnvironmentClock();
  const leads = await validationLeads();
  return {
    active: state.active,
    factor: state.active ? state.factor : 1,
    realNowIso: new Date().toISOString(),
    logicalNowIso: envNowIso(),
    startedAtReal: state.active ? state.startedAtReal : null,
    startedAtVirtual: state.active ? state.startedAtVirtual : null,
    leads: leads.map((lead) => ({ leadId: lead.leadId, name: lead.name })),
  };
}

/**
 * TRAVA DE SEGURANÇA: o relógio acelerado só liga quando o Workspace /f
 * contém EXCLUSIVAMENTE os quatro cadastros de validação. Assim ele
 * nunca alcança um ambiente com leads reais em operação.
 */
async function assertOnlyValidationLeads(): Promise<void> {
  const allowed = new Set(["59034", "59037", "59081", "59279"]);
  const { data, error } = await supabaseAdmin
    .from("portal_leads")
    .select("external_id")
    .eq("scope", "green_sales")
    .eq("external_source", "greensales")
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ external_id: string | null }>;
  const found = new Set(rows.map((row) => String(row.external_id ?? "")));
  const exactMatch = rows.length === allowed.size
    && found.size === allowed.size
    && [...found].every((externalId) => allowed.has(externalId));
  if (!exactMatch) {
    throw new Error(
      `Relógio acelerado bloqueado: o Workspace contém ${rows.length} cadastros; esperados apenas os 4 de validação.`,
    );
  }
}

export async function activateEnvironmentClock(
  actorId: string,
  actorName: string,
): Promise<EnvironmentClockStatus> {
  await assertOnlyValidationLeads();
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin.from("test_batches").upsert(
    {
      id: ENVIRONMENT_CLOCK_ID,
      kind: ENVIRONMENT_CLOCK_KIND,
      label: "Relógio acelerado — homologação /f",
      status: "ATIVO",
      lead_count: (await validationLeads()).length,
      created_by: actorId,
      created_by_name: actorName,
      started_at: nowIso,
      ends_at: null,
      scenarios: {
        factor: ENVIRONMENT_CLOCK_FACTOR,
        startedAtReal: nowIso,
        // O tempo lógico continua de onde o tempo real está agora.
        startedAtVirtual: nowIso,
      } as never,
    } as never,
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  cache = null;
  return environmentClockStatus();
}

export async function deactivateEnvironmentClock(): Promise<EnvironmentClockStatus> {
  const { error } = await supabaseAdmin
    .from("test_batches")
    .update({ status: "ENCERRADO", ends_at: new Date().toISOString() } as never)
    .eq("id", ENVIRONMENT_CLOCK_ID);
  if (error) throw new Error(error.message);
  cache = null;
  return environmentClockStatus();
}
