/**
 * Central de Captação — origens de aquisição de leads.
 *
 * Este módulo é apenas de MONITORAMENTO: não substitui o CRM nem o
 * Workspace. Ele centraliza as origens (Meta Ads, TikTok Ads, Google Ads
 * e Portal Velox) e mantém a arquitetura pronta para receber, no futuro,
 * leads automáticos de formulários e landing pages.
 */
import { loadLeads, type LeadRecord } from "@/lib/leads";

export type AcquisitionSourceId = "meta_ads" | "tiktok_ads" | "google_ads" | "portal_velox";

export type SourceField = {
  id: string;
  label: string;
  placeholder: string;
  /** Campos sensíveis ficam mascarados na interface. */
  secret?: boolean;
};

export type AcquisitionSourceDef = {
  id: AcquisitionSourceId;
  name: string;
  description: string;
  /** Origem nativa do Portal — não depende de credenciais externas. */
  native?: boolean;
  /** Palavras-chave usadas para classificar a origem registrada no lead. */
  match: string[];
  fields: SourceField[];
};

export const ACQUISITION_SOURCES: AcquisitionSourceDef[] = [
  {
    id: "meta_ads",
    name: "Meta Ads",
    description: "Formulários de Lead Ads do Facebook e Instagram.",
    match: ["meta", "facebook", "instagram"],
    fields: [
      { id: "pageId", label: "ID da Página", placeholder: "1029384756" },
      { id: "formId", label: "ID do Formulário", placeholder: "5647382910" },
      { id: "accessToken", label: "Access Token", placeholder: "EAAG...", secret: true },
      { id: "verifyToken", label: "Verify Token do Webhook", placeholder: "velox-meta", secret: true },
    ],
  },
  {
    id: "tiktok_ads",
    name: "TikTok Ads",
    description: "Lead Generation das campanhas do TikTok for Business.",
    match: ["tiktok"],
    fields: [
      { id: "advertiserId", label: "Advertiser ID", placeholder: "700000000000" },
      { id: "appId", label: "App ID", placeholder: "7300000000000000" },
      { id: "accessToken", label: "Access Token", placeholder: "act....", secret: true },
    ],
  },
  {
    id: "google_ads",
    name: "Google Ads",
    description: "Formulários de lead das campanhas de pesquisa e display.",
    match: ["google", "ads"],
    fields: [
      { id: "customerId", label: "Customer ID", placeholder: "123-456-7890" },
      { id: "clientId", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { id: "clientSecret", label: "Client Secret", placeholder: "GOCSPX-...", secret: true },
      { id: "developerToken", label: "Developer Token", placeholder: "abcdEFGH...", secret: true },
    ],
  },
  {
    id: "portal_velox",
    name: "Portal Velox",
    description: "Jornada institucional, landing pages e formulários próprios.",
    native: true,
    match: ["portal", "manual", "jornada", "simulador", "link"],
    fields: [
      { id: "domain", label: "Domínio oficial", placeholder: "veloxsolucoes.com.br" },
    ],
  },
];

export type SourceConfig = {
  values: Record<string, string>;
  connected: boolean;
  lastSyncAt: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
};

export type SourceHistoryEntry = {
  id: string;
  sourceId: AcquisitionSourceId;
  at: string;
  action: string;
  detail: string;
};

const CONFIG_KEY = "velox:captacao:config:v1";
const HISTORY_KEY = "velox:captacao:history:v1";
const CHANGED_EVENT = "velox:captacao:changed";

function emptyConfig(): SourceConfig {
  return { values: {}, connected: false, lastSyncAt: null, lastTestAt: null, lastTestOk: null };
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

export function subscribeAcquisition(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener();
  window.addEventListener(CHANGED_EVENT, handler);
  return () => window.removeEventListener(CHANGED_EVENT, handler);
}

export function loadSourceConfigs(): Record<AcquisitionSourceId, SourceConfig> {
  const stored = read<Partial<Record<AcquisitionSourceId, SourceConfig>>>(CONFIG_KEY, {});
  const out = {} as Record<AcquisitionSourceId, SourceConfig>;
  for (const def of ACQUISITION_SOURCES) {
    const current = stored[def.id];
    out[def.id] = current
      ? { ...emptyConfig(), ...current }
      : { ...emptyConfig(), connected: Boolean(def.native) };
  }
  return out;
}

export function saveSourceConfig(
  sourceId: AcquisitionSourceId,
  patch: Partial<SourceConfig>,
): Record<AcquisitionSourceId, SourceConfig> {
  const all = loadSourceConfigs();
  all[sourceId] = { ...all[sourceId], ...patch };
  write(CONFIG_KEY, all);
  return all;
}

export function loadSourceHistory(sourceId?: AcquisitionSourceId): SourceHistoryEntry[] {
  const all = read<SourceHistoryEntry[]>(HISTORY_KEY, []);
  const list = sourceId ? all.filter((e) => e.sourceId === sourceId) : all;
  return [...list].sort((a, b) => b.at.localeCompare(a.at));
}

export function logSourceHistory(sourceId: AcquisitionSourceId, action: string, detail: string) {
  const all = read<SourceHistoryEntry[]>(HISTORY_KEY, []);
  all.push({
    id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceId,
    at: new Date().toISOString(),
    action,
    detail,
  });
  write(HISTORY_KEY, all.slice(-400));
}

/** Classifica o lead registrado em uma das origens monitoradas. */
export function classifyLead(lead: LeadRecord): AcquisitionSourceId {
  const haystack = `${lead.origin ?? ""} ${lead.material ?? ""}`.toLowerCase();
  for (const def of ACQUISITION_SOURCES) {
    if (def.native) continue;
    if (def.match.some((token) => haystack.includes(token))) return def.id;
  }
  return "portal_velox";
}

export type SourceStats = {
  today: number;
  month: number;
  total: number;
  lastLeadAt: string | null;
};

export type AcquisitionSnapshot = {
  bySource: Record<AcquisitionSourceId, SourceStats>;
  today: number;
  month: number;
  total: number;
  lastLeadAt: string | null;
  activeSources: number;
};

function emptyStats(): SourceStats {
  return { today: 0, month: 0, total: 0, lastLeadAt: null };
}

export function buildAcquisitionSnapshot(
  configs: Record<AcquisitionSourceId, SourceConfig>,
): AcquisitionSnapshot {
  const leads = loadLeads();
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const monthKey = now.toISOString().slice(0, 7);
  const bySource = {} as Record<AcquisitionSourceId, SourceStats>;
  for (const def of ACQUISITION_SOURCES) bySource[def.id] = emptyStats();

  let lastLeadAt: string | null = null;
  for (const lead of leads) {
    const id = classifyLead(lead);
    const stats = bySource[id];
    stats.total += 1;
    const created = lead.createdAt ?? "";
    if (created.slice(0, 10) === dayKey) stats.today += 1;
    if (created.slice(0, 7) === monthKey) stats.month += 1;
    if (created && (!stats.lastLeadAt || created > stats.lastLeadAt)) stats.lastLeadAt = created;
    if (created && (!lastLeadAt || created > lastLeadAt)) lastLeadAt = created;
  }

  return {
    bySource,
    today: Object.values(bySource).reduce((sum, s) => sum + s.today, 0),
    month: Object.values(bySource).reduce((sum, s) => sum + s.month, 0),
    total: leads.length,
    lastLeadAt,
    activeSources: ACQUISITION_SOURCES.filter((d) => configs[d.id]?.connected).length,
  };
}

/** Semáforo: verde (recebendo), amarelo (conectado sem leads), vermelho. */
export type SourceTone = "green" | "amber" | "red";

export function sourceTone(config: SourceConfig, stats: SourceStats): SourceTone {
  if (!config.connected) return "red";
  if (stats.today > 0) return "green";
  if (stats.month > 0) return "amber";
  return "amber";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Tempo decorrido desde o último lead, em linguagem natural. */
export function elapsedSince(value: string | null): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  const days = Math.floor(hours / 24);
  return `${days} dia${days > 1 ? "s" : ""}`;
}

/**
 * Testa a origem com as credenciais informadas. Enquanto as integrações
 * externas não estão publicadas, a verificação é estrutural: confere se
 * todos os parâmetros obrigatórios estão preenchidos.
 */
export function testSourceConnection(
  sourceId: AcquisitionSourceId,
): { ok: boolean; message: string } {
  const def = ACQUISITION_SOURCES.find((d) => d.id === sourceId)!;
  const config = loadSourceConfigs()[sourceId];
  if (def.native) {
    saveSourceConfig(sourceId, {
      lastTestAt: new Date().toISOString(),
      lastTestOk: true,
      lastSyncAt: new Date().toISOString(),
    });
    logSourceHistory(sourceId, "Teste de conexão", "Origem nativa do Portal respondendo.");
    return { ok: true, message: "Portal Velox recebendo leads normalmente." };
  }
  const missing = def.fields.filter((f) => !(config.values[f.id] ?? "").trim());
  const ok = missing.length === 0;
  saveSourceConfig(sourceId, {
    lastTestAt: new Date().toISOString(),
    lastTestOk: ok,
    ...(ok ? { lastSyncAt: new Date().toISOString() } : {}),
  });
  const message = ok
    ? `Parâmetros de ${def.name} validados.`
    : `Faltam parâmetros: ${missing.map((f) => f.label).join(", ")}.`;
  logSourceHistory(sourceId, "Teste de conexão", message);
  return { ok, message };
}