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
  CrmComposer,
  CrmRecordSection,
  CrmRecordRow,
  CrmCopyRow,
  CrmBlockedRelationship,
  CrmSupervisionView,
  CrmDuplicateNotice,
  CrmStateChip,
  CrmCopyLinkButton,
} from "@/components/crm/crm-conversation";
import {
  User,
  Users,
  Compass,
  CalendarClock,
  Sparkles,
  BellRing,
  Video,
  CalendarPlus,
} from "lucide-react";
import { listMeetings } from "@/lib/meetings";
import { InvestorMeetingDialog } from "@/components/executive/meetings/investor-meeting-dialog";
import { markOutboundMessage } from "@/lib/crm/relationship-state";
import { appendCrmMessage, listCrmMessages } from "@/lib/crm/messages";
import { CRM_ACCESS_LABEL, canSeePrivateContent } from "@/lib/crm/permissions";
import { CrmIntakeItem, CrmIntakeDetail } from "@/components/crm/crm-distribution";
import {
  CrmNewLeadButton,
  CrmNewLeadDialog,
  CrmRedistributeRow,
} from "@/components/crm/crm-new-lead";
import { redistributeLead, isPrivateLead } from "@/lib/crm/lead-intake";
import {
  listIntakeLeads,
  assignLead,
  setSyncWaitHours,
  type CrmIntakeLead,
} from "@/lib/crm/distribution";
import { isCrmAdministrator, isCrmSupervisor } from "@/lib/crm/permissions";
import { loadUsers } from "@/lib/executive-auth";
import { recordCrmEvent } from "@/lib/crm/timeline";
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
import { syncPortalActivity, listPortalActivities } from "@/lib/crm/portal-activity";

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
 * Existe Executivo responsável oficial? Um relacionamento com responsável
 * definido nunca pode ser redistribuído (DEF 2.4.9 §1).
 */
