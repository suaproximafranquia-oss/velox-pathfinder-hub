/**
 * Configurações → Integrações → Green Sales.
 *
 * Único lugar do Portal onde a conta Green Sales é configurada. O CRM
 * (Portal dos Leads) apenas exibe o status. Credenciais continuam
 * cifradas no servidor e vinculadas ao usuário autenticado.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2 } from "lucide-react";
import {
  connectGreenSales,
  disconnectGreenSales,
  getGreenSalesConnection,
  type CrmConnectionState,
} from "@/lib/crm/connection.functions";

export function GreenSalesConnectionSection() {
  const fetchConnection = useServerFn(getGreenSalesConnection);
  const saveConnection = useServerFn(connectGreenSales);
  const dropConnection = useServerFn(disconnectGreenSales);

  const [state, setState] = useState<CrmConnectionState | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await fetchConnection({}));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao ler a conexão.");
    }
  }, [fetchConnection]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      setState(await saveConnection({ data: { email, password } }));
      setFeedback("Conta Green Sales conectada e validada.");
      setPassword("");
      setOpen(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível conectar a conta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      setState(await dropConnection({}));
      setFeedback("Conexão encerrada.");
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(state?.connected);

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <Link2 className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <h2 className="font-display text-base">Green Sales</h2>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">
            {connected
              ? `Conectado como ${state?.owner ?? "—"}${state?.accountEmail ? ` · ${state.accountEmail}` : ""}`
              : "Nenhuma conta Green Sales conectada a este usuário."}
          </p>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            A conexão é pessoal e as credenciais ficam cifradas no servidor.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-[color:var(--gold)] px-4 py-1.5 text-[11px] text-[color:var(--gold)] transition hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)]"
        >
          {connected ? "Reautorizar" : "Conectar conta"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
        >
          Validar conexão
        </button>
        {connected && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDisconnect()}
            className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:border-red-400/50 hover:text-red-400"
          >
            Desconectar
          </button>
        )}
      </div>

      {open && (
        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail da conta Green Sales"
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/50 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/50 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border border-[color:var(--gold)]/50 px-4 py-2 text-sm text-[color:var(--gold)] disabled:opacity-50"
          >
            {busy ? "Validando…" : "Salvar"}
          </button>
        </form>
      )}

      {feedback ? (
        <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">{feedback}</p>
      ) : null}
    </section>
  );
}
