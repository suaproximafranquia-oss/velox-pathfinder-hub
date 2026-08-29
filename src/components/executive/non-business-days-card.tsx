import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import {
  incluirDiaSemEnvio,
  listarDiasSemEnvio,
  removerDiaSemEnvio,
} from "@/lib/relationship/calendar.functions";

type Dia = { day: string; reason: string };

/**
 * DIAS SEM ENVIO — administração pela gestão.
 *
 * Os feriados nacionais e estaduais de SP já são calculados pelo motor
 * e NÃO aparecem aqui: esta lista é o acréscimo operacional (pontos
 * facultativos, recesso). O efeito é imediato no próximo cálculo.
 */
export function NonBusinessDaysCard() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDias((await listarDiasSemEnvio()) as Dia[]);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o calendário.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function incluir() {
    if (!day || busy) return;
    setBusy(true);
    try {
      setDias((await incluirDiaSemEnvio({ data: { day, reason } })) as Dia[]);
      setDay("");
      setReason("");
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível incluir a data.");
    } finally {
      setBusy(false);
    }
  }

  async function remover(alvo: string) {
    setBusy(true);
    try {
      setDias((await removerDiaSemEnvio({ data: { day: alvo } })) as Dia[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível remover a data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <header className="flex items-center gap-2">
        <CalendarOff className="h-4 w-4 text-[color:var(--gold)]" />
        <h2 className="font-display text-sm">Dias sem envio</h2>
      </header>
      <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
        Feriados nacionais e de São Paulo já são reconhecidos automaticamente. Use esta lista
        apenas para datas extras da operação. Nenhum envio automático acontece nesses dias e eles
        não contam como dia útil nos prazos.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-lg border border-[color:var(--border)] bg-transparent px-3 py-2 text-xs"
        />
        <input
          type="text"
          value={reason}
          placeholder="Motivo (opcional)"
          onChange={(e) => setReason(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-[color:var(--border)] bg-transparent px-3 py-2 text-xs"
        />
        <button
          type="button"
          onClick={() => void incluir()}
          disabled={!day || busy}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] px-4 py-2 text-xs text-[color:var(--gold)] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Incluir
        </button>
      </div>

      {erro && <p className="mt-3 text-xs text-red-400">{erro}</p>}

      <ul className="mt-4 space-y-2">
        {dias.length === 0 && (
          <li className="text-[11px] text-[color:var(--muted-foreground)]">
            Nenhuma data extra registrada.
          </li>
        )}
        {dias.map((d) => (
          <li
            key={d.day}
            className="flex items-center justify-between rounded-xl border border-[color:var(--border)] px-3 py-2 text-xs"
          >
            <span>
              {d.day.split("-").reverse().join("/")}
              {d.reason ? ` — ${d.reason}` : ""}
            </span>
            <button
              type="button"
              onClick={() => void remover(d.day)}
              disabled={busy}
              aria-label={`Remover ${d.day}`}
              className="text-[color:var(--muted-foreground)] hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