function hasResponsible(item: { ownerId: string; ownerName: string }): boolean {
  return Boolean(item.ownerId) && item.ownerName !== "—";
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
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [messageTick, setMessageTick] = useState(0);
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

  // Histórico da conversa — persistido, nunca some após o envio.
  const messages = useMemo(
    () => (selected && privateOk ? listCrmMessages(selected.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected?.id, privateOk, messageTick],
  );

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

  // Alertas ATIVOS do investidor aberto. O histórico permanente continua
  // exclusivamente na Central de Alertas — o CRM nunca a substitui.
  const investorAlerts = useMemo(
    () =>
      selected && privateOk
        ? listWorkspaceAlerts(session).filter((a) => a.investorId === selected.id)
        : [],
    [selected?.id, privateOk, session, tick],
  );

  // Próxima reunião — apenas a mais próxima ainda válida.
  const nextMeeting = useMemo(() => {
    if (!selected || !privateOk) return null;
    const now = Date.now();
    return (
      listMeetings({ investorId: selected.id })
        .filter(
          (m) =>
            m.status !== "Cancelada" &&
            m.status !== "Concluída" &&
            new Date(m.scheduledAt).getTime() >= now,
        )
        .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))[0] ?? null
    );
  }, [selected?.id, privateOk, tick]);

  const meetingUrl = nextMeeting?.meetUrl ?? nextMeeting?.meetingProviderUrl ?? null;

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
        action={
          isConversas ? <CrmNewLeadButton onOpen={() => setNewLeadOpen(true)} /> : undefined
        }
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
        footer={
          isConversas && selected ? (
            <CrmComposer
              disabled={!privateOk}
              hint="Conversa disponível apenas ao Executivo responsável"
              onSend={(text) => {
                appendCrmMessage({
                  investorId: selected.id,
                  direction: "enviada",
                  body: text,
                  authorId: actor.userId,
                });
                markOutboundMessage(selected.id);
                recordCrmEvent({
                  investorId: selected.id,
                  event: "mensagem_enviada",
                  origin: selected.originLabel,
                  reason: "Mensagem enviada pelo Executivo na conversa do CRM.",
                  ownerId: selected.ownerId,
                  actorId: actor.userId,
                });
                setMessageTick((v) => v + 1);
                setTick((v) => v + 1);
              }}
            />
          ) : undefined
        }
      >
        {isConversas && selected ? (
          selected.access === "bloqueado" ? (
            <CrmBlockedRelationship item={selected} />
          ) : selected.access === "supervisao" ? (
            <CrmSupervisionView item={selected} />
          ) : (
            <>
              <CrmDuplicateNotice item={selected} />
              <CrmThread item={selected} messages={messages} />
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

      <CrmDetailsPane
        open={detailsOpen}
        title="Ficha do investidor"
        onToggle={() => setDetailsOpen((v) => !v)}
      >
        {selected ? (
          <div className="space-y-3">
            {/* Padronizada: todos os investidores exibem os mesmos campos. */}
            <CrmRecordSection title="Dados gerais" tone="azul" icon={User}>
              <CrmRecordRow label="Nome" value={selected.name} />
              <CrmCopyRow label="WhatsApp" value={privateOk ? selected.phone : undefined} />
              <CrmRecordRow label="E-mail" value={privateOk ? selected.email : undefined} />
              <CrmRecordRow label="Cidade" value={privateOk ? selected.city : undefined} />
            </CrmRecordSection>

            <CrmRecordSection title="Relacionamento" tone="verde" icon={Users}>
              {/* Estágio automático — exibido exclusivamente aqui. */}
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-xs text-[color:var(--crm-muted)]">Estágio</span>
                <CrmStateChip item={selected} />
              </div>
              <CrmRecordRow label="Executivo responsável" value={selected.ownerName} />
              <CrmRecordRow label="Workspace" value={selected.workspaceLabel} />
              {/* DEF 2.4.9 §1 — a redistribuição existe apenas enquanto NÃO
                  houver Executivo responsável. Relacionamento já iniciado
                  jamais é redistribuído. */}
              {canManageDistribution && !hasResponsible(selected) ? (
                <div className="pt-1">
                  {isPrivateLead(selected.id) ? (
                    <p className="text-[11px] text-[color:var(--crm-muted)]">
                      Lead particular do Executivo — fora da redistribuição automática.
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <CrmRedistributeRow
                      currentOwnerId={selected.ownerId}
                      onRedistribute={(executiveId) => {
                        redistributeLead({
                          investorId: selected.id,
                          newOwnerId: executiveId,
                          actorId: actor.userId,
                          origin: selected.originLabel,
                        });
                        setTick((v) => v + 1);
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </CrmRecordSection>

            <CrmRecordSection title="Portal do investidor" tone="roxo" icon={Compass}>
              <CrmRecordRow
                label="Manual"
                value={privateOk ? `${selected.readingPct}% concluído` : undefined}
              />
              <CrmRecordRow label="Material" value={undefined} />
              <CrmRecordRow label="Calculadora" value={undefined} />
              <CrmRecordRow
                label="Último acesso ao Portal"
                value={privateOk ? selected.lastActivityLabel : undefined}
              />
            </CrmRecordSection>

            <CrmRecordSection title="Agenda" tone="laranja" icon={CalendarClock}>
              {nextMeeting ? (
                <div className="space-y-2.5">
                  <CrmRecordRow
                    label="Próxima reunião"
                    value={new Date(nextMeeting.scheduledAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  />
                  <div className="flex flex-wrap gap-2">
                    {meetingUrl ? (
                      <>
                        <a
                          href={meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 hover:shadow-sm active:translate-y-0"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Entrar na reunião
                        </a>
                        <CrmCopyLinkButton url={meetingUrl} />
                      </>
                    ) : (
                      <p className="text-[11px] text-[color:var(--crm-muted)]">
                        Link da videoconferência ainda não disponível.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[color:var(--crm-muted)]">
                  Nenhuma reunião agendada.
                </p>
              )}
              {privateOk ? (
                <button
                  type="button"
                  onClick={() => setMeetingOpen(true)}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)] active:translate-y-0"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Agendar
                </button>
              ) : null}
            </CrmRecordSection>

            <CrmRecordSection
              title="IA Corporativa"
              tone="azul-claro"
              icon={Sparkles}
              hint="Sugestões inteligentes de apoio ao Executivo em preparação."
            />

            {/* Apenas alertas ATIVOS — o histórico pertence à Central de Alertas. */}
            <CrmRecordSection
              title="Alertas"
              tone="vermelho"
              icon={BellRing}
              hint="Nenhum alerta ativo para este investidor."
            >
              {investorAlerts.length > 0 ? (
                <ul className="space-y-2.5">
                  {investorAlerts.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-rose-100 bg-rose-50/60 px-2.5 py-2 text-xs leading-relaxed"
                    >
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-rose-600">
                        {WORKSPACE_ALERT_CATEGORY_LABEL[a.category]}
                      </span>
                      <span className="mt-0.5 block">{a.title}</span>
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

      {/* Agendamento já vinculado ao investidor aberto — sem seleção manual. */}
      {meetingOpen && selected && privateOk ? (
        <InvestorMeetingDialog
          investor={selected.investor}
          session={session}
          onClose={() => setMeetingOpen(false)}
          onCreated={() => {
            setMeetingOpen(false);
            recordCrmEvent({
              investorId: selected.id,
              event: "reuniao_agendada",
              origin: selected.originLabel,
              reason: "Reunião criada pelo CRM e vinculada à Central de Reuniões.",
              ownerId: selected.ownerId,
              actorId: actor.userId,
            });
            setTick((v) => v + 1);
          }}
        />
      ) : null}

      {newLeadOpen ? (
        <CrmNewLeadDialog
          ownerId={actor.userId}
          onClose={() => setNewLeadOpen(false)}
          onCreated={(name) => {
            setTick((v) => v + 1);
            void pullLeads()
              .then(() => setTick((v) => v + 1))
              .catch(() => undefined);
            if (typeof window !== "undefined") {
              window.setTimeout(() => setTick((v) => v + 1), 300);
            }
            void name;
          }}
        />
      ) : null}
    </>
  );
}
