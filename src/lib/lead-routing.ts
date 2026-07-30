/**
 * Roteamento oficial dos Leads (Prompt 7C).
 *
 * Regra única e inegociável:
 *  - Lead originado por LINK PERSONALIZADO de um colaborador → escopo
 *    "green_sales", vinculado permanentemente àquele executivo.
 *  - Lead originado pelo acesso institucional (Home pública, campanha,
 *    QR Code sem executivo) → escopo "portal", sem vínculo individual.
 *
 * Nenhuma tela deve reimplementar esta decisão: sempre consumir
 * `resolveLeadScope`.
 */
import type { WorkspaceScope } from "@/lib/portal-workspace";

export function resolveLeadScope(input: {
  personalized?: boolean;
  responsibleExecutiveId?: string | null;
}): WorkspaceScope {
  return input.personalized && input.responsibleExecutiveId
    ? "green_sales"
    : "portal";
}