/**
 * CARGA DAS ETAPAS RECONHECIDAS (SERVER ONLY).
 *
 * ETAPAS CONHECIDAS = CONFIGURAÇÃO OFICIAL DO MOTOR (`STEPS` + etapas
 * fora da cadência, já embutidas em `BASE_STEP_KEYS`) + ETAPAS JÁ
 * EXISTENTES NO HISTÓRICO.
 *
 * A Biblioteca DEIXOU de ser fonte de existência de etapa: uma chave
 * cadastrada lá não vira etapa do motor. A Biblioteca guarda apenas a
 * mensagem e o versionamento das etapas que a configuração reconhece.
 *
 * Este módulo apenas LÊ. Não cria tabela, não altera schema, não decide
 * ordem, prazo ou fluxo.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerKnownSteps } from "@/lib/relationship/step-registry";

/** Cache simples por processo — evita ir ao banco a cada validação. */
const TTL_MS = 60_000;
let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function load(): Promise<void> {
  const keys: string[] = [];

  // Histórico — uma etapa já utilizada continua interpretável.

  const sends = await supabaseAdmin.from("relationship_message_sends").select("step").limit(5000);
  for (const row of sends.data ?? []) if (row.step) keys.push(row.step);

  const queue = await supabaseAdmin.from("relationship_queue").select("step").limit(5000);
  for (const row of queue.data ?? []) if (row.step) keys.push(row.step);

  const cadences = await supabaseAdmin
    .from("relationship_cadences")
    .select("current_step, executed_steps")
    .limit(5000);
  for (const row of cadences.data ?? []) {
    if (row.current_step) keys.push(row.current_step);
    const executed = row.executed_steps;
    if (Array.isArray(executed)) {
      for (const step of executed) if (typeof step === "string" && step) keys.push(step);
    }
  }

  registerKnownSteps(keys);
  loadedAt = Date.now();
}

/**
 * Garante que o conjunto dinâmico esteja carregado antes de validar.
 * Falha de leitura NÃO derruba a operação: o motor continua com as
 * etapas declaradas em código.
 */
export async function ensureKnownSteps(): Promise<void> {
  if (Date.now() - loadedAt < TTL_MS) return;
  inflight ??= load()
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  await inflight;
}
