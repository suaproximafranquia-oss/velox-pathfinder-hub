import { createFileRoute } from "@tanstack/react-router";
import { CrmShell } from "@/components/crm/crm-shell";
import { actorFromSession } from "@/lib/crm/access";
import { CRM_AREAS } from "@/lib/crm/modules";
import { CRM_INTEGRATIONS } from "@/lib/crm/integrations";

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
          <div className="space-y-8">
            <section className="rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-8">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--crm-muted)]">
                Fundação arquitetural
              </p>
              <h1 className="mt-2 text-2xl font-medium tracking-wide">
                CRM de Relacionamento
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--crm-muted)]">
                Estrutura preparada para receber as funcionalidades futuras de
                relacionamento com investidores. Autenticação, usuários e
                permissões são os mesmos do ecossistema. Cada Executivo
                visualizará exclusivamente os próprios relacionamentos.
              </p>
              <dl className="mt-8 grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <dt className="text-[color:var(--crm-muted)]">Executivo</dt>
                  <dd>{session.name}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--crm-muted)]">Workspace</dt>
                  <dd>{actor.workspaceId}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--crm-muted)]">Escopo</dt>
                  <dd>Somente registros próprios</dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="text-sm uppercase tracking-[0.18em] text-[color:var(--crm-muted)]">
                Áreas previstas
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CRM_AREAS.map((area) => (
                  <li
                    key={area.key}
                    className="rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-4"
                  >
                    <p className="text-sm font-medium">{area.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[color:var(--crm-muted)]">
                      {area.description}
                    </p>
                    <span className="mt-3 inline-block rounded-full border border-[color:var(--crm-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--crm-muted)]">
                      {area.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-sm uppercase tracking-[0.18em] text-[color:var(--crm-muted)]">
                Integrações previstas
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {CRM_INTEGRATIONS.map((i) => (
                  <li
                    key={i.key}
                    className="rounded-full border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-3 py-1.5 text-xs text-[color:var(--crm-muted)]"
                  >
                    {i.label}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        );
      }}
    </CrmShell>
  );
}