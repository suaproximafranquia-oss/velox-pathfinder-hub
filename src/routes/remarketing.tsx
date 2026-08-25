import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * `/remarketing` — layout do ambiente independente de Remarketing.
 *
 * Mesmo padrão do `/crm`: ambiente próprio, com URL dedicada, aberto em
 * NOVA ABA do navegador a partir do menu do Workspace. A aba original
 * permanece intacta e o usuário alterna entre os ambientes pelas abas.
 * Nenhuma rota existente é alterada. A sessão é a mesma da Central do
 * Executivo (compartilhada entre abas).
 */
export const Route = createFileRoute("/remarketing")({
  component: () => <Outlet />,
});
