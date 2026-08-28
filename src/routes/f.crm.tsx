import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OperationalGuard } from "@/components/auth/operational-guard";

/**
 * `/f/crm` — layout do módulo CRM de Relacionamento.
 *
 * Ambiente operacional: mesmo guard único dos demais módulos internos
 * (`OperationalGuard`) e sem SSR, já que a sessão do Workspace vive no
 * navegador. Nenhuma rota existente é alterada.
 */
export const Route = createFileRoute("/f/crm")({
  ssr: false,
  component: () => (
    <OperationalGuard>
      <Outlet />
    </OperationalGuard>
  ),
});
