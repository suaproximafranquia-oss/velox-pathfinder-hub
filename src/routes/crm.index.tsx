import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CrmShell } from "@/components/crm/crm-shell";
import {
  CrmRail,
  CrmListPane,
  CrmMainPane,
  CrmDetailsPane,
  CrmPlaceholder,
} from "@/components/crm/crm-workspace";
import {
  CrmConversationItem,
  CrmConversationHeader,
  CrmThread,
  CrmRecordSection,
  CrmRecordRow,
} from "@/components/crm/crm-conversation";
import { actorFromSession } from "@/lib/crm/access";
import { CRM_AREAS, type CrmAreaKey } from "@/lib/crm/modules";
import { listConversations, filterConversations } from "@/lib/crm/relationships";
import type { ExecutiveSession } from "@/lib/executive-auth";
import { onEvent } from "@/lib/events/bus";
import { pullLeads, subscribeLeads } from "@/lib/portal-leads-sync";

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
      {(session) => <CrmWorkspace session={session} />}
    </CrmShell>
  );
}

/**
 * Ambiente operacional do CRM.
 *
 * Os investidores exibidos são EXATAMENTE os do Workspace do Executivo:
 * o CRM apenas lê `listAllInvestors()` através de `listConversations`,
 * sem criar base paralela. Qualquer alteração feita no Portal do
 * Executivo reflete aqui automaticamente (eventos + tempo real de Leads).
 */
function CrmWorkspace({ session }: { session: ExecutiveSession }) {
  const [area, setArea] = useState<CrmAreaKey>("conversas");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const current = CRM_AREAS.find((a) => a.key === area) ?? CRM_AREAS[0];
  const actor = actorFromSession(session);

  // Sincronização com a fonte oficial (Portal do Executivo).
  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        setTick((v) => v + 1);
      });
    };
    const offEvents = onEvent(refresh);
    void pullLeads().then(refresh).catch(refresh);
    const offLeads = subscribeLeads(() => {
      void pullLeads().then(refresh).catch(refresh);
    });
    return () => {
      offEvents();
      offLeads();
    };
  }, []);

  const conversations = useMemo(
    () => listConversations(actor),
    // `tick` reflete alterações vindas do Portal do Executivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actor.userId, actor.role, actor.workspaceId, tick],
  );
  const visible = useMemo(
    () => filterConversations(conversations, query),
    [conversations, query],
  );
  const selected =
    visible.find((c) => c.id === selectedId) ??
    conversations.find((c) => c.id === selectedId) ??
    visible[0] ??
    null;

  const isConversas = area === "conversas";

  return (
    <>
      <CrmRail areas={CRM_AREAS} active={area} onSelect={setArea} />

      <CrmListPane
        title={isConversas ? "Conversas" : current.label}
        subtitle={isConversas ? "Investidores do seu Workspace" : current.description}
        count={isConversas ? visible.length : undefined}
        query={isConversas ? query : undefined}
        onQueryChange={isConversas ? setQuery : undefined}
        searchPlaceholder="Buscar investidor"
      >
        {isConversas ? (
          visible.length > 0 ? (
            <div className="space-y-0.5">
              {visible.map((item) => (
                <CrmConversationItem
                  key={item.id}
                  item={item}
                  active={selected?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          ) : (
            <CrmPlaceholder
              label={query ? "Nenhum investidor encontrado" : "Nenhum investidor no Workspace"}
              hint={
                query
                  ? "Ajuste a busca para localizar o investidor desejado."
                  : "Os investidores do Portal do Executivo aparecem aqui automaticamente."
              }
            />
          )
        ) : (
          <CrmPlaceholder
            label="Módulo em preparação"
            hint="Os registros deste módulo serão exibidos aqui nas próximas etapas."
          />
        )}
      </CrmListPane>

      <CrmMainPane
        title={current.label}
        header={
          isConversas && selected ? <CrmConversationHeader item={selected} /> : undefined
        }
        detailsOpen={detailsOpen}
        onToggleDetails={() => setDetailsOpen((v) => !v)}
      >
        {isConversas && selected ? (
          <CrmThread item={selected} />
        ) : (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-4">
            <CrmPlaceholder
              label={
                isConversas
                  ? "Selecione um investidor"
                  : `${current.label} em preparação`
              }
              hint={
                isConversas
                  ? "Escolha um investidor na lista para abrir o relacionamento."
                  : current.description
              }
            />
          </div>
        )}
      </CrmMainPane>

      <CrmDetailsPane open={detailsOpen} title="Ficha do investidor">
        {selected ? (
          <div className="space-y-4">
            <CrmRecordSection title="Dados gerais">
              <CrmRecordRow label="Nome" value={selected.name} />
              <CrmRecordRow label="Telefone" value={selected.phone} />
              <CrmRecordRow label="E-mail" value={selected.email} />
              <CrmRecordRow label="Cidade" value={selected.city} />
            </CrmRecordSection>

            <CrmRecordSection title="Relacionamento">
              <CrmRecordRow label="Situação" value={selected.stateLabel} />
              <CrmRecordRow label="Status" value={selected.statusLabel} />
              <CrmRecordRow label="Origem" value={selected.originLabel} />
              <CrmRecordRow label="Executivo" value={selected.ownerName} />
              <CrmRecordRow label="Workspace" value={selected.workspaceLabel} />
            </CrmRecordSection>

            <CrmRecordSection title="Portal">
              <CrmRecordRow label="Leitura do Manual" value={`${selected.readingPct}%`} />
              <CrmRecordRow label="Última movimentação" value={selected.lastActivityLabel} />
              <CrmRecordRow label="Último evento" value={selected.lastInteraction} />
            </CrmRecordSection>

            <CrmRecordSection
              title="Agenda"
              hint="Reuniões e compromissos do investidor serão exibidos aqui."
            />
            <CrmRecordSection
              title="Timeline"
              hint="Linha do tempo cronológica do relacionamento."
            />
            <CrmRecordSection
              title="Histórico"
              hint="Registro consolidado das interações anteriores."
            />
            <CrmRecordSection
              title="IA"
              hint="Sugestões e leituras analíticas de apoio ao Executivo."
            />
            <CrmRecordSection
              title="Alertas"
              hint="Avisos e acionamentos vinculados a este investidor."
            />
          </div>
        ) : (
          <CrmPlaceholder
            label="Nenhum investidor selecionado"
            hint="A ficha operacional é exibida ao selecionar uma conversa."
          />
        )}
      </CrmDetailsPane>
    </>
  );
}
