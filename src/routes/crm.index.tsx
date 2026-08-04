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
  CrmJourneyBadge,
  CrmStartRelationshipDialog,
} from "@/components/crm/crm-conversation";
import {
  User,
  Users,
  Compass,
  CalendarClock,
  Video,
  CalendarPlus,
  Handshake,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { listMeetings } from "@/lib/meetings";
import { InvestorMeetingDialog } from "@/components/executive/meetings/investor-meeting-dialog";
import {
  markOutboundMessage,
  markWindowOpened,
  windowAnchorAt,
} from "@/lib/crm/relationship-state";
import { resolveCrmWindow } from "@/lib/crm/templates";
import { CRM_THEMES, getUserCrmTheme, setUserCrmTheme, type CrmThemeId } from "@/lib/crm/themes";
import { appendCrmMessage, listCrmMessages } from "@/lib/crm/messages";
import { CRM_ACCESS_LABEL, canSeePrivateContent } from "@/lib/crm/permissions";
import { CrmIntakeItem, CrmIntakeDetail } from "@/components/crm/crm-distribution";
import {
  CrmNewLeadButton,
  CrmNewLeadDialog,
  CrmRedistributeRow,
} from "@/components/crm/crm-new-lead";
import { CrmNewChatButton, CrmNewChatDialog } from "@/components/crm/crm-new-chat";
import { withSignature } from "@/lib/crm/signature";
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
import { onSync } from "@/lib/sync-bus";
import { pullLeads, subscribeLeads } from "@/lib/portal-leads-sync";
import { syncPortalActivity, listPortalActivities } from "@/lib/crm/portal-activity";
import {
  startRelationship,
  archiveRelationship,
  restoreRelationship,
} from "@/lib/crm/commercial";
import { isPortalReleased, releasePortal } from "@/lib/crm/portal-release";
import { isCrmSupervisor as isSupervisorRole } from "@/lib/crm/permissions";
import { Unlock } from "lucide-react";

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
  const [newChatOpen, setNewChatOpen] = useState(false);
  // Arquivar é organização pessoal: a lista alterna entre ativas e
  // arquivadas, sem qualquer justificativa do Executivo.
  const [showArchived, setShowArchived] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [messageTick, setMessageTick] = useState(0);
  const [startOpen, setStartOpen] = useState(false);
  const actor = actorFromSession(session);
  // DEF 3.0.3 §1/§7 — o Executivo só enxerga o que pertence ao
  // relacionamento. Distribuição é administração da plataforma.
  const areas = useMemo(
    () =>
      CRM_AREAS.filter(
        (a) =>
          !a.adminOnly ||
          isCrmAdministrator(actor.role) ||
          isCrmSupervisor(actor.role),
      ),
    [actor.role],
  );
  const current = areas.find((a) => a.key === area) ?? areas[0];
  // DEF 3.0.3 — o módulo Temas gerencia a aparência (imagem de fundo) do CRM.
  const [themeId, setThemeId] = useState<CrmThemeId>(() => getUserCrmTheme(session.userId));
  const [previewThemeId, setPreviewThemeId] = useState<CrmThemeId>(themeId);

  // Se o módulo ativo deixar de existir para o perfil, volta a Conversas.
  useEffect(() => {
    if (!areas.some((a) => a.key === area)) setArea("conversas");
  }, [areas, area]);

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
    // DEF 2.4.13 — relacionamento, mensagens, agenda, alertas e backup
    // compartilham o mesmo barramento: nada exige atualização manual.
    const offSync = onSync(() => {
      refresh();
      setMessageTick((v) => v + 1);
    });
    void pullLeads().then(refresh).catch(refresh);
    const offLeads = subscribeLeads(() => {
      void pullLeads().then(refresh).catch(refresh);
    });
    return () => {
      offEvents();
      offSync();
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
    () =>
      filterConversations(
        conversations.filter((c) => c.archived === showArchived),
        query,
      ),
    [conversations, query, showArchived],
  );

  /**
   * DEF 2.4.15 §5 — motivo obrigatório da movimentação. Qualquer conversa
   * que subiu por atividade recente do investidor (últimas 24 horas) exibe
   * explicitamente o que aconteceu. Novo Lead nunca gera pop-up.
   */
  const movements = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of visible) {
      const last = listPortalActivities(c.id, 1)[0];
      if (!last) continue;
      if (Date.now() - Date.parse(last.at) > 86_400_000) continue;
      map[c.id] = last.label;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tick]);

  // DEF 2.4.10 §2 — toda atividade do investidor no Portal (Manual,
  // Material, Calculadora, Workspace, retorno) vira alerta na Ficha e
  // registro permanente na Timeline, automaticamente.
  useEffect(() => {
    if (conversations.length === 0) return;
    syncPortalActivity(
      conversations.map((c) => ({
        id: c.id,
        name: c.name,
        ownerId: c.ownerId,
        originLabel: c.originLabel,
      })),
    );
  }, [conversations]);

  const selected =
    visible.find((c) => c.id === selectedId) ??
    conversations.find((c) => c.id === selectedId) ??
    visible[0] ??
    null;

  const isConversas = area === "conversas";
  const isDistribuicao = area === "distribuicao";
  const isTemas = area === "temas";
  const canManageDistribution =
    isCrmAdministrator(actor.role) || isCrmSupervisor(actor.role);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Relógio de baixa frequência: contador da janela de sincronização e da
  // janela de 24 horas da conversa.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

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
  /** Liberar Portal: exclusivo de Administrador e Gestora. */
  const canReleasePortal =
    Boolean(selected) &&
    (isCrmAdministrator(actor.role) || isSupervisorRole(actor.role));
  const portalReleased = selected ? isPortalReleased(selected.id) : false;
  // Jornada Digital: conversa congelada — envio manual bloqueado.
  const journeyOnly = Boolean(selected?.journeyOnly);
  /**
   * Comunicação total é liberada assim que o Portal é liberado ao
   * investidor: confirmação oficial no WhatsApp OU liberação manual do
   * Administrador/Gestora. A partir daí mensagens livres e templates
   * ficam disponíveis mesmo antes do relacionamento ser iniciado.
   */
  const communicationUnlocked = !journeyOnly || portalReleased;
  const composerEnabled = privateOk && communicationUnlocked;

  // Histórico da conversa — persistido, nunca some após o envio.
  const messages = useMemo(
    () => (selected && privateOk ? listCrmMessages(selected.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected?.id, privateOk, messageTick],
  );

  // DEF 2.4.14 — janela oficial de 24 horas a partir da última resposta
  // do investidor, identificada visualmente na conversa.
  const chatWindow = useMemo(
    () =>
      selected && privateOk
        ? resolveCrmWindow(windowAnchorAt(selected.id))
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected?.id, privateOk, messageTick, tick, now],
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

  // Atividades reais do investidor no Portal — exibidas na própria ficha.
  const portalActivities = useMemo(
    () => (selected && privateOk ? listPortalActivities(selected.id, 5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected?.id, privateOk, tick],
  );

  return (
    <>
      <CrmRail areas={areas} active={area} onSelect={setArea} />

      <CrmListPane
        title={isConversas ? "Conversas" : current.label}
        subtitle={isConversas ? "Investidores do seu Workspace" : current.description}
        count={isConversas ? visible.length : isDistribuicao ? intake.length : undefined}
        query={isConversas ? query : undefined}
        onQueryChange={isConversas ? setQuery : undefined}
        searchPlaceholder="Buscar investidor"
        action={
          isConversas ? (
            <>
              <CrmNewLeadButton onOpen={() => setNewLeadOpen(true)} />
              <CrmNewChatButton onOpen={() => setNewChatOpen(true)} />
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className={[
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium transition-colors",
                  showArchived
                    ? "border-[color:var(--crm-accent)] bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]"
                    : "border-[color:var(--crm-border)] text-[color:var(--crm-muted)] hover:text-[color:var(--crm-accent)]",
                ].join(" ")}
              >
                <Archive className="h-3.5 w-3.5" />
                {showArchived ? "Ver ativas" : "Arquivadas"}
              </button>
            </>
          ) : undefined
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
                  movement={movements[item.id]}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          ) : (
            <CrmPlaceholder
              label={
                query
                  ? "Nenhum investidor encontrado"
                  : showArchived
                    ? "Nenhuma conversa arquivada"
                    : "Nenhum investidor no Workspace"
              }
              hint={
                query
                  ? "Ajuste a busca para localizar o investidor desejado."
                  : showArchived
                    ? "Conversas arquivadas ficam guardadas aqui com todo o histórico preservado."
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
          <div className="space-y-1.5">
            {CRM_THEMES.map((t) => {
              const isActive = t.id === themeId;
              const isPreview = t.id === previewThemeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPreviewThemeId(t.id)}
                  className={[
                    "block w-full cursor-pointer overflow-hidden rounded-xl border text-left transition-colors",
                    isPreview
                      ? "border-[color:var(--crm-accent)] bg-[color:var(--crm-accent-soft)]"
                      : "border-[color:var(--crm-border)] hover:bg-[color:var(--crm-hover)]",
                  ].join(" ")}
                >
                  <img
                    src={t.thumbnail}
                    alt={`Fundo do tema ${t.label}`}
                    loading="lazy"
                    className="block aspect-[16/10] w-full object-cover"
                  />
                  <span className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[color:var(--crm-muted)]">
                        {t.description}
                      </span>
                    </span>
                    {isActive ? (
                      <span className="shrink-0 rounded-full bg-[color:var(--crm-accent)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--crm-primary-foreground)]">
                        Em uso
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CrmListPane>

      <CrmMainPane
        title={current.label}
        header={
          isConversas && selected ? (
            <CrmConversationHeader
              item={selected}
              window={chatWindow}
              windowAnchor={privateOk ? windowAnchorAt(selected.id) : null}
            />
          ) : undefined
        }
        footer={
          isConversas && selected ? (
            <CrmComposer
              disabled={!composerEnabled}
              investorName={selected.name}
              window={chatWindow}
              lastInboundBody={
                [...messages].reverse().find((m) => m.direction === "recebida")?.body ?? null
              }
              hint={
                journeyOnly
                  ? "Jornada Digital — inicie o relacionamento para liberar o envio"
                  : "Conversa disponível apenas ao Executivo responsável"
              }
              onSend={(text, viaTemplate) => {
                // Assinatura automática do Executivo — nunca digitada.
                const body = withSignature(text, {
                  investorId: selected.id,
                  userId: actor.userId,
                  userName: session.name,
                });
                appendCrmMessage({
                  investorId: selected.id,
                  direction: "enviada",
                  body,
                  authorId: actor.userId,
                });
                markOutboundMessage(selected.id);
                // DEF 2.4.15 §2 — Estado 02: o Template aprovado abre
                // imediatamente uma nova Janela de Conversação de 24h.
                if (viaTemplate) {
                  markWindowOpened(selected.id);
                  recordCrmEvent({
                    investorId: selected.id,
                    event: "janela_reaberta",
                    origin: selected.originLabel,
                    reason: "Template aprovado enviado — janela de 24 horas reaberta.",
                    ownerId: selected.ownerId,
                    actorId: actor.userId,
                  });
                }
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
              {journeyOnly && !portalReleased ? <CrmJourneyBadge /> : null}
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
        ) : isTemas ? (
          (() => {
            const t = CRM_THEMES.find((x) => x.id === previewThemeId) ?? CRM_THEMES[0]!;
            const applied = t.id === themeId;
            return (
              <div className="crm-enter mx-auto w-full max-w-3xl space-y-4">
                <div className="overflow-hidden rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)]">
                  <img
                    src={t.thumbnail}
                    alt={`Pré-visualização do tema ${t.label}`}
                    className="block w-full object-cover"
                  />
                  <div className="p-5">
                    <h3 className="text-sm font-semibold">{t.label}</h3>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--crm-muted)]">
                      {t.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={applied}
                    onClick={() => {
                      setUserCrmTheme(session.userId, t.id);
                      setThemeId(t.id);
                    }}
                    className="cursor-pointer rounded-xl bg-[color:var(--crm-accent)] px-4 py-2.5 text-xs font-medium text-[color:var(--crm-primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {applied ? "Fundo em uso" : "Aplicar este fundo"}
                  </button>
                  <span className="text-[11px] text-[color:var(--crm-muted)]">
                    A troca é aplicada imediatamente e salva no seu perfil.
                  </span>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-4">
            <CrmPlaceholder
              label={
                isConversas
                  ? "Selecione um investidor"
                  : "Nenhum Lead selecionado"
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
          <div key={selected.id} className="crm-enter space-y-3">
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
              {/* DEF 2.4.16 §9 — liberação imediata do Portal. Nunca cria
                  Lead e nunca altera o Executivo responsável. */}
              {canReleasePortal ? (
                portalReleased ? (
                  <p className="text-[11px] text-emerald-700">
                    Portal liberado manualmente para este investidor.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt(
                        "Informe o motivo da liberação do Portal:",
                      );
                      if (!reason?.trim()) return;
                      releasePortal({
                        investorId: selected.id,
                        investorName: selected.name,
                        actorId: actor.userId,
                        actorName: session.name,
                        actorRole: session.activeRole,
                        ownerId: selected.ownerId,
                        origin: selected.originLabel,
                        reason,
                      });
                      setTick((v) => v + 1);
                    }}
                    className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)] active:translate-y-0"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Liberar Portal
                  </button>
                )
              ) : null}
              {/* DEF 2.4.11 — único comando disponível durante a Jornada
                  Digital. Ao confirmar, o relacionamento comercial nasce
                  preservando integralmente todo o histórico anterior. */}
              {journeyOnly && privateOk ? (
                <button
                  type="button"
                  onClick={() => setStartOpen(true)}
                  className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
                >
                  <Handshake className="h-3.5 w-3.5" />
                  Iniciar Relacionamento
                </button>
              ) : null}
              {/* Arquivar/Desarquivar — comportamento idêntico em Green
                  Sales, Redistribuição e Portal. Um clique, sem motivo:
                  nada é apagado e o histórico continua exatamente do
                  ponto em que a conversa foi arquivada. */}
              {privateOk ? (
                selected.archived ? (
                  <button
                    type="button"
                    onClick={() => {
                      restoreRelationship({
                        investorId: selected.id,
                        investorName: selected.name,
                        actorId: actor.userId,
                        actorName: session.name,
                        actorRole: session.activeRole,
                        ownerId: selected.ownerId,
                        origin: selected.originLabel,
                      });
                      setShowArchived(false);
                      setTick((v) => v + 1);
                    }}
                    className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Desarquivar conversa
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      archiveRelationship({
                        investorId: selected.id,
                        investorName: selected.name,
                        actorId: actor.userId,
                        actorName: session.name,
                        actorRole: session.activeRole,
                        ownerId: selected.ownerId,
                        origin: selected.originLabel,
                      });
                      setSelectedId(null);
                      setTick((v) => v + 1);
                    }}
                    className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--crm-muted)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)] active:translate-y-0"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar conversa
                  </button>
                )
              ) : null}
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
              {portalActivities.length > 0 ? (
                <ul className="mt-1 space-y-1.5 border-t border-[color:var(--crm-border)] pt-2.5">
                  {portalActivities.map((a) => (
                    <li key={a.id} className="crm-enter flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate text-xs">{a.label}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--crm-muted)]">
                        {new Date(a.at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
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

            {/* DEF 2.4.15 §8 — a Ficha possui exclusivamente os blocos
                Dados gerais, Relacionamento, Portal do investidor e Agenda
                Corporativa. Alertas e IA vivem em suas Centrais próprias. */}
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

      {startOpen && selected ? (
        <CrmStartRelationshipDialog
          name={selected.name}
          onCancel={() => setStartOpen(false)}
          onConfirm={() => {
            startRelationship({
              investorId: selected.id,
              investorName: selected.name,
              actorId: actor.userId,
              actorName: session.name,
              actorRole: session.activeRole,
              ownerId: selected.ownerId,
              origin: selected.originLabel,
              source: "executivo",
            });
            setStartOpen(false);
            setTick((v) => v + 1);
          }}
        />
      ) : null}

      {newChatOpen ? <CrmNewChatDialog onClose={() => setNewChatOpen(false)} /> : null}

      {newLeadOpen ? (
        <CrmNewLeadDialog
          ownerId={actor.userId}
          onClose={() => setNewLeadOpen(false)}
          onCreated={(name, duplicated) => {
            setTick((v) => v + 1);
            void pullLeads()
              .then(() => setTick((v) => v + 1))
              .catch(() => undefined);
            if (typeof window !== "undefined") {
              window.setTimeout(() => setTick((v) => v + 1), 300);
            }
            if (duplicated && typeof window !== "undefined") {
              window.alert(
                `Já existe relacionamento ativo com ${name}. O histórico foi mantido e nenhum Lead duplicado foi criado.`,
              );
            }
          }}
        />
      ) : null}
    </>
  );
}
