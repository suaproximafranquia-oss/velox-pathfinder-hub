/**
 * Meu Perfil → "WhatsApp do executivo".
 *
 * O número é do executivo autenticado e vive no servidor
 * (`executive_profiles.whatsapp`). O identificador do executivo NUNCA
 * vem do navegador: é resolvido pela identidade server-side, e a própria
 * função de gravação recusa alterar a ficha de outra pessoa.
 *
 * Nada aqui altera E0, cadência ou titularidade: o número é apenas o
 * dado oficial de contato do executivo.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { identidadeDoUsuario } from "@/lib/executive-auth.functions";
import { salvarPerfilExecutivo } from "@/lib/executive-directory.functions";
import { normalizeWhatsappNumber } from "@/lib/whatsapp-number";

export function ExecutiveWhatsappCard() {
  const readIdentity = useServerFn(identidadeDoUsuario);
  const saveProfile = useServerFn(salvarPerfilExecutivo);

  const [executiveId, setExecutiveId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const identity = await readIdentity({});
      setExecutiveId(identity.executiveId ?? null);
      setValue(identity.whatsapp ?? "");
    } catch {
      setError("Não foi possível ler seus dados no servidor.");
    }
  }, [readIdentity]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!executiveId) return;
    setError(null);
    setFeedback(null);
    const trimmed = value.trim();
    if (trimmed.length > 0 && !normalizeWhatsappNumber(trimmed).valid) {
      setError("Informe o número com DDD, por exemplo (11) 91234-5678.");
      return;
    }
    setBusy(true);
    try {
      await saveProfile({ data: { executiveId, whatsapp: trimmed } });
      setFeedback("Número de WhatsApp salvo.");
    } catch {
      setError("Não foi possível salvar o número.");
    } finally {
      setBusy(false);
    }
  }

  const normalized = normalizeWhatsappNumber(value);

  return (
    <section className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/40 text-[color:var(--gold)]">
          <MessageCircle className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <h2 className="font-display text-base">WhatsApp do executivo</h2>
      </div>

      <p className="text-[11px] text-[color:var(--muted-foreground)]">
        Número pessoal de atendimento, com DDD. Fica guardado no servidor e é
        usado para direcionar o investidor ao executivo responsável.
      </p>

      <form className="mt-3 flex flex-wrap gap-2" onSubmit={handleSubmit}>
        <input
          type="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="(11) 91234-5678"
          className="min-w-[220px] flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/50 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60"
        />
        <button
          type="submit"
          disabled={busy || !executiveId}
          className="rounded-xl border border-[color:var(--gold)]/50 px-4 py-2 text-sm text-[color:var(--gold)] disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Salvar número"}
        </button>
      </form>

      {normalized.valid ? (
        <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
          Número reconhecido: +{normalized.display}
        </p>
      ) : null}
      {feedback ? (
        <p className="mt-2 text-[11px] text-emerald-400">{feedback}</p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-red-400">{error}</p> : null}
    </section>
  );
}
