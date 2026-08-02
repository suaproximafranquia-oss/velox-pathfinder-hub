/**
 * ETAPA 02.1 §Doc02 — Painel de Redistribuição.
 *
 * A Gestão apenas informa o contato institucional: o responsável é
 * definido automaticamente pela fila oficial, sem escolha manual.
 */
import { useMemo, useState } from "react";
import { ArrowRightLeft, ShieldAlert } from "lucide-react";
import {
  checkOwnershipByPhone,
  peekNextExecutive,
  redistributeContact,
} from "@/lib/crm/redistribution";
import type { ExecutiveSession } from "@/lib/executive-auth";

export function RedistributionPanel({
  session,
  onDone,
}: {
  session: ExecutiveSession;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [tick, setTick] = useState(0);

  const next = useMemo(() => {
    void tick;
    return peekNextExecutive();
  }, [tick]);

  const ownership = useMemo(() => checkOwnershipByPhone(phone), [phone]);

  function submit() {
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      setFeedback({ ok: false, message: "Informe nome e WhatsApp válido do contato." });
      return;
    }
    const result = redistributeContact({
      name,
      phone,
      email,
      actorId: session.userId,
      actorName: session.name,
    });
    if (result.ok) {
      setFeedback({
        ok: true,
        message: `Contato redistribuído para ${result.executive.name}.`,
      });
      setName("");
      setPhone("");
      setEmail("");
      setTick((t) => t + 1);
      onDone();
    } else {
      setFeedback({ ok: false, message: result.reason });
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/60 px-3 py-2 text-sm outline-none placeholder:text-[color:var(--muted-foreground)]/60 focus:border-[color:var(--gold)]/50";

  return (
    <section className="mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <header className="mb-4 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-[color:var(--gold)]" />
        <h2 className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          Redistribuição de contato institucional
        </h2>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Nome do contato"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nome do contato"
        />
        <input
          className={inputClass}
          placeholder="WhatsApp com DDD"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="WhatsApp do contato"
        />
        <input
          className={inputClass}
          placeholder="E-mail (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="E-mail do contato"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Próximo da fila oficial:{" "}
          <strong className="text-[color:var(--foreground)]">
            {next?.name ?? "fila indisponível"}
          </strong>
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={ownership.owned}
          className="rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-5 py-2 text-xs uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Redistribuir
        </button>
      </div>

      {ownership.owned && (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {ownership.reason}
        </p>
      )}
      {feedback && !ownership.owned && (
        <p
          className={
            feedback.ok
              ? "mt-3 text-xs text-emerald-400"
              : "mt-3 text-xs text-red-400"
          }
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}