/**
 * RESET DE HOMOLOGAÇÃO — ESCOPO DEFINITIVAMENTE RESTRITO.
 *
 * NÃO EXISTE MAIS RESET GLOBAL. Esta rotina limpa apenas o cache LOCAL
 * de artefatos de homologação/simulação do navegador. Ela NUNCA toca:
 * Portal dos Leads, espelho do GreenSales, leads e jornadas reais,
 * conversas do CRM, Biblioteca de Conteúdos, usuários, permissões,
 * templates, integrações, backups ou qualquer dado do servidor.
 *
 * O banco de dados é a fonte da verdade e permanece intocado.
 */
import { notifySync } from "@/lib/sync-bus";

/**
 * Únicas chaves removíveis: artefatos locais de homologação/simulação.
 * Qualquer chave fora desta lista é permanente para esta rotina.
 */
const HOMOLOGATION_KEYS = [
  "atlas:recognition:homolog:v1",
  "velox:simulator:history:v1",
  "atlas.creative.history.v1",
] as const;

/**
 * Dados reais jamais tocados por qualquer rotina de reset. Lista
 * explícita para auditoria — inclui o espelho do Portal dos Leads.
 */
export const PRESERVED_KEYS = [
  "velox:leads:v1",
  "velox:journey:v1",
  "velox:portal:session:v1",
  "velox:portal:identities:v1",
  "crm.commercial.v1",
  "crm.messages.v1",
  "crm.timeline.v1",
  "crm.ownership.v1",
  "crm.backups.v1",
  "atlas:backups:v1",
  "atlas:session:v3",
  "atlas:users:v3",
  "atlas:activeRole:v1",
  "atlas:platform-settings:v1",
  "atlas:custom-fields:v1",
  "atlas:knowledge:v1",
  "atlas:resources:v1",
  "crm.distribution.config.v1",
  "velox:crm:relationship-inactivity-days:v1",
] as const;

export type ResetSummary = { removed: string[]; preserved: number };

export function resetHomologationData(): ResetSummary {
  if (typeof window === "undefined") return { removed: [], preserved: 0 };
  const removed: string[] = [];
  for (const key of HOMOLOGATION_KEYS) {
    if (window.localStorage.getItem(key) !== null) {
      window.localStorage.removeItem(key);
      removed.push(key);
    }
  }
  notifySync("audit");
  return {
    removed,
    preserved: PRESERVED_KEYS.filter((k) => window.localStorage.getItem(k) !== null).length,
  };
}
