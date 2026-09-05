/**
 * CLASSIFICAÇÃO DE CICLOS — LEITURA (BLOCO 1). SERVER ONLY.
 *
 * Somente leitura: consulta as instâncias de cadência e devolve quais
 * leads pertencem a CICLO HISTÓRICO. Nada é gravado, apagado ou
 * reescrito — a decisão é sempre da função de domínio `classifyCycle`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { classifyCycle } from "@/lib/relationship/cycle";
import { loadCadenceActivationDate } from "@/server/crm/automation.server";

/**
 * Leads cujo ciclo ativo é histórico. Lead sem ciclo registrado NÃO
 * entra nesta lista: sem vínculo suficiente, nada é inventado e o
 * comportamento atual é preservado.
 */
export async function listHistoricalCycleLeadIds(
  leadIds: readonly string[],
  scope: "production" | "homologation" = "production",
): Promise<Set<string>> {
  const historical = new Set<string>();
  const unique = [...new Set(leadIds.filter(Boolean))];
  if (unique.length === 0) return historical;

  const mark = await loadCadenceActivationDate().catch(() => null);
  if (!mark) return historical;

  const { data } = await supabaseAdmin
    .from("relationship_cadences")
    .select("lead_id,operational_since,started_at,updated_at,active")
    .eq("scope", scope)
    .is("run_id", null)
    .eq("active", true)
    .in("lead_id", unique);

  for (const row of data ?? []) {
    const verdict = classifyCycle(
      {
        operationalSince: (row as { operational_since?: string | null }).operational_since ?? null,
        startedAt: row.started_at ?? null,
        updatedAt: row.updated_at ?? null,
      },
      mark,
    );
    if (!verdict.operational) historical.add(row.lead_id);
  }

  return historical;
}
