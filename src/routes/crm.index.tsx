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
  CrmBlockedRelationship,
  CrmSupervisionView,
  CrmDuplicateNotice,
} from "@/components/crm/crm-conversation";
import { CRM_ACCESS_LABEL, canSeePrivateContent } from "@/lib/crm/permissions";
import { CrmIntakeItem, CrmIntakeDetail } from "@/components/crm/crm-distribution";
import {
  listIntakeLeads,
  assignLead,
  setSyncWaitHours,
  type CrmIntakeLead,
} from "@/lib/crm/distribution";
import { isCrmAdministrator, isCrmSupervisor } from "@/lib/crm/permissions";
import { loadUsers } from "@/lib/executive-auth";
import {
  recordCrmEvent,
  listCrmTimeline,
  CRM_TIMELINE_LABEL,
  formatCrmTimestamp,
} from "@/lib/crm/timeline";
import { actorFromSession } from "@/lib/crm/access";
import { CRM_AREAS, type CrmAreaKey } from "@/lib/crm/modules";
import { listConversations, filterConversations } from "@/lib/crm/relationships";
import type { ExecutiveSession } from "@/lib/executive-auth";
import { onEvent } from "@/lib/events/bus";
import { pullLeads, subscribeLeads } from "@/lib/portal-leads-sync";
import {
  listWorkspaceAlerts,
  WORKSPACE_ALERT_CATEGORY_LABEL,
} from "@/lib/workspace-alerts";

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
  // Conversas já abertas nesta sessão — o indicador some ao abrir.
  const [openedIds, setOpenedIds] = useState<string[]>([]);
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
  const isDistribuicao = area === "distribuicao";
  const canManageDistribution =
    isCrmAdministrator(actor.role) || isCrmSupervisor(actor.role);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Relógio de baixa frequência para o contador da janela de sincronização.
  useEffect(() => {
    if (!isDistribuicao) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [isDistribuicao]);

  const intake = useMemo<CrmIntakeLead[]>(
    () => (isDistribuicao ? listIntakeLeads() : []),
    [isDistribuicao, now, tick],
  );
  const selectedIntake =
    intake.find((l) => l.id === intakeId) ?? intake[0] ?? null;
  const executives = useMemo(
    () => loadUsers().filter((u) => u.status === "ativo").map((u) => ({ id: u.id, name: u.name })),
    [tick],
  );
  const executiveName = (id?: string) =>
    executives.find((e) => e.id === id)?.name ?? "—";
  const privateOk = selected ? canSeePrivateContent(selected.access) : false;

  // Registro automático da ocorrência — sem interação do usuário.
  useEffect(() => {
    if (!selected) return;
    recordCrmEvent({
      investorId: selected.id,
      event: selected.access === "bloqueado" ? "acesso_bloqueado" : "conversa_aberta",
      origin: selected.originLabel,
      reason:
        selected.access === "bloqueado"
          ? "Investidor pertencente a outro Executivo."
          : `Conversa aberta em modo ${CRM_ACCESS_LABEL[selected.access]}.`,
      ownerId: selected.ownerId,
      actorId: actor.userId,
    });
  }, [selected?.id, selected?.access, actor.userId]);

  // Ao selecionar, a conversa deixa de estar "nova".
  useEffect(() => {
    if (!selected) return;
    setOpenedIds((prev) => (prev.includes(selected.id) ? prev : [...prev, selected.id]));
  }, [selected?.id]);

  const timeline = useMemo(
    () => (selected && privateOk ? listCrmTimeline(selected.id).slice(0, 6) : []),
    [selected?.id, privateOk, tick],
  );

  // Alertas ATIVOS do investidor aberto. O histórico permanente continua
  // exclusivamente na Central de Alertas — o CRM nunca a substitui.
  const investorAlerts = useMemo(
    () =>
      selected && privateOk
        ? listWorkspaceAlerts(session).filter((a) => a.investorId === selected.id)
        : [],
    [selected?.id, privateOk, session, tick],
  );

  return (
    <>
      <CrmRail areas={CRM_AREAS} active={area} onSelect={setArea} />

      <CrmListPane
        title={isConversas ? "Conversas" : current.label}
        subtitle={isConversas ? "Investidores do seu Workspace" : current.description}
        count={isConversas ? visible.length : isDistribuicao ? intake.length : undefined}
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
                  unread={item.state === "novo" && !openedIds.includes(item.id)}
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
        ) : isDistribuicao ? (
          intake.length > 0 ? (
            <div className="space-y-0.5">
              {intake.map((lead) => (
                <CrmIntakeItem
                  key={lead.id}
                  lead={lead}
                  now={now}
                  active={selectedIntake?.id === lead.id}
                  onSelect={() => setIntakeId(lead.id)}
                />
              ))}
            </div>
          ) : (
            <CrmPlaceholder
              label="Nenhum contato aguardando"
              hint="Novos contatos recebidos no número institucional aparecem aqui automaticamente."
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
          selected.access === "bloqueado" ? (
            <CrmBlockedRelationship item={selected} />
          ) : selected.access === "supervisao" ? (
            <CrmSupervisionView item={selected} />
          ) : (
            <>
              <CrmDuplicateNotice item={selected} />
              <CrmThread item={selected} />
            </>
          )
        ) : isDistribuicao && selectedIntake ? (
          <CrmIntakeDetail
            lead={selectedIntake}
            now={now}
            executives={executives}
            ownerName={executiveName(selectedIntake.ownerId)}
            canManage={canManageDistribution}
            onAssign={(executiveId) => {
              assignLead(selectedIntake.id, executiveId, actor.userId);
              setTick((v) => v + 1);
            }}
            onChangeWait={(h) => {
              setSyncWaitHours(h);
              setTick((v) => v + 1);
            }}
          />
        ) : (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-4">
            <CrmPlaceholder
              label={
                isConversas
                  ? "Selecione um investidor"
                  : isDistribuicao
                    ? "Nenhum Lead selecionado"
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
              {privateOk ? (
                <>
                  <CrmRecordRow label="Telefone" value={selected.phone} />
                  <CrmRecordRow label="E-mail" value={selected.email} />
                  <CrmRecordRow label="Cidade" value={selected.city} />
                </>
              ) : null}
            </CrmRecordSection>

            <CrmRecordSection title="Relacionamento">
              <CrmRecordRow label="Origem" value={selected.originLabel} />
              <CrmRecordRow label="Executivo" value={selected.ownerName} />
              <CrmRecordRow label="Workspace" value={selected.workspaceLabel} />
              <CrmRecordRow label="Acesso" value={CRM_ACCESS_LABEL[selected.access]} />
            </CrmRecordSection>

            {privateOk ? (
              <CrmRecordSection title="Portal do investidor">
                <CrmRecordRow label="Manual" value={`${selected.readingPct}% concluído`} />
                <CrmRecordRow label="Material" value="—" />
                <CrmRecordRow label="Calculadora" value="—" />
                <CrmRecordRow label="Último acesso" value={selected.lastActivityLabel} />
              </CrmRecordSection>
            ) : (
              <CrmRecordSection
                title="Portal do investidor"
                hint="Conteúdo privado do relacionamento — visível apenas ao Executivo responsável."
              />
            )}

            <CrmRecordSection
              title="Agenda"
              hint="Reuniões e compromissos do investidor serão exibidos aqui."
            />
            {privateOk ? (
              <CrmRecordSection title="Timeline">
                {timeline.length > 0 ? (
                  <ul className="space-y-2">
                    {timeline.map((e) => (
                      <li key={e.id} className="text-xs leading-relaxed">
                        <span className="block text-[color:var(--crm-muted)]">
                          {formatCrmTimestamp(e.at)} · {e.origin}
                        </span>
                        <span className="block">{CRM_TIMELINE_LABEL[e.event]}</span>
                        <span className="block text-[color:var(--crm-muted)]">{e.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[color:var(--crm-muted)]">
                    Nenhuma ocorrência registrada até o momento.
                  </p>
                )}
              </CrmRecordSection>
            ) : (
              <CrmRecordSection
                title="Timeline"
                hint="Linha do tempo privada do relacionamento."
              />
            )}
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
              hint="Nenhum alerta ativo para este investidor."
            >
              {investorAlerts.length > 0 ? (
                <ul className="space-y-2">
                  {investorAlerts.map((a) => (
                    <li key={a.id} className="text-xs leading-relaxed">
                      <span className="block text-[color:var(--crm-muted)]">
                        {WORKSPACE_ALERT_CATEGORY_LABEL[a.category]}
                      </span>
                      <span className="block">{a.title}</span>
                    </li>
                  ))}
                </ul>
              ) : undefined}
            </CrmRecordSection>
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
