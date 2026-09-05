import { WorkspaceResourceGuard } from "@/components/executive/workspace-resource-guard";
import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * CENTRAL DE HOMOLOGAÇÃO — layout do ambiente oficial de testes.
 *
 * Rota-pai apenas de composição: nenhuma regra, nenhum guard novo. O
 * guard de sessão continua vindo de `/f/executivo` e cada área filha
 * mantém exatamente o comportamento que já tinha.
 *
 * Áreas atuais:
 *   • `/f/executivo/homologacao`             → Motor de Relacionamento
 *   • `/f/executivo/homologacao/acao-do-dia` → Ação do Dia (demonstração)
 *
 * Novos testes futuros entram como novas rotas filhas — sem tocar nas
 * existentes.
 */
export const Route = createFileRoute("/f/executivo/homologacao")({
  component: () => (
    <WorkspaceResourceGuard resource="homologacao">
      <Outlet />
    </WorkspaceResourceGuard>
  ),
});
