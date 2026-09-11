/**
 * Suspensão operacional temporária — Workspace Financeira /f.
 *
 * A integração e o espelho `crm_leads` continuam ativos. Enquanto esta
 * trava estiver ligada, somente os quatro leads autorizados podem criar
 * ou recriar cards operacionais locais e seus derivados.
 */
export const GREENSALES_WORKSPACE_CREATION_SUSPENDED = true;

export const GREENSALES_WORKSPACE_ALLOWED_EXTERNAL_IDS = new Set([
  "59034",
  "59037",
  "59081",
  "59279",
]);

export function mayCreateGreenSalesWorkspaceCard(externalId: string): boolean {
  return (
    !GREENSALES_WORKSPACE_CREATION_SUSPENDED ||
    GREENSALES_WORKSPACE_ALLOWED_EXTERNAL_IDS.has(String(externalId))
  );
}