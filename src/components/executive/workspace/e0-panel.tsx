/**
 * STATUS DA E0 (PRIMEIRO CONTATO) NA FICHA DO INVESTIDOR.
 *
 * Painel de LEITURA. Toda a decisão da E0 já acontece no servidor; aqui
 * o executivo apenas enxerga o que aconteceu de fato: enviada (com
 * destinos congelados), pendente ou bloqueada (com o motivo real).
 * Nenhum botão dispara, reprocessa ou corrige a E0.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { statusPrimeiroContato } from "@/lib/relationship/library.functions";

type Status = {
  state: "enviada" | "bloqueada" | "pendente";
  sentAt: string | null;
  simulated: boolean;
  executiveName: string | null;
  portalDestination: string | null;
  contactPhone: string | null;
  libraryVersion: number | null;
  blockReason: string | null;
  blockers: string[];
  blockedAt: string | null;
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function E0Panel({ investorId }: { investorId: string }) {
  const load = useServerFn(statusPrimeiroContato);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = (await load({ data: { leadId: investorId } })) as Status;
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o status da E0.");
    }
  }, [load, investorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tone =
    status?.state === "enviada"
      ? "text-emerald-400"
      : status?.state === "bloqueada"
        ? "text-red-400"
        : "text-[color:var(--gold)]";

  const Icon =
    status?.state === "enviada"
      ? CheckCircle2
      : status?.state === "bloqueada"
        ? ShieldAlert
        : Clock;

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
      <header className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <h3 className="text-sm font-medium text-[color:var(--foreground)]">
          E0 — Primeiro contato
        </h3>
        {status ? (
          <span className={`ml-auto text-[11px] uppercase tracking-wide ${tone}`}>
            {status.state}
          </span>
        ) : null}
      </header>

      {error ? (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      ) : !status ? (
        <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">Carregando…</p>
      ) : status.state === "enviada" ? (
        <dl className="mt-3 space-y-1 text-[11px] text-[color:var(--muted-foreground)]">
          <div>
            Enviada em {formatDateTime(status.sentAt)}
            {status.simulated ? " · simulada (a Meta não foi acionada)" : ""}
          </div>
          <div>Executivo responsável no envio: {status.executiveName ?? "—"}</div>
          <div>WhatsApp de contato congelado: {status.contactPhone ?? "—"}</div>
          <div className="truncate">Link do portal: {status.portalDestination ?? "—"}</div>
          <div>
            Versão da Biblioteca:{" "}
            {status.libraryVersion !== null ? `v${status.libraryVersion}` : "—"}
          </div>
        </dl>
      ) : status.state === "bloqueada" ? (
        <div className="mt-3 space-y-2 text-[11px]">
          <p className="text-red-400">{status.blockReason}</p>
          {status.blockers.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[color:var(--muted-foreground)]">
              {status.blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-[color:var(--muted-foreground)]">
            Registrado em {formatDateTime(status.blockedAt)}. A E0 sai automaticamente assim
            que o destino faltante for corrigido em Gestão de Usuários.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">
          Nenhum primeiro contato registrado para este lead até o momento.
        </p>
      )}
    </section>
  );
}
