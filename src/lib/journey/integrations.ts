/**
 * Journey Engine — camada de integrações (preparação para o Épico 8).
 *
 * Registro de adaptadores externos. NENHUMA integração é ativada neste
 * épico: a arquitetura apenas fica pronta para conexão. Cada adaptador
 * recebe os mesmos eventos padronizados do Journey Engine.
 */
import { onEvent, type PortalEvent } from "@/lib/events/bus";

export type IntegrationKey =
  | "google.calendar"
  | "google.meet"
  | "google.drive"
  | "google.oauth"
  | "whatsapp"
  | "crm"
  | "ai.commercial";

export type IntegrationAdapter = {
  key: IntegrationKey;
  label: string;
  /** Ativado apenas no Épico 8. */
  enabled: boolean;
  deliver?: (event: PortalEvent) => void | Promise<void>;
};

const adapters = new Map<IntegrationKey, IntegrationAdapter>([
  ["google.calendar", { key: "google.calendar", label: "Google Calendar", enabled: false }],
  ["google.meet", { key: "google.meet", label: "Google Meet", enabled: false }],
  ["google.drive", { key: "google.drive", label: "Google Drive", enabled: false }],
  ["google.oauth", { key: "google.oauth", label: "OAuth Google", enabled: false }],
  ["whatsapp", { key: "whatsapp", label: "WhatsApp", enabled: false }],
  ["crm", { key: "crm", label: "CRM", enabled: false }],
  ["ai.commercial", { key: "ai.commercial", label: "IA Comercial", enabled: false }],
]);

export function listIntegrationAdapters(): IntegrationAdapter[] {
  return [...adapters.values()];
}

export function registerIntegrationAdapter(adapter: IntegrationAdapter) {
  adapters.set(adapter.key, adapter);
}

let started = false;

/**
 * Conecta o barramento aos adaptadores. Enquanto nenhum estiver
 * habilitado, a entrega é um no-op silencioso.
 */
export function startIntegrationBridge(): () => void {
  if (started) return () => undefined;
  started = true;
  const off = onEvent((event) => {
    for (const adapter of adapters.values()) {
      if (!adapter.enabled || !adapter.deliver) continue;
      try {
        void adapter.deliver(event);
      } catch {
        /* integrações nunca podem quebrar a jornada */
      }
    }
  });
  return () => {
    started = false;
    off();
  };
}