import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PartyPopper, Calendar, TrendingUp, Trophy, GraduationCap, Sparkles, ArrowRight } from "lucide-react";
import {
  getSession,
  loadUsers,
  type ExecutiveSession,
  type ExecutiveUser,
} from "@/lib/executive-auth";
import {
  markViewed,
  nextPendingEvent,
  type RecognitionEvent,
} from "@/lib/recognition/engine";
import { Confetti } from "@/components/recognition/confetti";
import { WORKSPACE } from "@/config/workspace";

export const Route = createFileRoute("/executivo/celebracao")({
  head: () => ({
    meta: [
      { title: "Aniversário de Empresa — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CelebracaoPage,
});

function CelebracaoPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [event, setEvent] = useState<RecognitionEvent | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
    const evt = nextPendingEvent(s.userId);
    if (evt && evt.type === "company_anniversary") setEvent(evt);
  }, [navigate]);

  const user: ExecutiveUser | null = useMemo(() => {
    if (!session) return null;
    return loadUsers().find((u) => u.id === session.userId) ?? null;
  }, [session]);

  if (!session || !user) return null;

  const years = user.admissionDate ? yearsSince(user.admissionDate) : null;

  function conclude() {
    if (event) markViewed(event.id);
    navigate({ to: "/executivo/home" });
  }

  // Cards exibidos apenas quando existem dados reais.
  const facts: Array<{ icon: typeof Calendar; label: string; value: string }> = [];
  if (user.admissionDate) {
    facts.push({
      icon: Calendar,
      label: "Data de admissão",
      value: formatDateBR(user.admissionDate),
    });
  }
  if (years !== null) {
    facts.push({
      icon: TrendingUp,
      label: "Tempo de casa",
      value: years === 0 ? "menos de 1 ano" : `${years} ${years === 1 ? "ano" : "anos"}`,
    });
  }
  if (user.title) {
    facts.push({
      icon: GraduationCap,
      label: "Função atual",
      value: user.title,
    });
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[color:var(--navy-deep)] text-[color:var(--foreground)]">
      <Confetti active />
      <div className="relative min-h-full flex flex-col">
        <header className="px-6 pt-8">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)]">
            {WORKSPACE.workspaceName} · Reconhecimento
          </p>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-3xl mx-auto">
          <span
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl mb-6"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(212,175,55,0.28), rgba(212,175,55,0.05))",
              border: "1px solid rgba(212,175,55,0.4)",
            }}
            aria-hidden
          >
            <PartyPopper className="h-9 w-9 text-[color:var(--gold)]" />
          </span>

          <h1 className="font-display text-4xl sm:text-5xl leading-tight mb-4">
            {years !== null && years > 0
              ? `${years} ${years === 1 ? "ano" : "anos"} caminhando ao nosso lado`
              : "Um novo ciclo com a gente"}
          </h1>
          <p className="text-base sm:text-lg text-[color:var(--muted-foreground)] leading-relaxed max-w-xl">
            Obrigado, <strong className="text-[color:var(--foreground)]">{user.name.split(" ")[0]}</strong>,
            por seguir construindo essa história junto com o time. Este momento
            é uma pausa para reconhecer sua trajetória.
          </p>

          {facts.length > 0 && (
            <section className="grid gap-3 sm:grid-cols-3 mt-10 w-full">
              {facts.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.label}
                    className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--card)]/40 px-5 py-4 text-left"
                  >
                    <Icon className="h-4 w-4 text-[color:var(--gold)] mb-2" />
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                      {f.label}
                    </p>
                    <p className="text-sm mt-1">{f.value}</p>
                  </div>
                );
              })}
            </section>
          )}

          <div className="mt-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 px-6 py-5 max-w-2xl text-left">
            <div className="flex items-center gap-2 mb-2 text-[color:var(--gold)]">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-[0.22em]">Uma nota da equipe</span>
            </div>
            <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
              Cada aniversário de casa é um lembrete de que a rotina é feita de
              muitos pequenos cuidados, escolhas silenciosas e presença
              constante. Obrigado por trazer isso todos os dias.
            </p>
          </div>

          <MilestonesPlaceholder />

          <button
            type="button"
            onClick={conclude}
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-8 py-3 text-sm font-medium text-[color:var(--gold-foreground)] hover:opacity-90 transition"
          >
            Seguir para o painel <ArrowRight className="h-4 w-4" />
          </button>
        </main>

        <footer className="px-6 py-6 text-center text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          {WORKSPACE.poweredBy}
        </footer>
      </div>
    </div>
  );
}

function MilestonesPlaceholder() {
  // Marcos históricos (melhor mês, campanha mais alta, recordes) só são
  // exibidos quando existem dados reais suficientes. Sem dados, nada é
  // renderizado — nunca inventamos conteúdo nem exibimos texto de espera.
  return null;
}

function yearsSince(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let y = now.getFullYear() - d.getFullYear();
  const beforeAnniversary =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeAnniversary) y -= 1;
  return Math.max(0, y);
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// avoid unused import warning
void Trophy;