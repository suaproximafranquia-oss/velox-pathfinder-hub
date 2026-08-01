/**
 * KPI Manager — módulo funcional (Sprint 03A.2).
 *
 * O KPI Manager é a fonte oficial de indicadores da Atlas Platform.
 * Toda a operação registra aqui os lançamentos diários; o Brain
 * Analytics, os Relatórios e a IA Corporativa consultarão essa
 * mesma estrutura em sprints futuros — sem alteração de contrato.
 *
 * Todos os lançamentos são reais e persistidos no
 * LocalStorage do próprio usuário. A superfície pública é estável:
 *   loadDataset(userId, monthKey) → KpiDataset
 *   saveDataset(dataset)          → void
 *   summarize(dataset)            → KpiSummary
 *   toBrainSnapshot(...)          → BrainKpiSnapshot (adapter)
 */
import { useCallback, useEffect, useState } from "react";
import type {
  ExecutiveRole,
  ExecutiveSession,
} from "./executive-auth";

/* ---------------------- Competência (mês) ---------------------- */

export type KpiMonth = {
  /** Chave estável no formato YYYY-MM. */
  key: string;
  year: number;
  /** 0-11, padrão JavaScript. */
  month: number;
  label: string;
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function makeMonth(year: number, month: number): KpiMonth {
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    year,
    month,
    label: `${MONTH_NAMES[month]} ${year}`,
  };
}

/** Meses disponíveis nesta sprint: Julho a Dezembro de 2026. */
export const AVAILABLE_MONTHS: KpiMonth[] = [
  makeMonth(2026, 6),
  makeMonth(2026, 7),
  makeMonth(2026, 8),
  makeMonth(2026, 9),
  makeMonth(2026, 10),
  makeMonth(2026, 11),
];

export const DEFAULT_MONTH_KEY = AVAILABLE_MONTHS[0].key;

export function findMonth(key: string): KpiMonth {
  return AVAILABLE_MONTHS.find((m) => m.key === key) ?? AVAILABLE_MONTHS[0];
}

export function daysInMonth(m: KpiMonth): number {
  return new Date(m.year, m.month + 1, 0).getDate();
}

export function isWeekend(m: KpiMonth, day: number): boolean {
  const wd = new Date(m.year, m.month, day).getDay();
  return wd === 0 || wd === 6;
}

/* ---------------------- Indicadores oficiais ---------------------- */

export type KpiUnit = "count" | "currency";

export type KpiIndicator = {
  id: string;
  label: string;
  unit: KpiUnit;
  /** Grupo visual, apenas para agrupamento futuro. */
  group: "captacao" | "atividade" | "reunioes" | "fechamento" | "resultado";
  /** Contrato semântico consumido pelo Brain / IA. */
  brainKey: string;
  /** Marcador lateral discreto para diferenciação visual de linhas. */
  marker?: "green" | "gold";
};

export const INDICATORS: KpiIndicator[] = [
  { id: "leads",           label: "Leads",                              unit: "count",    group: "captacao",   brainKey: "leads" },
  { id: "leadsJoao",       label: "Leads João",                         unit: "count",    group: "captacao",   brainKey: "leadsJoao",   marker: "green" },
  { id: "leadsFelipe",     label: "Leads Felipe",                       unit: "count",    group: "captacao",   brainKey: "leadsFelipe", marker: "gold"  },
  { id: "calls",           label: "Ligações realizadas no dia",         unit: "count",    group: "atividade",  brainKey: "callsMade" },
  { id: "callsAnswered",   label: "Ligações atendidas no dia",          unit: "count",    group: "atividade",  brainKey: "callsAnswered" },
  { id: "presentations",   label: "Apresentações do dia",               unit: "count",    group: "reunioes",   brainKey: "presentations" },
  { id: "messages",        label: "Mensagens enviadas do dia",          unit: "count",    group: "atividade",  brainKey: "messages" },
  { id: "emails",          label: "E-mails enviados no dia",            unit: "count",    group: "atividade",  brainKey: "emails" },
  { id: "videosScheduled", label: "Vídeo conferências agendadas do dia",unit: "count",    group: "reunioes",   brainKey: "videosScheduled" },
  { id: "videosDone",      label: "Vídeo conferências feitas no dia",   unit: "count",    group: "reunioes",   brainKey: "videosDone" },
  { id: "contractsSent",   label: "Contratos feitos (enviados)",        unit: "count",    group: "fechamento", brainKey: "contractsSent" },
  { id: "dropouts",        label: "Desistências do dia",                unit: "count",    group: "fechamento", brainKey: "dropouts" },
  { id: "contractsSigned", label: "Vendas feitas no dia",               unit: "count",    group: "fechamento", brainKey: "contractsSigned" },
  { id: "salesValue",      label: "Pagamentos feitos no dia",           unit: "currency", group: "resultado",  brainKey: "salesValue" },
];

