import { createFileRoute } from "@tanstack/react-router";
import { CrmShell } from "@/components/crm/crm-shell";
import { actorFromSession } from "@/lib/crm/access";

export const Route = createFileRoute("/crm/")({
  head: () => ({
    meta: [
      { title: "CRM de Relacionamento — Portal Velox" },
      {
        name: "description",
        content:
          "Módulo de relacionamento dos Executivos de Expansão do Portal Velox.",
      },
      { property: "og:title", content: "CRM de Relacionamento — Portal Velox" },
      {
        property: "og:description",
        content:
          "Módulo de relacionamento dos Executivos de Expansão do Portal Velox.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrmHome,
});

function CrmHome() {
  return (
    <CrmShell title="CRM de Relacionamento">
      {(session) => {
        const actor = actorFromSession(session);
        return (
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-8">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
              Fundação técnica
            </p>
            <h1 className="mt-2 font-display text-2xl tracking-wide">
              CRM de Relacionamento
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              Estrutura preparada para receber as funcionalidades futuras de
              relacionamento com investidores. Autenticação, usuários e
              permissões são os mesmos do ecossistema Velox. Cada Executivo
              visualizará exclusivamente os próprios relacionamentos.
            </p>
            <dl className="mt-8 grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-[color:var(--muted-foreground)]">Executivo</dt>
                <dd>{session.name}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--muted-foreground)]">Workspace</dt>
                <dd>{actor.workspaceId}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--muted-foreground)]">Escopo</dt>
                <dd>Somente registros próprios</dd>
              </div>
            </dl>
          </section>
        );
      }}
    </CrmShell>
  );
}