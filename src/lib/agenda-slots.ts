import type { AgendaItem } from "@/lib/agenda-types";

export const AGENDA_SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

export type AgendaSlot = {
  key: string;
  label: string;
  occupied: boolean;
  status: "LIVRE" | "OCUPADO" | "INDISPONIVEL";
  title: string | null;
};

export function saoPauloDateISO(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function shiftAgendaDate(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function agendaDayRange(dateISO: string): { fromISO: string; toISO: string } {
  return {
    fromISO: new Date(`${dateISO}T00:00:00-03:00`).toISOString(),
    toISO: new Date(`${dateISO}T23:59:59.999-03:00`).toISOString(),
  };
}

function localMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function buildAgendaSlots(items: AgendaItem[], dateISO: string, now = new Date()): AgendaSlot[] {
  const commitments = items.filter(
    (item) => item.dateISO === dateISO && item.startsAt !== null && item.kind !== "acao",
  );

  const today = saoPauloDateISO(now);
  const currentMinutes = localMinutes(now.toISOString());
  return AGENDA_SLOT_HOURS.map((hour) => {
    const slotStart = hour * 60;
    const slotEnd = slotStart + 60;
    const item = commitments.find((candidate) => {
      if (!candidate.startsAt) return false;
      const startsAt = localMinutes(candidate.startsAt);
      const endsAt = candidate.endsAt ? localMinutes(candidate.endsAt) : startsAt + 30;
      return startsAt < slotEnd && endsAt > slotStart;
    });
    const occupied = Boolean(item);
    const ended = dateISO < today || (dateISO === today && slotEnd <= currentMinutes);
    return {
      key: `${dateISO}:${hour}`,
      label: `${String(hour).padStart(2, "0")}:00 – ${String(hour + 1).padStart(2, "0")}:00`,
      occupied,
      status: occupied ? "OCUPADO" : ended ? "INDISPONIVEL" : "LIVRE",
      title: item?.title ?? null,
    };
  });
}