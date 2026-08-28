import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * `/f` — layout da unidade de negócio Velox Financeira.
 *
 * Camada NEUTRA: não autentica e não altera o visual. Existe para dar um
 * pai único a todo o prefixo da unidade — inclusive aos links públicos
 * personalizados (`/f/{executivo}`), que continuam com SSR normal.
 * O bloqueio de acesso vive nos layouts operacionais
 * (`/f/executivo`, `/f/crm`, `/f/remarketing`, `/f/portal-leads`).
 */
export const Route = createFileRoute("/f")({
  component: () => <Outlet />,
});
