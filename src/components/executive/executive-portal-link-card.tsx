import { useCallback, useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { getMyExecutivePortalLink } from "@/lib/executive-portal-link.functions";

export function ExecutivePortalLinkCard({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getMyExecutivePortalLink();
      setUrl(result.url);
      setError(result.url ? null : "Seu link individual ainda não está disponível.");
    } catch {
      setError("Não foi possível carregar seu link individual.");
    }
  }, []);

  useEffect(() => void load(), [load]);

  async function copy() {
    if (!url) return;
    const ok = await copyToClipboard(url);
    setCopied(ok);
    setError(ok ? null : "Não foi possível copiar o link.");
    if (ok) window.setTimeout(() => setCopied(false), 1600);
  }

  if (compact) {
    return (
      <Button type="button" variant="outline" onClick={() => void copy()} disabled={!url} title={url ?? undefined}>
        {copied ? <Check /> : <Link2 />}
        {copied ? "Link copiado" : "Copiar link do Portal"}
      </Button>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <Link2 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-base">Link individual do Portal</h2>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">Seu endereço público permanente.</p>
        </div>
      </div>
      <p className="mt-3 break-all text-xs text-[color:var(--muted-foreground)]">{url ?? "Link indisponível"}</p>
      <Button className="mt-3" type="button" variant="outline" onClick={() => void copy()} disabled={!url}>
        {copied ? <Check /> : <Link2 />}
        {copied ? "Link copiado" : "Copiar link do Portal"}
      </Button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}