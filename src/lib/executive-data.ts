/**
 * Central do Executivo — dados fictícios de investidores.
 * Substituir por integração com o Manual em etapa futura.
 */

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