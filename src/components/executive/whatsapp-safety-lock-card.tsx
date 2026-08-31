import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { readWhatsappSafetyLock } from "@/lib/whatsapp-safety-lock.functions";

type Status = Awaited<ReturnType<typeof readWhatsappSafetyLock>>;

/**
 * Indicador administrativo — apenas informativo. Não existe controle de
 * liberação aqui: a ativação do envio real é exclusivamente server-side.
 */
export function WhatsappSafetyLockCard() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    readWhatsappSafetyLock()
      .then((s) => alive && setStatus(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const locked = status?.locked ?? true;

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[color:var(--muted)]/40 p-2">
          {locked ? <Lock className="size-5" /> : <Unlock className="size-5" />}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-wide">
            {locked
              ? "🔒 Envio real de WhatsApp bloqueado"
              : "Envio real de WhatsApp habilitado"}
          </h3>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            Liberação temporal mínima: 01/01/2029. A data não ativa nada sozinha — após
            2029 o envio real ainda depende de autorização explícita no servidor.
          </p>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            Status: <strong>{locked ? "ENVIO REAL DESATIVADO" : "ENVIO REAL ATIVO"}</strong>
            {status?.reason ? ` — ${status.reason}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
