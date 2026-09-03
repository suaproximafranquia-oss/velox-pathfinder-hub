/**
 * NAVEGAÇÃO INTERNA DA CENTRAL DE HOMOLOGAÇÃO.
 *
 * Apenas apresentação: cada aba é uma rota filha própria, com URL
 * compartilhável. Nenhuma regra de acesso é criada aqui — a Central
 * continua visível somente para quem já a acessa hoje.
 */
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/f/executivo/homologacao", label: "Motor de Relacionamento", exact: true },
  { to: "/f/executivo/homologacao/acao-do-dia", label: "Ação do Dia — Demonstração" },
] as const;

export function HomologationTabs() {
  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          activeOptions={{ exact: "exact" in tab ? tab.exact : false }}
          className={cn(
            "rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]",
          )}
          activeProps={{
            className:
              "rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--gold)]/10 px-4 py-1.5 text-xs text-[color:var(--gold)]",
          }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
