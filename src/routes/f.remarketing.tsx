import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OperationalGuard } from "@/components/auth/operational-guard";

/**
 * `/f/remarketing` — layout do ambiente independente de Remarketing.
 *
 * Ambiente OPERACIONAL, com a mesma linguagem visual do CRM: não herda o
 * shell editorial e usa o mesmo guard único dos demais módulos internos.
 * Abre sempre em NOVA ABA a partir do menu do Workspace; a sessão é a
 * mesma da Central do Executivo (compartilhada entre abas).
 */
export const Route = createFileRoute("/f/remarketing")({
  ssr: false,
  component: () => (
    <OperationalGuard>
      <Outlet />
    </OperationalGuard>
  ),
});
