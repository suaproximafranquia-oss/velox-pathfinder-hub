/**
 * Ponte entre o navegador e a autorização/progresso persistidos no
 * servidor.
 *
 * O Portal continua respondendo instantaneamente pelo cache local, mas a
 * verdade vem do banco: liberação manual feita no CRM, confirmação de
 * WhatsApp e percentual real de leitura valem em qualquer dispositivo,
 * sem F5 e sem depender do navegador onde a ação aconteceu.
 */
import { useEffect } from "react";
import {
  fetchPortalAccess,
  trackPortalProgress,
  type PortalAccessState,
} from "@/lib/portal-access.functions";
import { applyRemoteRelease } from "@/lib/crm/portal-release";
import { applyRemoteConfirmation } from "@/lib/portal-verification";

/** Sincronização periódica: a liberação aparece sozinha para o visitante. */
export const PORTAL_ACCESS_POLL_MS = 20_000;

let lastFetchAt = 0;
let inFlight: Promise<PortalAccessState | null> | null = null;

/** Lê o estado oficial e espelha no cache local do navegador. */
export async function refreshPortalAccess(
  investorId: string | null | undefined,
  options?: { force?: boolean },
): Promise<PortalAccessState | null> {
  if (!investorId || typeof window === "undefined") return null;
  if (inFlight) return inFlight;
  if (!options?.force && Date.now() - lastFetchAt < 5_000) return null;
  lastFetchAt = Date.now();
  inFlight = fetchPortalAccess({ data: { investorId } })
    .then((state) => {
      if (!state) return null;
      applyRemoteRelease(
        investorId,
        state.releasedAt
          ? {
              releasedAt: state.releasedAt,
              releasedByName: state.releasedByName,
              reason: state.releaseReason,
            }
          : null,
      );
      applyRemoteConfirmation(investorId, state.confirmedAt);
      return state;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Mantém o Portal sincronizado enquanto o visitante navega: ao montar, ao
 * voltar para a aba e em intervalos curtos.
 */
export function usePortalAccessSync(investorId: string | null | undefined): void {
  useEffect(() => {
    if (!investorId) return;
    void refreshPortalAccess(investorId, { force: true });
    const timer = window.setInterval(() => void refreshPortalAccess(investorId), PORTAL_ACCESS_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshPortalAccess(investorId, { force: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [investorId]);
}

type ProgressPush = {
  investorId: string;
  event: string;
  module?: string;
  detail?: string;
  percent?: number;
  chapter?: string;
  stage?: string;
  completed?: boolean;
};

let queue: ProgressPush | null = null;
let timer: number | null = null;

/**
 * Envia o progresso REAL ao servidor. Agrupado em janelas curtas para não
 * competir com a navegação — nenhum valor é estimado ou inventado.
 */
export function pushPortalProgress(input: ProgressPush): void {
  if (typeof window === "undefined" || !input.investorId) return;
  queue = queue
    ? {
        ...queue,
        ...input,
        percent: Math.max(queue.percent ?? 0, input.percent ?? 0),
        completed: queue.completed || input.completed,
      }
    : input;
  if (timer !== null) return;
  timer = window.setTimeout(() => {
    const payload = queue;
    queue = null;
    timer = null;
    if (!payload) return;
    void trackPortalProgress({ data: payload }).catch(() => {
      /* reenviado no próximo evento da jornada */
    });
  }, 1_200);
}
