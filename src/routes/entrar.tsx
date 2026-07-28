import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getExecutiveBySlug } from "@/lib/executive-auth";
import { setResponsibleExecutiveSlug } from "@/lib/responsible-executive";
import { getPortalSession, startPortalSession } from "@/lib/portal-session";

type GatewaySearch = {
  next?: string;
  executive?: string;
  origin?: string;
};

export const Route = createFileRoute("/entrar")({
  validateSearch: (search: Record<string, unknown>): GatewaySearch => ({
    next: typeof search.next === "string" ? search.next : undefined,
    executive: typeof search.executive === "string" ? search.executive : undefined,
    origin: typeof search.origin === "string" ? search.origin : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Identificação — Portal Velox" },
      {
        name: "description",
        content:
          "Identifique-se para iniciar sua jornada no Portal Velox e manter seu progresso conectado ao executivo responsável.",
      },
      { property: "og:title", content: "Identificação — Portal Velox" },
      {
        property: "og:description",
        content:
          "Acesso ao Gateway do Portal Velox para iniciar Manual, Material Institucional e Simulador com perfil único.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GatewayPage,
});

function GatewayPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as GatewaySearch;
  const nextPath = sanitizeNext(search.next);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const executive = useMemo(() => {
    if (!search.executive) return null;
    return getExecutiveBySlug(search.executive) ?? null;
  }, [search.executive]);

  useEffect(() => {
    if (executive) setResponsibleExecutiveSlug(executive.slug);
  }, [executive]);

  useEffect(() => {
    const session = getPortalSession();
    if (!session) return;
    if (executive) setResponsibleExecutiveSlug(executive.slug);
    navigate({ to: nextPath, replace: true });
  }, [executive, navigate, nextPath]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2) {
      setError("Informe seu nome para continuar.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Informe um e-mail válido para restaurar ou criar seu perfil.");
      return;
    }
    if (executive) setResponsibleExecutiveSlug(executive.slug);
    startPortalSession({
      name: trimmedName,
      email: trimmedEmail,
      origin: search.origin ?? (executive ? `Link personalizado · ${executive.name}` : "Portal Velox"),
      nextPath,
    });
    navigate({ to: nextPath, replace: true });
  };

  return (
    <main className="min-h-screen px-6 py-10 md:px-10">
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="portal-eyebrow" style={{ color: "var(--brand-orange)" }}>
            Gateway de entrada
          </p>
          <h1 className="portal-serif mt-5 text-balance text-4xl leading-tight md:text-6xl">
            Antes de iniciar, vamos identificar sua jornada.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--muted-foreground)] md:text-lg">
            O Portal Velox usa um perfil único para conectar Manual, Material
            Institucional, Simulador e Workspace do executivo — sem duplicar seu
            cadastro e sem interromper sua leitura.
          </p>
          <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--gold)]" />
              <p className="text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                Seus dados são usados para restaurar o progresso e vincular sua
                jornada ao executivo responsável. O contato comercial continua
                disponível apenas quando você decidir avançar.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)]/70 p-6 shadow-2xl md:p-8"
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--gold)]">
            Identificação simples
          </p>
          <h2 className="portal-serif mt-3 text-2xl">Acesse sua experiência</h2>
          {executive ? (
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              Você está entrando pelo link de {executive.name}. O vínculo será
              preservado durante toda a jornada.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              Se já existir um perfil com este e-mail, seu progresso será
              restaurado automaticamente.
            </p>
          )}

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                Nome
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)]"
                placeholder="Seu nome completo"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                E-mail
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--gold)]"
                placeholder="voce@email.com"
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-[color:var(--destructive)]">{error}</p> : null}

          <button
            type="submit"
            className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-6 py-4 text-sm font-medium text-[color:var(--gold-foreground)] transition hover:shadow-[0_15px_50px_-15px_var(--gold)]"
          >
            Continuar jornada
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
}

function sanitizeNext(next?: string): string {
  if (!next || !next.startsWith("/")) return "/manual";
  if (next.startsWith("/executivo")) return "/manual";
  if (next.startsWith("/entrar")) return "/manual";
  return next;
}