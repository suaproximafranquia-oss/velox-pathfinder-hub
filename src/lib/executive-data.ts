/**
 * Central do Executivo — dados fictícios de investidores.
 * Substituir por integração com o Manual em etapa futura.
 */
import { listEvents } from "@/lib/events/bus";
import { loadLeads } from "@/lib/leads";
import { getDefaultExecutive } from "@/lib/executive-auth";

export type InvestorStatus =
  | "novo"
  | "em_leitura"
  | "concluido"
  | "conversando";

/**
 * Origem do investidor — apenas estrutura visual nesta etapa.
 *  - green_sales: reconhecido via integração Green Sales
 *  - portal:      originado diretamente pelo Portal Velox
 *  - manual:      cadastro manual pelo executivo
 */
export type InvestorOrigin = "green_sales" | "portal" | "manual";

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

export const MOCK_INVESTORS: Investor[] = [
  {
    id: "inv_001",
    name: "João Ferreira",
    city: "Ribeirão Preto - SP",
    phone: "(17) 99999-1122",
    email: "joao.ferreira@email.com",
    status: "em_leitura",
    readingPct: 62,
    currentChapter: "Investimento",
    lastActivity: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    aiInteractions: 4,
    diagnostic: "em andamento",
    assignedToUserId: "usr_marton",
    origin: "green_sales",
    priority: "high",
  },
  {
    id: "inv_002",
    name: "Ana Beatriz Santos",
    city: "Uberlândia - MG",
    phone: "(34) 99888-4433",
    email: "ana.santos@email.com",
    status: "concluido",
    readingPct: 100,
    currentChapter: "Convite para conversar",
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    aiInteractions: 9,
    diagnostic: "concluído",
    assignedToUserId: "usr_paulo",
    origin: "portal",
    priority: "medium",
  },
  {
    id: "inv_003",
    name: "Pedro Nakamura",
    city: "Curitiba - PR",
    phone: "(41) 98765-2211",
    email: "pedro.nak@email.com",
    status: "novo",
    readingPct: 8,
    currentChapter: "Boas-vindas",
    lastActivity: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    aiInteractions: 0,
    diagnostic: "não iniciado",
    assignedToUserId: "usr_milton",
    origin: "portal",
    priority: "high",
  },
  {
    id: "inv_004",
    name: "Luciana Prado",
    city: "Belo Horizonte - MG",
    phone: "(31) 97777-9911",
    email: "lu.prado@email.com",
    status: "conversando",
    readingPct: 100,
    currentChapter: "Convite para conversar",
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    aiInteractions: 12,
    diagnostic: "concluído",
    assignedToUserId: "usr_carlos",
    origin: "manual",
    priority: "none",
  },
  {
    id: "inv_005",
    name: "Rodrigo Alencar",
    city: "São Paulo - SP",
    phone: "(11) 98123-4567",
    email: "rodrigo@email.com",
    status: "em_leitura",
    readingPct: 34,
    currentChapter: "Produtos e soluções",
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    aiInteractions: 2,
    diagnostic: "não iniciado",
    assignedToUserId: "usr_talita",
    origin: "green_sales",
    priority: "medium",
  },
];

function latestIso(values: string[]): string {
  const valid = values.filter(Boolean);
  if (valid.length === 0) return new Date().toISOString();
  return valid.sort((a, b) => (a < b ? 1 : -1))[0] ?? new Date().toISOString();
}

export function listAllInvestors(): Investor[] {
  const fallbackExecutiveId = getDefaultExecutive()?.id ?? "usr_thiago";
  const portalInvestors = loadLeads().map<Investor>((lead) => {
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
    const readingPct = manualDone ? 100 : calculatedPct;
    const status: InvestorStatus = simulatorDone
      ? "conversando"
      : manualDone
        ? "concluido"
        : readingPct > 0
          ? "em_leitura"
          : "novo";

    return {
      id: lead.id,
      name: lead.name,
      city: lead.city || "—",
      phone: lead.whatsapp || "—",
      email: lead.email,
      status,
      readingPct,
      currentChapter: manualDone
        ? "Convite para conversar"
        : latestManualPayload?.chapterTitle ?? lead.material,
      lastActivity: latestIso([lead.createdAt, ...events.map((event) => event.at)]),
      aiInteractions: events.filter((event) => event.type === "ai.query.answered").length +
        (interestsCaptured ? 1 : 0),
      diagnostic: simulatorDone || interestsCaptured ? "em andamento" : "não iniciado",
      assignedToUserId: lead.responsibleExecutiveId ?? fallbackExecutiveId,
      origin: "portal",
      priority: simulatorDone ? "high" : interestsCaptured ? "medium" : "none",
    };
  });

  const byId = new Map<string, Investor>();
  for (const investor of MOCK_INVESTORS) byId.set(investor.id, investor);
  for (const investor of portalInvestors) byId.set(investor.id, investor);
  return Array.from(byId.values());
}

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