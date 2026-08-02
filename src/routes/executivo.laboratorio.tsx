import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Cake,
  ClipboardCheck,
  Trophy,
  Building2,
  LogOut,
  Trash2,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  loadUsers,
  signOut,
  type ExecutiveSession,
  type ExecutiveUser,
} from "@/lib/executive-auth";
import {
  listScheduled,
  scheduleEvent,
  type RecognitionType,
  type ScheduledRecognition,
} from "@/lib/recognition/engine";
import { resetHomologationData } from "@/lib/homologation-reset";
import { recordWhatsappReply } from "@/lib/crm/whatsapp-inbox";

export const Route = createFileRoute("/executivo/laboratorio")({
  head: () => ({
    meta: [{ title: "Laboratório Atlas — Simulações" }, { name: "robots", content: "noindex" }],
  }),
  component: LaboratorioPage,
});

type SimSpec = {
  key: string;
  label: string;
  description: string;
  icon: typeof Cake;
  type: RecognitionType;
  occurrenceSeed: string;
  payload?: Record<string, unknown>;
};

const SIMS: SimSpec[] = [
  {
    key: "birthday",
    label: "Simular Aniversário",
    description:
      "Registra uma comemoração de aniversário. Aparece no próximo login como modal de reconhecimento.",
    icon: Cake,
    type: "birthday",
    occurrenceSeed: "lab-birthday",
  },
  {
    key: "kpi_pending",
    label: "Simular KPI Pendente",
    description:
      "Simula lançamentos pendentes do dia anterior. O engine encaminhará ao KPI Manager.",
    icon: ClipboardCheck,
    type: "kpi_pending",
    occurrenceSeed: "lab-kpi",
  },
  {
    key: "campaign_level",
    label: "Simular Campanha",
    description:
      "Reconhece a conquista de um novo nível na Campanha Velox (Mestre, Doutor, PhD ou Supreme).",
    icon: Trophy,
    type: "campaign_level",
    occurrenceSeed: "lab-campaign",
  },
  {
    key: "company_anniversary",
    label: "Simular Aniversário de Empresa",
    description:
      "Abre a tela comemorativa dedicada, com dados reais do colaborador (tempo de casa, marcos operacionais).",
    icon: Building2,
    type: "company_anniversary",
    occurrenceSeed: "lab-company",
  },
];

function LaboratorioPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    if (s.activeRole !== "super_admin") return void navigate({ to: "/executivo/home" });
    setSession(s);
    setTargetUserId(s.userId);
  }, [navigate]);

  const users: ExecutiveUser[] = useMemo(() => loadUsers().filter((u) => u.status === "ativo"), []);
  const scheduled: ScheduledRecognition[] = useMemo(() => listScheduled(), [tick]);

  if (!session) return null;

  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

  function handleSchedule(sim: SimSpec) {
    if (!targetUserId) return;
    scheduleEvent({
      userId: targetUserId,
      type: sim.type,
      occurrence: `${sim.occurrenceSeed}-${stamp()}`,
      payload: sim.payload,
    });
    setTick((n) => n + 1);
  }

  function handleLogoutNow() {
    signOut();
    navigate({ to: "/executivo" });
  }

  const targetName = users.find((u) => u.id === targetUserId)?.name ?? "usuário selecionado";

  return (
    <ExecutiveShell session={session} title="Laboratório Atlas">
      <div className="max-w-4xl space-y-8">
        <div className="rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--card)]/40 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)]">
              <FlaskConical className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
                Ambiente exclusivo do Administrador
              </p>
              <h2 className="font-display text-xl mt-1">Simule eventos do Recognition Engine</h2>
              <p className="text-sm text-[color:var(--muted-foreground)] mt-2 leading-relaxed">
                Os botões abaixo <strong>não disparam nada imediatamente</strong>. Eles registram
                uma simulação vinculada ao usuário selecionado. Após <em>logout e novo login</em>{" "}
                desse usuário, o engine executará o evento como aconteceria em produção — e o
                removerá automaticamente após a exibição.
              </p>
            </div>
          </div>
        </div>

        <HomologationResetCard />

        <WhatsappReplySimulator />

        <section>
          <label className="block text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
            Usuário-alvo da simulação
          </label>
          <select
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/60 px-4 py-2.5 text-sm outline-none focus:border-[color:var(--gold)]/60"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.email}
              </option>
            ))}
          </select>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {SIMS.map((sim) => {
            const Icon = sim.icon;
            return (
              <button
                key={sim.key}
                type="button"
                onClick={() => handleSchedule(sim)}
                className="group text-left rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5 hover:border-[color:var(--gold)]/40 hover:bg-[color:var(--card)]/60 transition"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 text-[color:var(--gold)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="font-display text-base">{sim.label}</p>
                </div>
                <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
                  {sim.description}
                </p>
              </button>
            );
          })}
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg">Simulações agendadas</h3>
            {scheduled.length > 0 && (
              <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
                Aguardando próximo login
              </span>
            )}
          </div>
          {scheduled.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Nenhuma simulação pendente. Registre uma acima para testar o fluxo real.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]/60">
              {scheduled.map((s, i) => {
                const u = users.find((x) => x.id === s.userId);
                return (
                  <li
                    key={`${s.userId}-${s.occurrence}-${i}`}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">
                        {u?.name ?? s.userId} ·{" "}
                        <span className="text-[color:var(--muted-foreground)]">{s.type}</span>
                      </p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)]/80">
                        {s.occurrence}
                      </p>
                    </div>
                    <Trash2
                      className="h-4 w-4 text-[color:var(--muted-foreground)]/60"
                      aria-hidden
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[11px] text-[color:var(--muted-foreground)] mt-4 leading-relaxed">
            Após a exibição no login, cada simulação é removida automaticamente do buffer — nenhuma
            repetição em logins seguintes.
          </p>
        </section>

        {targetUserId === session.userId && (
          <div className="rounded-2xl border border-[color:var(--gold)]/25 bg-[color:var(--card)]/40 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm">
                Pronto para testar como <strong>{targetName}</strong>?
              </p>
              <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
                Faça logout e entre novamente para o engine executar as simulações agendadas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogoutNow}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-medium text-[color:var(--gold-foreground)] hover:opacity-90 transition"
            >
              <LogOut className="h-4 w-4" /> Sair para testar
            </button>
          </div>
        )}
      </div>
    </ExecutiveShell>
  );
}
/**
 * DEF 2.4.19 §12 / 2.4.20 §13 — RESET do ambiente de homologação.
 *
 * Remove apenas dados operacionais de demonstração. Usuários,
 * permissões, templates, estrutura, banco e integrações permanecem
 * intactos.
 */
