import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Share2, Link2, Check } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  loadUsers,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { listAllInvestors } from "@/lib/executive-data";
import { onSync } from "@/lib/sync-bus";
import { listMeetings } from "@/lib/meetings";
import { onEvent } from "@/lib/events/bus";
import { InvestorCard, type InvestorCardData } from "@/components/executive/workspace/investor-card";
import { InvestorProfileView } from "@/components/executive/workspace/investor-profile-view";
import { resolveLeadState } from "@/lib/lead-state";
import { pullLeads, subscribeLeads } from "@/lib/portal-leads-sync";
import { archiveRelationship } from "@/lib/crm/commercial";
import {
  canAccessPortalWorkspace,
  canViewFullWorkspace,
  WORKSPACE_SCOPE_LABEL,
  type WorkspaceScope,
} from "@/lib/portal-workspace";
import { cn } from "@/lib/utils";

type DashboardSearch = { perfil?: string; escopo?: WorkspaceScope };

export const Route = createFileRoute("/executivo/dashboard")({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    perfil: typeof s.perfil === "string" ? s.perfil : undefined,
    escopo: isWorkspaceScope(s.escopo) ? s.escopo : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Workspace — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspacePage,
});

/**
 * Workspace do Executivo — a carteira operacional em forma de pessoas.
 * Estrutura visual e arquitetura preparada; lógica de ordenação
 * inteligente e integrações completas ficam para blocos subsequentes.
 */
function WorkspacePage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as DashboardSearch;
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const scrollRef = useRef(0);
  const openProfileId = search.perfil ?? null;
  // ETAPA 02.1 §Doc01 — abas oficiais por perfil: Green Sales e
  // Redistribuição para todos; Portal apenas para Administrador/híbrido.
  const scopes: WorkspaceScope[] = session
    ? workspaceScopesFor(session.userId, session.activeRole)
    : ["green_sales"];
  const scope: WorkspaceScope =
    search.escopo && scopes.includes(search.escopo) ? search.escopo : "green_sales";

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  // Reflete alterações nas reuniões (próxima reunião do card).
  // Agrupadas em um único quadro: uma rajada de eventos gera apenas
  // uma re-renderização, nunca uma por evento.
  useEffect(() => {
    let scheduled = false;
    return onEvent(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        setTick((v) => v + 1);
      });
    });
  }, []);

  // Sincronização em TEMPO REAL com a base oficial de Leads.
  // Todo investidor identificado no Gateway — em qualquer navegador ou
  // dispositivo — vira Card aqui no mesmo instante, sem recarregar a
  // página, sem trocar de aba e sem novo login.
  useEffect(() => {
    if (typeof window === "undefined" || !session) return;
    let active = true;
    const refresh = () => {
      void pullLeads()
        .then(() => {
          if (active) setTick((v) => v + 1);
        })
        .catch(() => {
          if (active) setTick((v) => v + 1);
        });
    };
    refresh();
    // Tempo real assinado no servidor: dispensa consulta periódica.
    // A rede só é usada de novo quando o servidor avisa, quando outra
    // aba grava algo ou quando o executivo volta para a janela.
    const unsubscribe = subscribeLeads(refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const offSync = onSync(refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      unsubscribe();
      offSync();
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);

  const nextMeetingByInvestor = useMemo(() => {
    void tick;
    const map = new Map<string, string>();
    const now = Date.now();
    for (const m of listMeetings()) {
      if (m.status === "Cancelada" || m.status === "Concluída") continue;
      const t = new Date(m.scheduledAt).getTime();
      if (t < now) continue;
      const current = map.get(m.investorId);
      if (!current || new Date(current).getTime() > t) {
        map.set(m.investorId, m.scheduledAt);
      }
    }
    return map;
  }, [tick]);

  const cards: InvestorCardData[] = useMemo(() => {
    void tick;
    if (!session) return [];
    const allInvestors = listAllInvestors();
    // DEF 2.5.3 §1/§2 — Administrador e perfil híbrido enxergam a base
    // completa (sem filtro de carteira); Executivos comuns veem apenas
    // os seus, e sempre restritos ao Green Sales.
    const visible = canViewFullWorkspace(session.userId, session.activeRole)
      ? allInvestors
      : allInvestors.filter((i) => i.assignedToUserId === session.userId);
    // Isolamento absoluto por escopo: Portal jamais mistura com Green
    // Sales — inclusive para quem não tem acesso à aba Portal, que vê
    // exclusivamente Leads de link personalizado (Green Sales).
    const base = visible.filter((i) =>
      scope === "portal"
        ? i.origin === "portal"
        : scope === "redistribuicao"
          ? i.origin === "redistribuicao"
          : i.origin !== "portal" && i.origin !== "redistribuicao",
    );

    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.email || "").toLowerCase().includes(q) ||
            (i.phone || "").toLowerCase().includes(q) ||
            (i.city || "").toLowerCase().includes(q),
        )
      : base;

    // Ordenação inteligente em tempo real: o movimento manda.
    // Leads novos/atualizados primeiro, depois atividade mais recente,
    // e só então prioridade e proximidade da reunião. Nunca alfabética.
    const priorityScore = (p?: string) => (p === "high" ? 2 : p === "medium" ? 1 : 0);
    const stateScore = (i: InvestorCardData) => {
      const s = resolveLeadState(i);
      return s === "novo" ? 2 : s === "em_andamento" ? 1 : 0;
    };
    return filtered
      .map<InvestorCardData>((i) => ({ ...i, nextMeetingAt: nextMeetingByInvestor.get(i.id) }))
      .sort((a, b) => {
        const sd = stateScore(b) - stateScore(a);
        if (sd !== 0) return sd;
        const ad = new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        if (ad !== 0) return ad;
        const pd = priorityScore(b.priority) - priorityScore(a.priority);
        if (pd !== 0) return pd;
        const am = a.nextMeetingAt ? new Date(a.nextMeetingAt).getTime() : Infinity;
        const bm = b.nextMeetingAt ? new Date(b.nextMeetingAt).getTime() : Infinity;
        return am - bm;
      });
  }, [session, query, nextMeetingByInvestor, scope, tick]);

  const personalLink = useMemo(
    () => (session ? buildPersonalLink(session) : ""),
    [session],
  );
  // Reaproveita a carteira já calculada: evita varrer a base inteira
  // novamente a cada re-renderização ao abrir um perfil.
  const activeInvestor = useMemo(() => {
    if (!openProfileId) return null;
    void tick;
    return listAllInvestors().find((i) => i.id === openProfileId) ?? null;
  }, [openProfileId, tick]);

  const openProfile = useCallback(
    (id: string) => {
      scrollRef.current = typeof window !== "undefined" ? window.scrollY : 0;
      navigate({ to: "/executivo/dashboard", search: { perfil: id, escopo: scope } });
      if (typeof window !== "undefined")
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    },
    [navigate, scope],
  );
  const closeProfile = () => {
    navigate({ to: "/executivo/dashboard", search: { escopo: scope } });
    requestAnimationFrame(() => {
      if (typeof window !== "undefined")
        window.scrollTo({ top: scrollRef.current, behavior: "instant" as ScrollBehavior });
    });
  };

  const changeScope = (next: WorkspaceScope) => {
    navigate({ to: "/executivo/dashboard", search: { escopo: next } });
  };

  /**
   * DEF 2.4.14 — a exclusão do Card é APENAS visual: o relacionamento é
   * arquivado e permanece integralmente na Central de Backup, com
   * histórico, jornada e auditoria preservados.
   */
  const removeLead = useCallback(
    (id: string) => {
      if (!session) return;
      const investor = listAllInvestors({ includeArchived: true }).find((i) => i.id === id);
      archiveRelationship({
        investorId: id,
        investorName: investor?.name ?? "Investidor",
        actorId: session.userId,
        actorName: session.name,
        actorRole: session.activeRole,
        ownerId: investor?.assignedToUserId,
        origin: investor?.origin,
      });
      setTick((v) => v + 1);
    },
    [session],
  );

  const goToMeetings = useCallback(() => {
    navigate({ to: "/executivo/reunioes" });
  }, [navigate]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Workspace do Executivo">
      {activeInvestor ? (
        <InvestorProfileView
          investor={activeInvestor}
          session={session}
          onBack={closeProfile}
        />
      ) : (
        <>
          {scopes.length > 1 && (
            <ScopeTabs items={scopes} current={scope} onChange={changeScope} />
          )}
          <WorkspaceHeader
            query={query}
            onQuery={setQuery}
            personalLink={personalLink}
          />

          {cards.length === 0 ? (
            <EmptyState query={query} personalLink={personalLink} />
          ) : (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cards.map((c) => (
                <InvestorCard
                  key={c.id}
                  investor={c}
                  onOpen={openProfile}
                  onNewMeeting={goToMeetings}
                  onComment={openProfile}
                  onDelete={removeLead}
                />
              ))}
            </div>
          )}
        </>
      )}
    </ExecutiveShell>
  );
}

