/**
 * DEF 2.4.19 §12 / DEF 2.4.20 §13 — RESET do ambiente de homologação.
 *
 * Remove exclusivamente dados operacionais de demonstração (leads,
 * conversas, alertas, auditorias, reuniões, cards, timeline, eventos
 * simulados, jornadas e sessões do Portal).
 *
 * Preserva integralmente: usuários, permissões, templates, estrutura,
 * banco e integrações.
 */
import { notifySync } from "@/lib/sync-bus";

/** Chaves operacionais removidas pelo RESET. */
const OPERATIONAL_KEYS = [
  // Leads, jornada e portal
  "velox:leads:v1",
  "velox:visitor:identity:v1",
  "velox:visitor:id",
  "velox:portal:session:v1",
  "velox:portal:identities:v1",
  "velox:portal:entry-context:v1",
  "velox:portal:whatsapp-verification:v1",
  "velox:journey:v1",
  "velox:manual:v1",
  "velox:interests-profile:v1",
  "velox:simulations:v1",
  "velox:lead-state:v2",
  // CRM e relacionamento
  "crm.commercial.v1",
  "crm.messages.v1",
  "crm.timeline.v1",
  "crm.ownership.v1",
  "crm.intake.v1",
  "crm.private-leads.v1",
  "crm.portal-release.v1",
  "crm.backup.access.v1",
  "crm.backup.grants.v1",
  "velox:crm:relationship-state:v1",
  "velox:crm:whatsapp-presence:v1",
  // Centrais
  "atlas.audit.log.v1",
  "atlas.audit.seeded.v1",
  "atlas:workspace-alerts:v1",
  "atlas:workspace-alerts-read:v1",
  "atlas:investor-last-seen:v1",
  "atlas:brain:alerts:v3",
  "velox:notifications:v1",
  "velox:meetings:v1",
  "velox:events:v1",
  "velox:investor-comments:v1",
  "atlas:recognition:events:v1",
  "atlas:recognition:homolog:v1",
  "atlas:recognition:scheduled:v1",
] as const;

/** Chaves jamais tocadas — estrutura, usuários, permissões e integrações. */
export const PRESERVED_KEYS = [
  "atlas:session:v3",
  "atlas:users:v3",
  "atlas:activeRole:v1",
  "atlas:platform-settings:v1",
  "atlas:custom-fields:v1",
  "atlas:knowledge:v1",
  "atlas:resources:v1",
  "crm.distribution.config.v1",
  "velox:crm:relationship-inactivity-days:v1",
  "velox:google-calendar:v2",
] as const;

export type ResetSummary = { removed: string[]; preserved: number };

export function resetHomologationData(): ResetSummary {
  if (typeof window === "undefined") return { removed: [], preserved: 0 };
  const removed: string[] = [];
  for (const key of OPERATIONAL_KEYS) {
    if (window.localStorage.getItem(key) !== null) {
      window.localStorage.removeItem(key);
      removed.push(key);
    }
  }
  // Preferências por executivo (prefixadas) também são operacionais.
  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("velox:meeting-provider-default:v1:")) {
      window.localStorage.removeItem(key);
      removed.push(key);
    }
  }
  window.sessionStorage.removeItem("velox:portal:entry-context:v1");
  notifySync("commercial");
  notifySync("audit");
  return {
    removed,
    preserved: PRESERVED_KEYS.filter((k) => window.localStorage.getItem(k) !== null).length,
  };
}