function HomologationResetCard() {
  return <ResetCardBody />;
}

/**
 * DEF 3.0.2 §5 — simulação da resposta oficial da Meta.
 *
 * Em produção quem informa o CRM é o Webhook. Na homologação, enquanto
 * as credenciais oficiais não estão provisionadas, o Administrador pode
 * reproduzir a resposta CONFIRMAR / NÃO CONFIRMAR de um número.
 */
function WhatsappReplySimulator() {
  const [phone, setPhone] = useState("");
  const [feedback, setFeedback] = useState("");

  const reply = (status: "confirmado" | "recusado") => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setFeedback("Informe o WhatsApp completo, com DDD.");
      return;
    }
    recordWhatsappReply(digits, status);
    // Espelha a resposta na base oficial de validações, exatamente como
    // o Webhook da Meta fará quando as credenciais forem provisionadas.
    void simulateWhatsappReply({ data: { phone: digits, status } }).catch(() => {
      /* simulação local já registrada */
    });
    setFeedback(
      status === "confirmado"
        ? `Resposta CONFIRMAR registrada para ${digits}. O Portal libera os módulos automaticamente.`
        : `Resposta NÃO CONFIRMAR registrada para ${digits}. O relacionamento segue bloqueado.`,
    );
  };

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
        Canal oficial WhatsApp · Homologação
      </p>
      <h2 className="font-display text-xl mt-1">Simular resposta do Template Oficial</h2>
      <p className="text-sm text-[color:var(--muted-foreground)] mt-2 leading-relaxed">
        Reproduz exatamente o que o Webhook da Meta informa ao CRM quando o
        investidor toca em CONFIRMAR ou NÃO CONFIRMAR.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="55 17 99772-7337"
          className="w-full max-w-xs rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/60 px-4 py-2.5 text-sm outline-none focus:border-[color:var(--gold)]/60"
        />
        <button
          type="button"
          onClick={() => reply("confirmado")}
          className="cursor-pointer rounded-full bg-[color:var(--gold)] px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-[color:var(--gold-foreground)] transition hover:scale-[1.01]"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => reply("recusado")}
          className="cursor-pointer rounded-full border border-[color:var(--border)] px-4 py-2.5 text-xs uppercase tracking-[0.16em] transition hover:border-[color:var(--gold)]"
        >
          Não confirmar
        </button>
      </div>
      {feedback ? (
        <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">{feedback}</p>
      ) : null}
    </div>
  );
}

function ResetCardBody() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const run = () => {
    const summary = resetHomologationData();
    setDone(summary.removed.length);
    setConfirming(false);
    if (typeof window !== "undefined") window.setTimeout(() => window.location.reload(), 900);
  };

  return (
    <div className="rounded-2xl border border-[color:var(--destructive)]/35 bg-[color:var(--card)]/40 p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]">
          <Trash2 className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--destructive)]">
            Homologação Release 2.4
          </p>
          <h2 className="font-display text-xl mt-1">RESET do ambiente de homologação</h2>
          <p className="text-sm text-[color:var(--muted-foreground)] mt-2 leading-relaxed">
            Remove definitivamente Leads, conversas, alertas, auditorias, reuniões, cards, timeline,
            jornadas e eventos simulados. Usuários, permissões, templates, estrutura, banco e
            integrações permanecem intactos. A partir do RESET a homologação utiliza exclusivamente
            dados reais.
          </p>
          {done !== null ? (
            <p className="mt-3 text-sm text-[color:var(--gold)]">
              RESET concluído — {done} bases operacionais limpas. Recarregando…
            </p>
          ) : confirming ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={run}
                className="cursor-pointer rounded-xl border border-[color:var(--destructive)]/50 bg-[color:var(--destructive)]/15 px-4 py-2 text-sm transition hover:scale-[1.02]"
              >
                Confirmar RESET definitivo
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="cursor-pointer rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm transition hover:scale-[1.02]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-4 cursor-pointer rounded-xl border border-[color:var(--destructive)]/40 px-4 py-2 text-sm transition hover:scale-[1.02] hover:bg-[color:var(--destructive)]/10"
            >
              Executar RESET
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
