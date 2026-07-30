/**
 * Configurações Gerais da Plataforma — Etapa 2.
 *
 * Persistência local por workspace. Parâmetros institucionais editáveis
 * sem necessidade de deploy. Estrutura extensível: novas chaves podem
 * ser adicionadas mantendo compatibilidade retroativa.
 */
import { emitEvent } from "@/lib/events/bus";
import { logAudit } from "@/lib/audit-log";

export type PlatformFeatureFlags = {
  iaCorporativa: boolean;
  baseConhecimento: boolean;
  centroRecursos: boolean;
  camposPersonalizados: boolean;
  auditoriaExpandida: boolean;
};

export type IntegrationSettings = {
  googleDriveFolderUrl: string;
  googleCalendarUrl: string;
  crmUrl: string;
  crmName: string;
};

export type PlatformSettings = {
  workspaceId: string;
  institutionalName: string;
  supportEmail: string;
  aiTagline: string;
  aiDisclaimer: string;
  features: PlatformFeatureFlags;
  /** Janela de reativação (em horas) para considerar retorno do investidor
   * ao Portal como "movimentação" digna de alerta. Editável em Configurações. */
  reactivationWindowHours: number;
  integrations: IntegrationSettings;
  updatedAt: string;
};

const KEY = "atlas:platform-settings:v1";

export const DEFAULT_SETTINGS: PlatformSettings = {
  workspaceId: "velox",
  institutionalName: "Portal Velox",
  supportEmail: "contato@veloxsolucoes.com.br",
  aiTagline: "Resposta consultiva baseada na Base Oficial de Conhecimento.",
  aiDisclaimer:
    "Resposta gerada por IA a partir de materiais oficiais. Não substitui a orientação de um Executivo.",
  features: {
    iaCorporativa: true,
    baseConhecimento: true,
    centroRecursos: true,
    camposPersonalizados: true,
    auditoriaExpandida: true,
  },
  reactivationWindowHours: 6,
  integrations: {
    googleDriveFolderUrl: "https://drive.google.com/",
    googleCalendarUrl: "https://calendar.google.com/",
    crmUrl: "https://adm.greennsales.com.br/velox/home",
    crmName: "Green Sales",
  },
  updatedAt: new Date(0).toISOString(),
};

function readAll(): Record<string, PlatformSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, PlatformSettings>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PlatformSettings>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function getSettings(workspaceId = "velox"): PlatformSettings {
  const map = readAll();
  const stored = map[workspaceId] ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    features: { ...DEFAULT_SETTINGS.features, ...(stored.features ?? {}) },
    integrations: { ...DEFAULT_SETTINGS.integrations, ...(stored.integrations ?? {}) },
    workspaceId,
  };
}

/** Janela de reativação configurada, em milissegundos. */
export function getReactivationWindowMs(workspaceId = "velox"): number {
  const hours = getSettings(workspaceId).reactivationWindowHours ?? 6;
  return Math.max(1, hours) * 60 * 60 * 1000;
}

export function updateSettings(
  workspaceId: string,
  patch: Partial<PlatformSettings>,
  actor: { id: string; name: string; role: string },
) {
  const map = readAll();
  const next: PlatformSettings = {
    ...getSettings(workspaceId),
    ...patch,
    workspaceId,
    updatedAt: new Date().toISOString(),
  };
  map[workspaceId] = next;
  writeAll(map);
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    module: "administracao",
    action: "Configurações gerais atualizadas",
    details: Object.keys(patch).join(", "),
    severity: "info",
  });
  emitEvent({
    type: "admin.settings.updated",
    actorId: actor.id,
    payload: { keys: Object.keys(patch) },
  });
  return next;
}