import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mensagemEnvioMaterialPosContato } from "@/lib/relationship/e20.functions";

type PreparedMessage = {
  body: string | null;
  reason: string | null;
  version: number | null;
  investorNameUsed: string | null;
  executiveName: string | null;
};

export function MaterialAfterContactPanel({ investorId }: { investorId: string }) {
  const prepare = useServerFn(mensagemEnvioMaterialPosContato);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<PreparedMessage | null>(null);

  async function load() {
    setOpen(true);
    setLoading(true);
    setCopied(false);
    try {
      setMessage(await prepare({ data: { leadId: investorId } }));
    } catch (error) {
      setMessage({
        body: null,
        reason: error instanceof Error ? error.message : "Não foi possível preparar a mensagem.",
        version: null,
        investorNameUsed: null,
        executiveName: null,
      });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!message?.body) return;
    try {
      await navigator.clipboard.writeText(message.body);
      setCopied(true);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar a mensagem.");
    }
  }

  return (
    <>
      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
              Enviar material após contato
            </h3>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              Prepara a mensagem atual da Biblioteca para revisão e cópia.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            Enviar material após contato
          </Button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar material após contato</DialogTitle>
            <DialogDescription>Revise o texto antes de copiar.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparando mensagem…
            </p>
          ) : message?.body ? (
            <div className="space-y-3">
              <textarea
                aria-label="Mensagem de envio de material"
                value={message.body}
                onChange={(event) =>
                  setMessage((current) => current ? { ...current, body: event.target.value } : current)
                }
                rows={12}
                className="w-full resize-y rounded-md border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-sm outline-none focus:border-[color:var(--gold)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[color:var(--muted-foreground)]">
                  Biblioteca v{message.version ?? "—"}
                </span>
                <Button type="button" size="sm" onClick={() => void copy()}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Copiada" : "Copiar mensagem"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {message?.reason ?? "Mensagem indisponível."}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}