import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAgenda } from "@/lib/agenda.functions";
import type { AgendaItem } from "@/lib/agenda-types";
import {
  agendaDayRange,
  buildAgendaSlots,
  saoPauloDateISO,
  shiftAgendaDate,
} from "@/lib/agenda-slots";

const AGENDA_REFRESH_MS = 180_000;

export function DailyActionsAgenda() {
  const [selectedDate, setSelectedDate] = useState(() => saoPauloDateISO());
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    const request = ++requestRef.current;
    if (!silent) setLoading(true);
    try {
      const data = await listAgenda({ data: agendaDayRange(selectedDate) });
      if (request === requestRef.current) setItems(data);
    } catch {
      // Uma atualização silenciosa falha sem apagar a Agenda já exibida.
    } finally {
      if (!silent && request === requestRef.current) setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), AGENDA_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const slots = useMemo(() => buildAgendaSlots(items, selectedDate), [items, selectedDate]);
  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <aside aria-label="Agenda" className="flex h-full min-h-0 flex-col border-b border-border bg-card/20 xl:border-b-0 xl:border-r">
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center gap-2 text-primary">
          <CalendarDays className="h-4 w-4" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em]">Agenda</h3>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Dia anterior da Agenda"
            onClick={() => setSelectedDate((date) => shiftAgendaDate(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <p className="text-center text-xs capitalize text-foreground">{dateLabel}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Próximo dia da Agenda"
            onClick={() => setSelectedDate((date) => shiftAgendaDate(date, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-busy={loading}>
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> Carregando…
          </p>
        ) : (
          <ul className="space-y-1.5">
            {slots.map((slot) => (
              <li key={slot.key} className="rounded-md border border-border bg-background/30 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] tabular-nums text-foreground">{slot.label}</span>
                  <span className={slot.occupied ? "text-[9px] font-semibold uppercase text-destructive" : "text-[9px] font-semibold uppercase text-emerald-400"}>
                    {slot.occupied ? "Ocupado" : "Livre"}
                  </span>
                </div>
                {slot.title ? <p className="mt-1 truncate text-[11px] text-muted-foreground" title={slot.title}>{slot.title}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}