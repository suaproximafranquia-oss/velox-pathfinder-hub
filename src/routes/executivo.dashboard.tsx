import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Share2, Link2, Check } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  canViewAllInvestors,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { MOCK_INVESTORS } from "@/lib/executive-data";
import { listMeetings } from "@/lib/meetings";
import { onEvent } from "@/lib/events/bus";
import { InvestorCard, type InvestorCardData } from "@/components/executive/workspace/investor-card";
import { InvestorProfilePanel } from "@/components/executive/investor-profile-panel";

export const Route = createFileRoute("/executivo/dashboard")({
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
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [query, setQuery] = useState("");
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

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
    const base = canViewAllInvestors(session.activeRole)
      ? MOCK_INVESTORS
      : MOCK_INVESTORS.filter((i) => i.assignedToUserId === session.userId);

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
  }, [session, query, nextMeetingByInvestor]);

  if (!session) return null;

  const personalLink = buildPersonalLink(session);

  return (
    <ExecutiveShell session={session} title="Workspace do Executivo">
      <WorkspaceHeader
        query={query}
        onQuery={setQuery}
        total={cards.length}
        personalLink={personalLink}
      />

      {cards.length === 0 ? (
        <EmptyState query={query} personalLink={personalLink} />
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {cards.map((c) => (
            <InvestorCard
              key={c.id}
              investor={c}
              onOpen={setOpenProfileId}
              onNewMeeting={() => navigate({ to: "/executivo/reunioes" })}
              onComment={setOpenProfileId}
              onMore={setOpenProfileId}
            />
          ))}
        </div>
      )}

      <InvestorProfilePanel
        investorId={openProfileId}
        open={Boolean(openProfileId)}
        onClose={() => setOpenProfileId(null)}
      />
    </ExecutiveShell>
  );
}

function WorkspaceHeader({
  query,
  onQuery,
  total,
  personalLink,
}: {
  query: string;
  onQuery: (v: string) => void;
  total: number;
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
        <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          {total} {total === 1 ? "investidor" : "investidores"}
        </span>
      </div>
      <CopyLinkButton link={personalLink} />
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
  const slug =
    session.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(" ")
      .filter(Boolean)[0] ?? session.userId;
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://portal.velox.com.br";
  return `${base}/i/${slug}`;
}