/**
 * DEF 2.5.1 — Jornada Digital.
 *
 * Um visitante que passa pelo Gateway existe APENAS como Jornada
 * Digital: nenhum Lead, Card, Conversa, Timeline, Auditoria ou Registro
 * Comercial é criado. Estes dados ficam exclusivamente no navegador do
 * visitante até que o WhatsApp seja confirmado — momento em que a
 * jornada é promovida a Relacionamento Comercial.
 */
const KEY = "velox:portal:journey:v1";

export type DigitalJourney = {
  journeyId: string;
  name: string;
  email: string;
  phone: string;
  executiveSlug: string | null;
  unit: string | null;
  origin: string;
  campaign: string | null;
  startedAt: string;
};

/** Identificadores de Jornada Digital nunca são Leads comerciais. */
export function isJourneyId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith("jd_"));
}

export function newJourneyId(): string {
  return `jd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function getDigitalJourney(): DigitalJourney | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DigitalJourney) : null;
  } catch {
    return null;
  }
}

export function saveDigitalJourney(journey: DigitalJourney): DigitalJourney {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(journey));
    } catch {
      /* armazenamento indisponível */
    }
  }
  return journey;
}

export function clearDigitalJourney(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}