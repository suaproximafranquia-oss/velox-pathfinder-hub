/**
 * Achievement & Recognition Engine — Atlas Platform.
 *
 * Motor genérico de reconhecimento corporativo. Nenhum texto ou regra
 * está atrelado a uma empresa específica; toda personalização visual e
 * textual acontece via `RecognitionTemplate` (White Label).
 *
 * Nesta sprint apenas o evento `birthday` é emitido; a arquitetura já
 * comporta futuros tipos (tempo de empresa, primeira venda, campanhas,
 * promoções, níveis Mestre/Doutor/PhD/Supreme, etc.) sem alteração de
 * contrato.
 */

export type RecognitionType =
  | "birthday"
  | "tenure"
  | "first_sale"
  | "best_month"
  | "promotion"
  | "campaign_level"
  | "kpi_pending"
  | "custom";

export type RecognitionStatus = "pending" | "viewed" | "dismissed";

export type RecognitionEvent = {
  /** ID único e determinístico (evita duplicidade). */
  id: string;
  userId: string;
  type: RecognitionType;
  /** Referência da ocorrência (ex.: "2026", "level:phd"). */
  occurrence: string;
  /** ISO date do evento (não da visualização). */
  date: string;
  status: RecognitionStatus;
  viewedAt?: string;
  /** Payload livre para o template (nome, nível, número da conquista…). */
  payload?: Record<string, unknown>;
};

const EVENTS_KEY = "atlas:recognition:events:v1";
const HOMOLOG_KEY = "atlas:recognition:homolog:v1";

/* ---------------------- Persistência ---------------------- */

function readAll(): RecognitionEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecognitionEvent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: RecognitionEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
}

/** Chave estável para deduplicar ocorrências do mesmo tipo. */
export function eventId(userId: string, type: RecognitionType, occurrence: string) {
  return `${userId}:${type}:${occurrence}`;
}

/** Registra um evento se ele ainda não existir. Idempotente. */
export function registerEvent(input: Omit<RecognitionEvent, "id" | "status">): RecognitionEvent {
  const id = eventId(input.userId, input.type, input.occurrence);
  const list = readAll();
  const existing = list.find((e) => e.id === id);
  if (existing) return existing;
  const next: RecognitionEvent = { ...input, id, status: "pending" };
  writeAll([...list, next]);
  return next;
}

export function markViewed(id: string) {
  const list = readAll();
  const idx = list.findIndex((e) => e.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], status: "viewed", viewedAt: new Date().toISOString() };
  writeAll(list);
}

export function listEvents(userId?: string): RecognitionEvent[] {
  const all = readAll();
  return userId ? all.filter((e) => e.userId === userId) : all;
}

/** Retorna o próximo evento pendente do usuário (fila de exibição). */
export function nextPendingEvent(userId: string): RecognitionEvent | null {
  return readAll().find((e) => e.userId === userId && e.status === "pending") ?? null;
}

/* ---------------------- Modo de Homologação ---------------------- */

/**
 * Enquanto esta flag existir, o engine injeta um evento de aniversário
 * para o usuário informado no próximo login — independentemente da data
 * real. Após a visualização, o evento é marcado como visto e nunca mais
 * será exibido, mesmo que a flag permaneça.
 */
export type HomologationConfig = {
  enabled: boolean;
  userId: string;
  type: RecognitionType;
  occurrence: string;
};

export function getHomologationConfig(): HomologationConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HOMOLOG_KEY);
    if (!raw) return DEFAULT_HOMOLOGATION;
    const parsed = JSON.parse(raw) as HomologationConfig;
    return parsed;
  } catch {
    return DEFAULT_HOMOLOGATION;
  }
}

export function setHomologationConfig(cfg: HomologationConfig | null) {
  if (typeof window === "undefined") return;
  if (!cfg) window.localStorage.removeItem(HOMOLOG_KEY);
  else window.localStorage.setItem(HOMOLOG_KEY, JSON.stringify(cfg));
}

/**
 * Configuração padrão de homologação — Thiago recebe uma homenagem de
 * aniversário simulada na primeira vez que fizer login. Preparada para
 * futuramente ser substituída pela data real cadastrada no perfil.
 */
export const DEFAULT_HOMOLOGATION: HomologationConfig = {
  enabled: true,
  userId: "usr_thiago",
  type: "birthday",
  occurrence: "homolog-2026",
};

/**
 * Avalia todos os disparos aplicáveis ao usuário no login. Nesta sprint
 * apenas aniversários (via homologação). Estrutura preparada para futuras
 * regras (aniversário real via `profile.birthdate`, campanha atingida,
 * primeira venda, promoção, etc.).
 */
export function evaluateForLogin(userId: string): RecognitionEvent[] {
  const created: RecognitionEvent[] = [];
  const cfg = getHomologationConfig();
  if (cfg?.enabled && cfg.userId === userId) {
    created.push(
      registerEvent({
        userId,
        type: cfg.type,
        occurrence: cfg.occurrence,
        date: new Date().toISOString(),
        payload: { source: "homologation" },
      }),
    );
  }
  return created;
}

/**
 * Regra "KPI Pendente": no primeiro login do dia, avalia se o usuário
 * deixou algum indicador do dia útil anterior sem lançamento. Registra
 * um evento informativo (não punitivo). Import dinâmico evita ciclo
 * com o KPI Manager.
 */
export function evaluateKpiPending(userId: string): RecognitionEvent | null {
  if (typeof window === "undefined") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const kpi = require("@/lib/kpi-manager") as typeof import("@/lib/kpi-manager");
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (yesterday.getMonth() !== today.getMonth()) return null;
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const month = kpi.findMonth(monthKey);
    if (month.key !== monthKey) return null;
    const day = yesterday.getDate();
    const ds = kpi.loadDataset(userId, monthKey);
    const missing = kpi.INDICATORS.filter((ind) => {
      const v = ds.matrix[ind.id]?.[day];
      return v === undefined || v === null;
    });
    if (missing.length === 0) return null;
    return registerEvent({
      userId,
      type: "kpi_pending",
      occurrence: `pending:${monthKey}:${day}`,
      date: yesterday.toISOString(),
      payload: { missing: missing.length, day, monthLabel: month.label },
    });
  } catch {
    return null;
  }
}