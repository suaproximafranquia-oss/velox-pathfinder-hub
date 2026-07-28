/**
 * Meeting Providers — Bloco 1B.
 *
 * Camada de abstração para provedores de videoconferência. O Portal
 * controla o agendamento; o provedor fornece apenas o link. Toda a
 * infraestrutura Google Workspace (auth, calendar sync) permanece
 * intacta e é reutilizada opcionalmente pelo provedor "google_meet".
 */
import type { Meeting } from "@/lib/meetings";
import { getGoogleStore } from "@/lib/google-workspace";

export type MeetingProviderId =
  | "google_meet"
  | "manual"
  | "teams"
  | "zoom"
  | "jitsi"
  | "whereby";

export type MeetingProviderStatus =
  | "manual"
  | "pending"
  | "generating"
  | "available"
  | "error";

export type MeetingProviderDescriptor = {
  id: MeetingProviderId;
  label: string;
  shortLabel: string;
  enabled: boolean;
  comingSoon: boolean;
  requiresManualUrl: boolean;
  color: string;
};

export const MEETING_PROVIDERS: readonly MeetingProviderDescriptor[] = [
  { id: "google_meet", label: "Google Meet", shortLabel: "Meet",     enabled: true,  comingSoon: false, requiresManualUrl: false, color: "#1A73E8" },
  { id: "manual",      label: "Manual",      shortLabel: "Manual",   enabled: true,  comingSoon: false, requiresManualUrl: true,  color: "#B08D57" },
  { id: "teams",       label: "Microsoft Teams", shortLabel: "Teams",enabled: false, comingSoon: true,  requiresManualUrl: false, color: "#5059C9" },
  { id: "zoom",        label: "Zoom",        shortLabel: "Zoom",     enabled: false, comingSoon: true,  requiresManualUrl: false, color: "#2D8CFF" },
  { id: "jitsi",       label: "Jitsi",       shortLabel: "Jitsi",    enabled: false, comingSoon: true,  requiresManualUrl: false, color: "#1D76BB" },
  { id: "whereby",     label: "Whereby",     shortLabel: "Whereby",  enabled: false, comingSoon: true,  requiresManualUrl: false, color: "#3B7EA1" },
];

export function getProvider(id: MeetingProviderId | undefined | null): MeetingProviderDescriptor {
  return MEETING_PROVIDERS.find((p) => p.id === id) ?? MEETING_PROVIDERS[0];
}

/** Provedor efetivo de uma reunião — mantém compatibilidade com o modelo antigo. */
export function resolveMeetingProvider(m: Meeting): MeetingProviderDescriptor {
  if (m.meetingProvider) return getProvider(m.meetingProvider);
  // Fallback: reuniões antigas com link → manual; sem link → google_meet (padrão histórico).
  if (m.meetUrl) return getProvider("manual");
  return getProvider("google_meet");
}

export function resolveMeetingUrl(m: Meeting): string | undefined {
  return m.meetingProviderUrl ?? m.meetUrl ?? undefined;
}

export function resolveProviderStatus(m: Meeting): MeetingProviderStatus {
  if (m.meetingProviderStatus) return m.meetingProviderStatus;
  const prov = resolveMeetingProvider(m).id;
  if (prov === "manual") return m.meetUrl ? "manual" : "manual";
  if (m.meetUrl) return "available";
  return "pending";
}

/* ---------- Preferência por executivo ---------- */

const PREF_KEY = "velox:meeting-provider-default:v1:";

export function getDefaultProviderForExecutive(executiveId: string): MeetingProviderId {
  if (typeof window === "undefined") return "google_meet";
  try {
    const raw = window.localStorage.getItem(PREF_KEY + executiveId);
    if (raw && MEETING_PROVIDERS.some((p) => p.id === raw && p.enabled)) {
      return raw as MeetingProviderId;
    }
  } catch { /* noop */ }
  return "google_meet";
}

export function setDefaultProviderForExecutive(executiveId: string, id: MeetingProviderId): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(PREF_KEY + executiveId, id); } catch { /* noop */ }
}

/* ---------- Geração de link (contrato único) ---------- */

export type GenerateLinkResult = {
  status: MeetingProviderStatus;
  url?: string;
  meetingId?: string;
  message?: string;
};

/**
 * Tenta obter um link do provedor. Nunca lança — retorna o estado.
 * • manual  → usa o link informado pelo executivo (obrigatório).
 * • google_meet → se a infra existente já forneceu meetUrl (Calendar sync),
 *   marca como available; caso contrário fica "pending" com mensagem clara.
 *   Nunca cria mock.
 * • demais  → em breve, retorna "pending".
 */
export function tryGenerateProviderLink(
  providerId: MeetingProviderId,
  ctx: { executiveId: string; existingUrl?: string; manualUrl?: string },
): GenerateLinkResult {
  const provider = getProvider(providerId);

  if (provider.id === "manual") {
    const url = (ctx.manualUrl ?? "").trim();
    if (!url) return { status: "error", message: "Informe o link da reunião." };
    return { status: "manual", url };
  }

  if (provider.id === "google_meet") {
    if (ctx.existingUrl) return { status: "available", url: ctx.existingUrl };
    const store = getGoogleStore(ctx.executiveId);
    if (store.state === "connected") {
      // A infra Calendar existente preenche meetUrl de forma assíncrona.
      return { status: "pending", message: "Aguardando geração do Google Meet." };
    }
    return {
      status: "pending",
      message: "Aguardando configuração da integração Google Meet.",
    };
  }

  // Providers marcados como "Em breve".
  return {
    status: "pending",
    message: `${provider.label} — aguardando configuração da integração.`,
  };
}

/* ---------- Rótulos de status ---------- */

export const PROVIDER_STATUS_LABEL: Record<MeetingProviderStatus, string> = {
  manual: "Manual",
  pending: "Aguardando",
  generating: "Gerando",
  available: "Disponível",
  error: "Erro",
};