export type IndicatorId = (typeof INDICATORS)[number]["id"];

/** Matriz do mês: indicador → dia (1-based) → valor. */
export type KpiMatrix = Record<string, Record<number, number>>;

export type KpiDataset = {
  userId: string;
  monthKey: string;
  matrix: KpiMatrix;
  updatedAt: number;
};

/* ---------------------- DEF 2.4.RESET ----------------------
 * Proibido gerar lançamentos fictícios. Todos os meses iniciam
 * vazios e recebem exclusivamente lançamentos reais.
 * ---------------------------------------------------------- */

/* ---------------------- Persistência (LocalStorage) ---------------------- */

const STORAGE_PREFIX = "atlas:kpi:v1";

function storageKey(userId: string, monthKey: string) {
  return `${STORAGE_PREFIX}:${userId}:${monthKey}`;
}

function emptyMatrix(): KpiMatrix {
  const m: KpiMatrix = {};
  for (const i of INDICATORS) m[i.id] = {};
  return m;
}

export function loadDataset(userId: string, monthKey: string): KpiDataset {
  const fallback: KpiDataset = {
    userId,
    monthKey,
    matrix: emptyMatrix(),
    updatedAt: Date.now(),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, monthKey));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as KpiDataset;
    // Preenche indicadores adicionados após a criação do dataset.
    for (const ind of INDICATORS) if (!parsed.matrix[ind.id]) parsed.matrix[ind.id] = {};
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveDataset(ds: KpiDataset): void {
  if (typeof window === "undefined") return;
  const next = { ...ds, updatedAt: Date.now() };
  window.localStorage.setItem(storageKey(ds.userId, ds.monthKey), JSON.stringify(next));
}

export function resetDataset(userId: string, monthKey: string): KpiDataset {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey(userId, monthKey));
  }
  return loadDataset(userId, monthKey);
}

/* ---------------------- Cálculos agregados ---------------------- */

export function sumRow(matrix: KpiMatrix, indicatorId: string): number {
  const row = matrix[indicatorId] ?? {};
  let s = 0;
  for (const k in row) s += row[k as unknown as number] || 0;
  return s;
}

export function averageRow(
  matrix: KpiMatrix,
  indicatorId: string,
  m: KpiMonth,
): number {
  const total = sumRow(matrix, indicatorId);
  const days = daysInMonth(m);
  return days === 0 ? 0 : total / days;
}

export type KpiSummary = {
  leads: number;
  calls: number;
  presentations: number;
  contractsSent: number;
  sales: number;
  salesValue: number;
  /** Vendas feitas ÷ Leads recebidos. */
  conversion: number;
};

export function summarize(ds: KpiDataset): KpiSummary {
  const leads = sumRow(ds.matrix, "leads");
  const calls = sumRow(ds.matrix, "calls");
  const presentations = sumRow(ds.matrix, "presentations");
  const contractsSent = sumRow(ds.matrix, "contractsSent");
  const sales = sumRow(ds.matrix, "contractsSigned");
  const salesValue = sumRow(ds.matrix, "salesValue");
  const conversion = leads > 0 ? sales / leads : 0;
  return { leads, calls, presentations, contractsSent, sales, salesValue, conversion };
}

/* ---------------------- Adaptador Brain (preparação) ---------------------- */

export type BrainKpiSnapshot = {
  userId: string;
  monthKey: string;
  totals: Record<string, number>;
  averages: Record<string, number>;
  updatedAt: number;
};

