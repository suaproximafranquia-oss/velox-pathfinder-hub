/**
 * RELÓGIO ACELERADO DO AMBIENTE — controle Admin da homologação /f.
 *
 * Não existe motor paralelo: o botão apenas troca a fonte de tempo lida
 * pelo motor, pelas cadências e pela Ação do Dia (2 min reais = 1 dia).
 */
import { useCallback, useEffect, useState } from "react";
import { Pause, Play, Timer } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  activateEnvironmentClockFn,
  deactivateEnvironmentClockFn,
  environmentClockStatusFn,
  pauseEnvironmentClockFn,
  resumeEnvironmentClockFn,
  type EnvironmentClockView,
} from "@/lib/testing/environment-clock.functions";

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function EnvironmentClockCard() {
  const status = useServerFn(environmentClockStatusFn);
  const activate = useServerFn(activateEnvironmentClockFn);
  const deactivate = useServerFn(deactivateEnvironmentClockFn);
  const pause = useServerFn(pauseEnvironmentClockFn);
  const resume = useServerFn(resumeEnvironmentClockFn);
  const [view, setView] = useState<EnvironmentClockView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await status({} as never));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler o relógio.");
    }
  }, [status]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (fn: () => Promise<EnvironmentClockView>) => {
    setBusy(true);
    setError(null);
    try {
      setView(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={card}>
      <div className="flex items-start gap-3">
        <Timer className="mt-0.5 h-5 w-5 text-[color:var(--gold)]" />
        <div className="flex-1">
          <h2 className="font-display text-lg text-[color:var(--foreground)]">
            Relógio acelerado do ambiente
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[color:var(--muted-foreground)]">
            2 minutos reais equivalem a 1 dia. A régua, as etapas e a Ação do Dia
            continuam exatamente as mesmas — muda apenas a percepção de tempo deste
            ambiente. Só liga quando o Workspace contém somente os 4 cadastros de
            validação.
          </p>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[color:var(--muted-foreground)]">Situação</dt>
              <dd className="text-[color:var(--foreground)]">
                {view
                  ? view.mode === "paused"
                    ? "Relógio pausado"
                    : view.mode === "running"
                      ? `Relógio em execução (${view.factor}x)`
                      : "Desligado (tempo real)"
                  : "…"}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--muted-foreground)]">Hora real</dt>
              <dd className="text-[color:var(--foreground)]">{fmt(view?.realNowIso ?? null)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--muted-foreground)]">Hora do ambiente</dt>
              <dd className="text-[color:var(--foreground)]">{fmt(view?.logicalNowIso ?? null)}</dd>
            </div>
          </dl>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy || view?.active === true}
              onClick={() => void run(() => activate({} as never))}
              variant="outline"
            >
              Ligar relógio acelerado
            </Button>
            {view?.mode === "running" ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void run(() => pause({} as never))}
                variant="outline"
              >
                <Pause className="h-4 w-4" />
                Pausar relógio
              </Button>
            ) : null}
            {view?.mode === "paused" ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void run(() => resume({} as never))}
                variant="outline"
              >
                <Play className="h-4 w-4" />
                Continuar relógio
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={busy || view?.mode === "real" || !view}
              onClick={() => void run(() => deactivate({} as never))}
              variant="outline"
            >
              Voltar ao tempo real
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
