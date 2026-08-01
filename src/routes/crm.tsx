import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * `/crm` — layout do módulo CRM de Relacionamento.
 *
 * Faz parte do mesmo projeto, mesmo servidor e mesmo ambiente. Nenhuma
 * rota existente é alterada. O gate de autenticação vive no shell do
 * módulo (`CrmShell`), reutilizando a sessão da Central do Executivo.
 */
export const Route = createFileRoute("/crm")({
  component: () => <Outlet />,
});