function WorkspaceHeader({
  query,
  onQuery,
  personalLink,
}: {
  query: string;
  onQuery: (v: string) => void;
  personalLink: string;
}) {
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Pesquisar por nome, e-mail, telefone ou cidade"
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-[color:var(--muted-foreground)]/60"
          aria-label="Pesquisar na carteira"
        />
      </div>
      <CopyLinkButton link={personalLink} />
    </div>
  );
}

function ScopeTabs({
  items,
  current,
  onChange,
}: {
  items: WorkspaceScope[];
  current: WorkspaceScope;
  onChange: (s: WorkspaceScope) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Escopo do Workspace"
      className="mb-5 inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/50 p-1"
    >
      {items.map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.16em] transition",
              active
                ? "bg-[color:var(--accent)] text-[color:var(--foreground)] border border-[color:var(--gold)]/50"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            )}
          >
            {WORKSPACE_SCOPE_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* noop */
        }
      }}
      title={link}
      className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 px-4 py-3 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Link copiado" : "Meu link personalizado"}
    </button>
  );
}

function EmptyState({ query, personalLink }: { query: string; personalLink: string }) {
  const isSearch = query.trim().length > 0;
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/30 p-12 text-center">
      <p className="font-display text-xl">
        {isSearch ? "Nenhum investidor encontrado." : "Sua carteira ainda está vazia."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-foreground)]">
        {isSearch
          ? "Ajuste os termos da pesquisa ou limpe o filtro para ver toda a carteira."
          : "Compartilhe seu link personalizado para que novos investidores cheguem diretamente ao seu Workspace."}
      </p>
      {!isSearch ? (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(personalLink);
            } catch {
              /* noop */
            }
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-4 py-2 text-sm text-[color:var(--foreground)] hover:border-[color:var(--gold)] transition"
        >
          <Share2 className="h-4 w-4" /> Compartilhar meu link personalizado
        </button>
      ) : null}
    </div>
  );
}

function buildPersonalLink(session: ExecutiveSession): string {
  // Utiliza o identificador técnico permanente (`user.slug`) definido no
  // cadastro do colaborador. Nunca deriva do nome exibido — renomear o
  // usuário não pode quebrar o link personalizado.
  const user = loadUsers().find((u) => u.id === session.userId);
  const slug = user?.slug ?? session.userId;
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://portal.velox.com.br";
  return `${base}/e/${slug}`;
}