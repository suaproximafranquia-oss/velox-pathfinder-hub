/**
 * APRESENTAÇÃO DIGITAL (E20) NA FICHA DO INVESTIDOR.
 *
 * Rótulo oficial da operação: "E6 — Apresentação Digital". A chave
 * técnica E20 permanece intocada no banco e no histórico.
 *
 * Este é o ÚNICO lugar da plataforma onde a apresentação é gerada. A
 * tela não decide nada: o servidor responde qual é o convite vigente,
 * reutiliza o link ativo e só emite um novo quando isso for pedido
 * explicitamente — com confirmação, porque um convite novo encerra o
 * anterior e abre uma nova instância de cadência.
 *
 * Estados são independentes: gerar ≠ copiar ≠ enviar ≠ abrir. Copiar a
 * mensagem nunca é registrado como envio.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, RefreshCw, Copy, Check, Eye, XCircle } from "lucide-react";
import {
  estadoE20,
  emitirE20,
  registrarCopiaE20,
  encerrarE20,
  auditoriaE20,
  mensagemDaE20,
} from "@/lib/relationship/e20.functions";
import { toast } from "sonner";

type Occurrence = {
  id: string;
  token: string;
  linkUrl: string;
  status: string;
  generatedAt: string;
  expiresAt: string;
  firstOpenedAt: string | null;
  openCount: number;
};

type AccessRow = { id: string; accessed_at: string; outcome: string };
type EventRow = {
  id: string;
  event: string;
  at: string;
  reason: string | null;
  actor_name: string | null;
};

const EVENT_LABEL: Record<string, string> = {
  gerada: "Apresentação gerada",
  mensagem_copiada: "Mensagem copiada",
  link_copiado: "Link copiado",
  mensagem_enviada: "Mensagem enviada",
  aberta: "Investidor abriu a apresentação",
  expirada: "Apresentação expirada",
  encerrada: "Apresentação encerrada",
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function remainingLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expirado";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} dia${days > 1 ? "s" : ""} restante${days > 1 ? "s" : ""}`;
  const hours = Math.max(1, Math.floor(ms / 3600000));
  return `${hours}h restante${hours > 1 ? "s" : ""}`;
}

export function E20Panel({ investorId }: { investorId: string }) {
  const readState = useServerFn(estadoE20);
  const issue = useServerFn(emitirE20);
  const logCopy = useServerFn(registrarCopiaE20);
  const close = useServerFn(encerrarE20);
  const readAudit = useServerFn(auditoriaE20);
  const readMessage = useServerFn(mensagemDaE20);

  const [current, setCurrent] = useState<Occurrence | null>(null);
  const [history, setHistory] = useState<Occurrence[]>([]);
  const [accesses, setAccesses] = useState<AccessRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [message, setMessage] = useState<{ body: string | null; reason: string | null }>({
    body: null,
    reason: null,
  });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState<"mensagem" | "link" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [closingReason, setClosingReason] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [state, audit] = await Promise.all([
        readState({ data: { leadId: investorId } }),
        readAudit({ data: { leadId: investorId } }),
      ]);
      const active = (state.current as Occurrence | null) ?? null;
      setCurrent(active);
      setHistory((state.history as Occurrence[]) ?? []);
      setAccesses((audit.accesses as AccessRow[]) ?? []);
      setEvents((audit.events as EventRow[]) ?? []);
      if (active) {
        const msg = await readMessage({
          data: { leadId: investorId, occurrenceId: active.id },
        });
        setMessage({ body: msg.body, reason: msg.reason });
      } else {
        setMessage({ body: null, reason: null });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a apresentação.");
    } finally {
      setLoading(false);
    }
  }, [investorId, readState, readAudit, readMessage]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function generate(force: boolean) {
    setWorking(true);
    setConfirming(false);
    try {
      const result = await issue({
        data: { leadId: investorId, baseUrl: window.location.origin, force },
      });
      if (!result.issued) {
        toast.error(result.reason);
        return;
      }
      if (result.reused) toast.success("Convite vigente reaproveitado.");
      else if (result.messageBlockedReason) toast.warning(result.messageBlockedReason);
      else toast.success("Apresentação digital gerada.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar a apresentação.");
    } finally {
      setWorking(false);
    }
  }

  async function copy(kind: "mensagem" | "link", text: string, occurrenceId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
      // Copiar é apenas copiar: o sistema NUNCA presume que a mensagem
      // manual de WhatsApp foi enviada.
      await logCopy({ data: { leadId: investorId, occurrenceId, kind } });
      await refresh();
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function handleClose(occurrenceId: string) {
    const reason = (closingReason ?? "").trim();
    if (!reason) {
      toast.error("Informe o motivo do encerramento.");
      return;
    }
    setWorking(true);
    try {
      const result = await close({ data: { occurrenceId, reason } });
      if (!result.closed) toast.error(result.reason ?? "Não foi possível encerrar.");
      else toast.success("Apresentação encerrada.");
      setClosingReason(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao encerrar.");
    } finally {
      setWorking(false);
    }
  }

  const openedCount = accesses.filter((a) => a.outcome === "ok").length;
  const firstAccess = accesses.length ? accesses[accesses.length - 1]?.accessed_at : null;
  const lastAccess = accesses.length ? accesses[0]?.accessed_at : null;

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
            E6 — Apresentação Digital
          </h3>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            Convite exclusivo ao Portal, válido por 7 dias a partir da emissão.
          </p>
        </div>
        {current ? (
          <button
            type="button"
            disabled={working}
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)] transition hover:border-[color:var(--gold)] disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Nova emissão
          </button>
        ) : (
          <button
            type="button"
            disabled={working || loading}
            onClick={() => void generate(false)}
            className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--gold)] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--navy-deep,#0b1b33)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Gerar apresentação digital
          </button>
        )}
      </header>

      {confirming && current ? (
        <div className="mt-4 rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 p-4 text-xs text-[color:var(--foreground)]">
          <p>
            Uma nova emissão <strong>encerra e invalida</strong> a apresentação atual. O link já
            enviado ao investidor deixará de funcionar.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={working}
              onClick={() => void generate(true)}
              className="rounded border border-[color:var(--gold)] px-3 py-1.5 uppercase tracking-[0.14em]"
            >
              Confirmar nova emissão
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-[color:var(--border)] px-3 py-1.5 uppercase tracking-[0.14em]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">Carregando apresentação…</p>
      ) : current ? (
        <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Apresentação ativa · {remainingLabel(current.expiresAt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded bg-[color:var(--muted)] px-2 py-1 text-xs text-[color:var(--foreground)]">
              {current.linkUrl}
            </code>
            <a
              href={current.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--foreground)] transition hover:border-[color:var(--gold)]"
            >
              <Eye className="h-3 w-3" aria-hidden />
              Abrir
            </a>
            <button
              type="button"
              onClick={() => void copy("link", current.linkUrl, current.id)}
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--foreground)] transition hover:border-[color:var(--gold)]"
            >
              {copied === "link" ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              Copiar link
            </button>
            {message.body ? (
              <button
                type="button"
                onClick={() => void copy("mensagem", message.body!, current.id)}
                className="inline-flex items-center gap-1.5 rounded border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--foreground)] transition hover:border-[color:var(--gold)]"
              >
                {copied === "mensagem" ? (
                  <Check className="h-3 w-3" aria-hidden />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden />
                )}
                Copiar mensagem
              </button>
            ) : null}
          </div>

          {message.body ? (
            <pre className="mt-3 whitespace-pre-wrap rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-3 text-xs text-[color:var(--foreground)]">
              {message.body}
            </pre>
          ) : (
            <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
              {message.reason ??
                "Mensagem oficial ainda não disponível na Biblioteca — nenhum texto alternativo é criado."}
            </p>
          )}

          <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
            Emitida em {dateLabel(current.generatedAt)} · expira em {dateLabel(current.expiresAt)}
          </p>

          <div className="mt-3 grid gap-1 text-xs text-[color:var(--muted-foreground)]">
            <span>
              {openedCount > 0 ? (
                <strong className="text-[color:var(--gold)]">Investidor visualizou</strong>
              ) : (
                "Ainda não aberto pelo investidor"
              )}{" "}
              · {openedCount} abertura(s)
            </span>
            {firstAccess ? <span>Primeiro acesso: {dateLabel(firstAccess)}</span> : null}
            {lastAccess ? <span>Último acesso: {dateLabel(lastAccess)}</span> : null}
          </div>

          <div className="mt-4 border-t border-[color:var(--border)] pt-3">
            {closingReason === null ? (
              <button
                type="button"
                onClick={() => setClosingReason("")}
                className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                Encerrar apresentação
              </button>
            ) : (
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                  Motivo do encerramento (obrigatório)
                </label>
                <input
                  value={closingReason}
                  onChange={(e) => setClosingReason(e.target.value)}
                  className="w-full rounded border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs"
                  placeholder="Ex.: investidor pediu para pausar o contato"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void handleClose(current.id)}
                    className="rounded border border-[color:var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]"
                  >
                    Confirmar encerramento
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosingReason(null)}
                    className="rounded border border-[color:var(--border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">
          Nenhum convite ativo. A emissão assina automaticamente com o executivo responsável pelo
          investidor.
        </p>
      )}

      {events.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Trilha da apresentação ({events.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {events.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)]"
              >
                <span className="text-[color:var(--foreground)]">
                  {EVENT_LABEL[item.event] ?? item.event}
                </span>
                <span>{dateLabel(item.at)}</span>
                <span>{item.actor_name ?? "—"}</span>
                {item.reason ? <span className="w-full">Motivo: {item.reason}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}

      {history.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Histórico de apresentações ({history.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)]"
              >
                <span>{dateLabel(item.generatedAt)}</span>
                <span className="uppercase tracking-[0.14em]">{item.status}</span>
                <span>{item.openCount > 0 ? `${item.openCount} abertura(s)` : "sem abertura"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
