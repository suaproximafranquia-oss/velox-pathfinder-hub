/** Validação temporal controlada da Ação do Dia, isolada em homologação. */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  activateControlledTestFn,
  concludeControlledActionFn,
  controlledTestStatusFn,
  deactivateControlledTestFn,
  tickControlledTestFn,
} from "@/lib/testing/controlled-test.functions";
import type { DailyAction } from "@/lib/crm/daily-actions";
import type { ControlledTestStatus } from "@/server/relationship/controlled-test.server";

type Snapshot = { status: ControlledTestStatus; actions: DailyAction[] };

export function HomologationDailyActionsDemo() {
  const read = useServerFn(controlledTestStatusFn);
  const activate = useServerFn(activateControlledTestFn);
  const tick = useServerFn(tickControlledTestFn);
  const conclude = useServerFn(concludeControlledActionFn);
  const deactivate = useServerFn(deactivateControlledTestFn);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setSnapshot(await read()), [read]);
  useEffect(() => { void load(); }, [load]);

  const perform = async (work: () => Promise<Snapshot>, message: string) => {
    setBusy(true);
    try {
      setSnapshot(await work());
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) return <p className="text-sm text-muted-foreground">Carregando validação controlada…</p>;
  const { status, actions } = snapshot;

  return (
    <div className="space-y-4">
      <span className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {status.active ? "Rodada ativa" : "Rodada inativa"}
      </span>
      <p className="max-w-2xl text-sm text-[color:var(--muted-foreground)]">
        Validação isolada com Ricardo, Eduardo, Francisco e João. Cinco minutos reais equivalem
        a um dia lógico. Os cadastros reais são somente leitura e nenhum envio externo é realizado.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Relógio lógico</p><p className="mt-1 text-sm font-medium text-foreground">{new Date(status.logicalNowIso).toLocaleString("pt-BR")}</p></div>
        <div className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Velocidade</p><p className="mt-1 text-sm font-medium text-foreground">5 min = 1 dia</p></div>
        <div className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Fila isolada</p><p className="mt-1 text-sm font-medium text-foreground">{status.counts.queue} registros</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!status.active ? (
          <Button disabled={busy} onClick={() => void perform(() => activate(), "Rodada controlada ativada.")}>Ativar teste</Button>
        ) : (
          <>
            <Button disabled={busy} onClick={() => void perform(() => tick(), "Relógio lógico aplicado à fila.")}>Atualizar relógio</Button>
            <Button variant="destructive" disabled={busy} onClick={() => {
              if (window.confirm("Encerrar e limpar somente os registros isolados desta rodada?")) {
                void perform(() => deactivate({ data: { confirmed: true } }), "Rodada encerrada e visão normal restaurada.");
              }
            }}>Desativar e limpar</Button>
          </>
        )}
      </div>
      {status.active && (
        <div className="space-y-2">
          {actions.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma ação vencida no horário lógico atual.</p> : actions.map((action) => (
            <div key={action.actionKey} className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium text-foreground">{action.name}</p><p className="text-sm text-muted-foreground">{action.title} · {action.stepLabel}</p></div>
              {action.kind === "ligacao" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void perform(() => conclude({ data: { queueItemId: action.queueItemId ?? "", outcome: "SIM" } }) as Promise<Snapshot>, "Ligação registrada.")}>Atendeu</Button>
                  <Button size="sm" disabled={busy} onClick={() => void perform(() => conclude({ data: { queueItemId: action.queueItemId ?? "", outcome: "NAO" } }) as Promise<Snapshot>, "Continuação liberada.")}>Não atendeu</Button>
                </div>
              ) : (
                <Button size="sm" disabled={busy} onClick={() => void perform(() => conclude({ data: { queueItemId: action.queueItemId ?? "" } }) as Promise<Snapshot>, "Mensagem simulada como concluída.")}>Concluir simulação</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
