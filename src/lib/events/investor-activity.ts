/**
 * ATIVIDADE REAL DO INVESTIDOR — definição única da plataforma.
 *
 * Regra de negócio: ação do EXECUTIVO nunca é atividade do INVESTIDOR.
 * Abrir card, abrir perfil, editar ficha, comentar, criar/confirmar/
 * reagendar reunião, gerar alerta — tudo isso é operação administrativa
 * e NÃO pode ser interpretado como "o investidor voltou a interagir".
 *
 * Por isso o cálculo de novidade usa uma LISTA BRANCA explícita: só
 * entra o que é comprovadamente produzido pelo comportamento do próprio
 * investidor. Nada de lista negra ("tudo vale menos X"), que volta a
 * contaminar o estado a cada evento novo criado no sistema.
 */
import { listEvents, type PortalEvent, type PortalEventType } from "@/lib/events/bus";

/**
 * Eventos produzidos pelo comportamento do INVESTIDOR no Portal.
 * Todo evento fora desta lista é administrativo/técnico por padrão.
 */
export const INVESTOR_ACTIVITY_EVENTS: readonly PortalEventType[] = [
  "journey.started",
  "journey.lead.created",
  "journey.session.started",
  "journey.session.ended",
  "journey.returned",
  "journey.module.opened",
  "journey.progress",
  "journey.completed",
  "manual.started",
  "manual.chapter.completed",
  "manual.completed",
  "material.viewed",
  "simulator.started",
  "simulator.completed",
  "profile.interests.captured",
  "whatsapp.requested",
  "ai.query.answered",
] as const;

const ACTIVITY_SET = new Set<string>(INVESTOR_ACTIVITY_EVENTS);

/**
 * `meeting.requested` só é atividade do investidor quando foi o próprio
 * investidor quem pediu a reunião. Reunião criada/confirmada/reagendada
 * pelo executivo nunca conta.
 */
function requestedByInvestor(event: PortalEvent): boolean {
  if (event.type !== "meeting.requested") return false;
  const origin = (event.payload as { origin?: string } | undefined)?.origin;
  return origin === "investidor" || origin === "portal" || origin === "investor";
}

/** Este evento representa atividade REAL do investidor? */
export function isInvestorActivityEvent(event: PortalEvent): boolean {
  return ACTIVITY_SET.has(event.type) || requestedByInvestor(event);
}

/** Filtra uma lista de eventos mantendo apenas atividade real do investidor. */
export function filterInvestorActivity(events: PortalEvent[]): PortalEvent[] {
  return events.filter(isInvestorActivityEvent);
}

/** Eventos locais de atividade real do investidor para um lead. */
export function investorActivityEvents(investorId: string): PortalEvent[] {
  return filterInvestorActivity(listEvents({ investorId }));
}
