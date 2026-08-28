/**
 * APRESENTAÇÃO DIGITAL (E20) NA FICHA DO INVESTIDOR.
 *
 * Rótulo oficial da operação: "E6 — Apresentação Digital". A chave
 * técnica E20 permanece intocada no banco e no histórico.
 *
 * A tela não decide nada: o servidor responde qual é o convite vigente,
 * reutiliza o link ativo e só emite um novo quando isso for pedido
 * explicitamente — porque um convite novo encerra o anterior e abre uma
 * nova instância de cadência.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, RefreshCw, Copy, Check } from "lucide-react";
import { estadoE20, emitirE20 } from "@/lib/relationship/e20.functions";
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
  const [current, setCurrent] = useState<Occurrence | null>(null);
  const [history, setHistory] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const state = await readState({ data: { leadId: investorId } });
      setCurrent((state.current as Occurrence | null) ?? null);
      setHistory((state.history as Occurrence[]) ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a apresentação.");
    } finally {
      setLoading(false);
    }
  }, [investorId, readState]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function generate(force: boolean) {
    setWorking(true);
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

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

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
            onClick={() => void generate(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--foreground)] transition hover:border-[color:var(--gold)] disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Gerar novo convite
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

      {loading ? (
        <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">Carregando apresentação…</p>
      ) : current ? (
        <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Convite vigente · {remainingLabel(current.expiresAt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded bg-[color:var(--muted)] px-2 py-1 text-xs text-[color:var(--foreground)]">
              {current.linkUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyLink(current.linkUrl)}
              className="inline-flex items-center gap-1.5 rounded border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--foreground)] transition hover:border-[color:var(--gold)]"
            >
              {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
            Emitido em {dateLabel(current.generatedAt)} · expira em {dateLabel(current.expiresAt)} ·{" "}
            {current.openCount > 0
              ? `aberto ${current.openCount}x (primeira vez em ${dateLabel(current.firstOpenedAt ?? current.generatedAt)})`
              : "ainda não aberto pelo investidor"}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">
          Nenhum convite ativo. A emissão assina automaticamente com o executivo responsável pelo
          investidor.
        </p>
      )}

      {history.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Histórico de convites ({history.length})
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
