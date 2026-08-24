/**
 * Central do Executivo — leitura da base real de investidores.
 * Nenhum dado fictício é gerado (DEF 2.4.RESET).
 */
import { listEvents } from "@/lib/events/bus";
import { loadLeads } from "@/lib/leads";
import { getDefaultExecutive } from "@/lib/executive-auth";
import { resolveLeadScope } from "@/lib/lead-routing";
import { isJourneyOnly, isArchived } from "@/lib/crm/commercial";
import { getPortalAdministratorId } from "@/lib/portal-workspace";

export type InvestorStatus =
  | "novo"
  | "em_leitura"
  | "concluido"
  | "conversando";

/**
 * Origem do investidor — apenas estrutura visual nesta etapa.
 *  - green_sales:    reconhecido via integração Green Sales
 *  - redistribuicao: entregue pela Gestão (ETAPA 02.1)
 *  - portal:         originado diretamente pelo Portal Velox
 *  - tiktok / meta:  captado pelo link oficial do canal (COMANDO 3 §8)
 *  - manual:         cadastro manual pelo executivo
 */
export type InvestorOrigin =
  | "green_sales"
  | "redistribuicao"
  | "portal"
  | "tiktok"
  | "meta"
  /** COMANDO 4G — carteira própria da Gestora. */
  | "central_unica"
  | "manual";

/**
 * Prioridade sinalizada pelo Portal — "o Portal identificou uma
 * oportunidade que merece atenção do executivo". Estrutura visual;
 * a lógica será implementada em outro bloco.
 */
export type InvestorPriority = "high" | "medium" | "none";

export type Investor = {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  status: InvestorStatus;
  readingPct: number;
  currentChapter: string;
  lastActivity: string; // ISO date
  aiInteractions: number;
  diagnostic: "não iniciado" | "em andamento" | "concluído";
  assignedToUserId: string; // FK -> ExecutiveUser.id
  origin?: InvestorOrigin;
  priority?: InvestorPriority;
  /** Rótulo do último evento real registrado no bus (para exibição no card). */
  lastEventLabel?: string;
};

export const STATUS_LABEL: Record<InvestorStatus, string> = {
  novo: "Novo",
  em_leitura: "Em leitura",
  concluido: "Leitura concluída",
  conversando: "Em conversa",
};

/**
 * DEF 2.4.RESET — proibido qualquer investidor de demonstração.
 * A base é composta exclusivamente por registros reais.
 */
function latestIso(values: string[]): string {
  const valid = values.filter(Boolean);
  if (valid.length === 0) return new Date().toISOString();
  return valid.sort((a, b) => (a < b ? 1 : -1))[0] ?? new Date().toISOString();
}

/**
 * Escopo de leitura da base (DEF 2.4.11).
 *
 * Por padrão devolve apenas o que possui Relacionamento Comercial ativo —
 * exatamente o que o Workspace deve exibir. O CRM pede também as Jornadas
 * Digitais; a Central de Backup pede também os arquivados.
 */
export type InvestorScopeOptions = {
  includeJourneyOnly?: boolean;
  includeArchived?: boolean;
};

