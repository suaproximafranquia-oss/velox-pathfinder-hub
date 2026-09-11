import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  closeWorkspacePortalGateFn,
  openWorkspacePortalGateFn,
  workspacePortalGateStatusFn,
  type WorkspacePortalGateView,
} from "@/lib/testing/workspace-portal-gate.functions";

export function WorkspacePortalGateCard() {
  const status = useServerFn(workspacePortalGateStatusFn);
  const closeGate = useServerFn(closeWorkspacePortalGateFn);
  const openGate = useServerFn(openWorkspacePortalGateFn);
  const [view, setView] = useState<WorkspacePortalGateView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await status({} as never));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar o portão.");
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<WorkspacePortalGateView>) => {
    setBusy(true);
    setError(null);
    try {
      setView(await action());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  };

  const closed = view?.closed !== false;
  const Icon = closed ? LockKeyhole : LockKeyholeOpen;
  return (
    <section className="rounded-md border border-border bg-card/40 p-5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-gold" />
        <div className="flex-1">
          <h2 className="font-display text-lg text-foreground">
            {closed ? "Portal dos Leads — bloqueado para homologação" : "Portal dos Leads — operação normal"}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            O Portal continua disponível para consulta. O cadeado impede somente novos cards operacionais locais na Financeira.
          </p>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <div className="mt-4">
            {closed ? (
              <Button variant="outline" disabled={busy} onClick={() => void run(() => openGate({} as never))}>
                <LockKeyholeOpen /> Liberar operação normal
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void run(() => closeGate({} as never))}>
                <LockKeyhole /> Bloquear para homologação
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}