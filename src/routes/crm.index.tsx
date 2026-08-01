import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CrmShell } from "@/components/crm/crm-shell";
import {
  CrmRail,
  CrmListPane,
  CrmMainPane,
  CrmDetailsPane,
  CrmPlaceholder,
} from "@/components/crm/crm-workspace";
import { actorFromSession } from "@/lib/crm/access";
import { CRM_AREAS, type CrmAreaKey } from "@/lib/crm/modules";

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
  const [area, setArea] = useState<CrmAreaKey>("conversas");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const current = CRM_AREAS.find((a) => a.key === area) ?? CRM_AREAS[0];

  return (
    <CrmShell title="CRM de Relacionamento">
      {(session) => {
        const actor = actorFromSession(session);
        return (
          <>
            <CrmRail areas={CRM_AREAS} active={area} onSelect={setArea} />

            <CrmListPane title={current.label} subtitle={current.description}>
              <CrmPlaceholder
                label="Lista em preparação"
                hint="Os registros deste módulo serão exibidos aqui nas próximas etapas."
              />
            </CrmListPane>

            <CrmMainPane
              title={current.label}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen((v) => !v)}
            >
              <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-4">
                <CrmPlaceholder
                  label="Área de trabalho"
                  hint="Espaço reservado para a conversa ou o registro selecionado."
                />
              </div>
            </CrmMainPane>

            <CrmDetailsPane open={detailsOpen} title="Investidor">
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-[color:var(--crm-muted)]">Executivo</dt>
                  <dd className="mt-0.5">{session.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[color:var(--crm-muted)]">Workspace</dt>
                  <dd className="mt-0.5">{actor.workspaceId}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[color:var(--crm-muted)]">Escopo</dt>
                  <dd className="mt-0.5">Somente registros próprios</dd>
                </div>
              </dl>
              <div className="mt-5">
                <CrmPlaceholder
                  label="Ficha do investidor"
                  hint="Dados, contexto e histórico serão exibidos neste painel."
                />
              </div>
            </CrmDetailsPane>
          </>
        );
      }}
    </CrmShell>
  );
}