/**
 * Contrato estável para o Brain Analytics. Consumido em sprints
 * futuras sem alteração de assinatura, para permitir a substituição
 * natural dos dados simulados por dados reais.
 */
export function toBrainSnapshot(ds: KpiDataset): BrainKpiSnapshot {
  const m = findMonth(ds.monthKey);
  const totals: Record<string, number> = {};
  const averages: Record<string, number> = {};
  for (const ind of INDICATORS) {
    totals[ind.brainKey] = sumRow(ds.matrix, ind.id);
    averages[ind.brainKey] = averageRow(ds.matrix, ind.id, m);
  }
  return { userId: ds.userId, monthKey: ds.monthKey, totals, averages, updatedAt: ds.updatedAt };
}

/* ---------------------- Contexto de navegação ---------------------- */

const CTX_KEY = "atlas:kpi:context:v2";
export type KpiContext = { monthKey: string; collaboratorId: string };

export function useKpiContext(
  session: ExecutiveSession,
  defaults: KpiContext,
): { ctx: KpiContext; update: (p: Partial<KpiContext>) => void } {
  const [ctx, setCtx] = useState<KpiContext>(defaults);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CTX_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<KpiContext>;
      setCtx((c) => ({
        monthKey: parsed.monthKey ?? c.monthKey,
        collaboratorId: parsed.collaboratorId ?? c.collaboratorId,
      }));
    } catch {
      /* silencioso */
    }
  }, [session.userId]);

  const update = useCallback((patch: Partial<KpiContext>) => {
    setCtx((c) => {
      const next = { ...c, ...patch };
      if (typeof window !== "undefined")
        window.localStorage.setItem(CTX_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { ctx, update };
}

/* ---------------------- Permissões (IA / Brain) ---------------------- */

/**
 * Verifica se um perfil pode consultar indicadores de um alvo.
 * A IA Corporativa deverá herdar exatamente esta mesma matriz.
 */
export function canAccessKpiOf(
  actor: { userId: string; activeRole: ExecutiveRole },
  targetUserId: string,
  managedUserIds: string[],
): boolean {
  if (actor.activeRole === "super_admin") return true;
  if (actor.activeRole === "diretora") return managedUserIds.includes(targetUserId);
  return actor.userId === targetUserId;
}

/* ---------------------- Formatação ---------------------- */

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const NUMBER = new Intl.NumberFormat("pt-BR");

export function formatValue(value: number, unit: KpiUnit): string {
  if (!Number.isFinite(value) || value === 0) return unit === "currency" ? "—" : "0";
  return unit === "currency" ? CURRENCY.format(value) : NUMBER.format(value);
}

export function formatCurrency(v: number): string { return CURRENCY.format(v || 0); }
export function formatNumber(v: number): string { return NUMBER.format(Math.round(v || 0)); }
export function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1).replace(".", ",")}%`;
}

/* ---------------------- Campanha Velox ---------------------- */

export type CampaignLevelKey = "mestre" | "doutor" | "phd" | "supreme";

export type CampaignLevel = {
  key: CampaignLevelKey;
  label: string;
  emoji: string;
  /** Cor semântica CSS (hex ou var) para a barra e o badge. */
  color: string;
  /** Valor mínimo em BRL para atingir o nível. */
  min: number;
};

export const CAMPAIGN_MAX = 100000;

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  { key: "mestre",  label: "Mestre",  emoji: "🥉", color: "#3B82F6", min: 55000 },
  { key: "doutor",  label: "Doutor",  emoji: "🥈", color: "#EAB308", min: 70000 },
  { key: "phd",     label: "PhD",     emoji: "🥇", color: "#1F2937", min: 90000 },
  { key: "supreme", label: "Supreme", emoji: "👑", color: "#D4AF37", min: 100000 },
];

export type CampaignStatus = {
  value: number;
  percent: number;
  level: CampaignLevel | null;
};

export function campaignStatus(value: number): CampaignStatus {
  const v = Math.max(0, value || 0);
  const percent = Math.min(100, (v / CAMPAIGN_MAX) * 100);
  let level: CampaignLevel | null = null;
  for (const lvl of CAMPAIGN_LEVELS) if (v >= lvl.min) level = lvl;
  return { value: v, percent, level };
}