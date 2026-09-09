/**
 * AVISO DE PRÓXIMO COMPROMISSO.
 *
 * Faixa apenas informativa para o executivo não perder um compromisso
 * próximo. A fonte é a MESMA agenda oficial já existente
 * (`portal_meetings`), incluindo os compromissos do GreenSales.
 * Não cria ação, não entra na fila e não altera a Ação do Dia.
 */
import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { listNextCommitments } from "@/lib/agenda.functions";
import { operationalDate, operationalTime } from "@/lib/crm/daily-actions";

type Commitment = { id: string; name: string; startsAt: string };

function quando(startsAt: string): string {
  const hoje = operationalDate(new Date());
  const dia = operationalDate(startsAt);
  const hora = operationalTime(startsAt);
  if (dia === hoje) return `hoje às ${hora}`;
  const [, m, d] = dia.split("-");
  return `${d}/${m} às ${hora}`;
}

export function NextCommitmentAlert() {
  const [items, setItems] = useState<Commitment[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void listNextCommitments()
        .then((rows) => {
          if (alive) setItems(rows);
        })
        .catch(() => {
          /* aviso é opcional: nunca atrapalha a operação */
        });
    };
    load();
    const timer = window.setInterval(load, 120000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const next = items[0];
  if (!next) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-3 py-2 text-[12px] text-[color:var(--foreground)]">
      <CalendarClock className="h-4 w-4 text-[color:var(--gold)]" strokeWidth={1.5} />
      <span>
        Próximo compromisso: <strong>{next.name}</strong> — {quando(next.startsAt)}.
      </span>
      {items.length > 1 && (
        <span className="text-[color:var(--muted-foreground)]">
          +{items.length - 1} compromisso{items.length > 2 ? "s" : ""} na sequência.
        </span>
      )}
    </div>
  );
}
