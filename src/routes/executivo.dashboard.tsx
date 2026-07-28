import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Share2, Link2, Check } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  canViewAllInvestors,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { listAllInvestors } from "@/lib/executive-data";
import { listMeetings } from "@/lib/meetings";
import { onEvent } from "@/lib/events/bus";
import { InvestorCard, type InvestorCardData } from "@/components/executive/workspace/investor-card";
import { InvestorProfileView } from "@/components/executive/workspace/investor-profile-view";
import { deleteLead } from "@/lib/leads";
import {
  canAccessPortalWorkspace,
  WORKSPACE_SCOPE_LABEL,
  type WorkspaceScope,
} from "@/lib/portal-workspace";
import { cn } from "@/lib/utils";

type DashboardSearch = { perfil?: string; escopo?: WorkspaceScope };

export const Route = createFileRoute("/executivo/dashboard")({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    perfil: typeof s.perfil === "string" ? s.perfil : undefined,
    escopo:
      s.escopo === "portal" || s.escopo === "green_sales"
        ? (s.escopo as WorkspaceScope)
        : undefined,
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
  const portalEnabled = session
    ? canAccessPortalWorkspace(session.userId, session.activeRole)
    : false;
  const scope: WorkspaceScope = portalEnabled
    ? (search.escopo ?? "green_sales")
    : "green_sales";

  useEffect(() => {
    const s = getSession();
    if (!s) navigate({ to: "/executivo" });
    else setSession(s);
  }, [navigate]);

  // Reflete alterações nas reuniões (próxima reunião do card).
  useEffect(() => onEvent(() => setTick((v) => v + 1)), []);

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
    if (!session) return [];
    const allInvestors = listAllInvestors();
    const visible = canViewAllInvestors(session.activeRole)
      ? allInvestors
      : allInvestors.filter((i) => i.assignedToUserId === session.userId);
    // Isolamento absoluto por escopo: Portal jamais mistura com Green Sales.
    const base = portalEnabled
      ? visible.filter((i) =>
          scope === "portal" ? i.origin === "portal" : i.origin !== "portal",
        )
      : visible;

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

    // Ordenação inteligente (versão inicial): prioridade > próxima reunião
    // mais próxima > atividade mais recente. Nunca alfabética.
    const priorityScore = (p?: string) => (p === "high" ? 2 : p === "medium" ? 1 : 0);
    return filtered
      .map<InvestorCardData>((i) => ({ ...i, nextMeetingAt: nextMeetingByInvestor.get(i.id) }))
      .sort((a, b) => {
        const pd = priorityScore(b.priority) - priorityScore(a.priority);
        if (pd !== 0) return pd;
        const am = a.nextMeetingAt ? new Date(a.nextMeetingAt).getTime() : Infinity;
        const bm = b.nextMeetingAt ? new Date(b.nextMeetingAt).getTime() : Infinity;
        if (am !== bm) return am - bm;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      });
  }, [session, query, nextMeetingByInvestor, portalEnabled, scope]);

  if (!session) return null;

  const personalLink = buildPersonalLink(session);
  const activeInvestor =
    openProfileId ? listAllInvestors().find((i) => i.id === openProfileId) ?? null : null;

  const openProfile = (id: string) => {
    scrollRef.current = typeof window !== "undefined" ? window.scrollY : 0;
    navigate({ to: "/executivo/dashboard", search: { perfil: id, escopo: scope } });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };
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

  const removeLead = (id: string) => {
    deleteLead(id);
    setTick((v) => v + 1);
  };

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
          {portalEnabled && (
            <ScopeTabs current={scope} onChange={changeScope} />
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
                  onNewMeeting={() => navigate({ to: "/executivo/reunioes" })}
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
  current,
  onChange,
}: {
  current: WorkspaceScope;
  onChange: (s: WorkspaceScope) => void;
}) {
  const items: WorkspaceScope[] = ["green_sales", "portal"];
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