export function listAllInvestors(options: InvestorScopeOptions = {}): Investor[] {
  const fallbackExecutiveId = getDefaultExecutive()?.id ?? "usr_thiago";
  // DEF 2.5.3 §3 — Portal pertence sempre ao Administrador responsável.
  const portalAdministratorId = getPortalAdministratorId();
  const portalInvestors = loadLeads().map<Investor>((lead) => {
    const scope =
      lead.scope ??
      resolveLeadScope({
        personalized: lead.personalized,
        responsibleExecutiveId: lead.responsibleExecutiveId,
      });
    const isPortal = scope === "portal";
    const events = listEvents({ investorId: lead.id });
    const manualEvents = events.filter((event) => event.type === "manual.chapter.completed");
    const manualDone = events.some((event) => event.type === "manual.completed");
    const simulatorDone = events.some((event) => event.type === "simulator.completed");
    const interestsCaptured = events.some((event) => event.type === "profile.interests.captured");
    const latestManual = manualEvents.sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    const latestManualPayload = latestManual?.payload as
      | { chapterTitle?: string; index?: number; total?: number }
      | undefined;
    const calculatedPct = latestManualPayload?.index && latestManualPayload?.total
      ? Math.min(100, Math.round((latestManualPayload.index / latestManualPayload.total) * 100))
      : 0;
    // O progresso REAL vem do servidor: os eventos do visitante nunca
    // existem no navegador do Executivo. O maior valor prevalece — jamais
    // um número estimado, apenas leitura efetivamente registrada.
    const remotePct = Math.max(0, Math.min(100, Math.round(lead.journeyPercent ?? 0)));
    const remoteDone = Boolean(lead.journeyCompletedAt);
    const readingPct = manualDone || remoteDone ? 100 : Math.max(calculatedPct, remotePct);
    const status: InvestorStatus = simulatorDone
      ? "conversando"
      : manualDone || remoteDone
        ? "concluido"
        : readingPct > 0
          ? "em_leitura"
          : "novo";

    const lastEvent = [...events].sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    const lastEventLabel = lastEvent ? EVENT_LABEL[lastEvent.type] : undefined;

    return {
      id: lead.id,
      name: lead.name,
      city: lead.city || "—",
      phone: lead.whatsapp || "—",
      email: lead.email,
      status,
      readingPct,
      currentChapter: manualDone || remoteDone
        ? "Convite para conversar"
        : (latestManualPayload?.chapterTitle ?? lead.journeyChapter ?? lead.material),
      lastActivity: latestIso([
        lead.createdAt,
        lead.lastActivityAt ?? "",
        lead.journeyLastEventAt ?? "",
        ...events.map((event) => event.at),
      ]),
      aiInteractions: events.filter((event) => event.type === "ai.query.answered").length +
        (interestsCaptured ? 1 : 0),
      diagnostic: simulatorDone || interestsCaptured ? "em andamento" : "não iniciado",
      // Portal: Administrador responsável, sem redistribuição automática.
      assignedToUserId: isPortal
        ? (lead.responsibleExecutiveId ?? portalAdministratorId)
        : (lead.responsibleExecutiveId ?? fallbackExecutiveId),
      // Origem oficial: link personalizado → Green Sales; acesso
      // institucional → Portal. Ver `lead-routing.ts`.
      origin:
        scope === "green_sales"
          ? "green_sales"
          : scope === "redistribuicao"
            ? "redistribuicao"
            : scope === "central_unica"
              ? "central_unica"
              : scope === "tiktok" || scope === "meta"
                ? scope
                : "portal",
      priority: simulatorDone ? "high" : interestsCaptured ? "medium" : "none",
      lastEventLabel,
    };
  });

  const byId = new Map<string, Investor>();
  for (const investor of portalInvestors) byId.set(investor.id, investor);
  return Array.from(byId.values()).filter((investor) => {
    if (!options.includeArchived && isArchived(investor.id)) return false;
    if (!options.includeJourneyOnly && isJourneyOnly(investor.id)) return false;
    return true;
  });
}

/**
 * Mapa oficial de rótulos para eventos reais do bus.
 * Usado para representar no card sempre o último evento efetivamente
 * registrado (nunca inferir eventos que não ocorreram).
 */
const EVENT_LABEL: Record<string, string> = {
  "journey.started": "Iniciou a jornada",
  "manual.started": "Iniciou o Manual",
  "manual.chapter.completed": "Avançou no Manual",
  "manual.completed": "Concluiu o Manual",
  "material.viewed": "Acessou Material Institucional",
  "simulator.started": "Iniciou simulação",
  "simulator.completed": "Realizou simulação",
  "meeting.created": "Solicitou reunião",
  "meeting.rescheduled": "Reagendou reunião",
  "meeting.completed": "Reunião concluída",
  "meeting.cancelled": "Reunião cancelada",
  "profile.updated": "Atualizou o perfil",
  "profile.interests.captured": "Preencheu perfil comercial",
  "whatsapp.requested": "Solicitou atendimento via WhatsApp",
  "lead.status.changed": "Status do Lead atualizado",
};

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}