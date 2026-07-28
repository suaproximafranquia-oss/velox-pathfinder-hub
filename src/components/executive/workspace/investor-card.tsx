import { Calendar, User as UserIcon, MessageSquarePlus, MoreHorizontal } from "lucide-react";
import type { Investor, InvestorOrigin, InvestorPriority } from "@/lib/executive-data";
import { formatRelative } from "@/lib/executive-data";
import { cn } from "@/lib/utils";

const ORIGIN_META: Record<InvestorOrigin, { label: string; dot: string }> = {
  green_sales: { label: "Green Sales", dot: "bg-emerald-500" },
  portal: { label: "Portal Velox", dot: "bg-sky-500" },
  manual: { label: "Manual", dot: "bg-violet-500" },
};

const PRIORITY_META: Record<InvestorPriority, { label: string; ring: string; dot: string }> = {
  high: {
    label: "Oportunidade em destaque",
    ring: "ring-2 ring-[color:var(--gold)]/60",
    dot: "bg-[color:var(--gold)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--gold)_20%,transparent)]",
  },
  medium: {
    label: "Merece atenção",
    ring: "",
    dot: "bg-[color:var(--gold)]/70",
  },
  none: { label: "Sem sinal", ring: "", dot: "bg-transparent" },
};

export type InvestorCardData = Investor & {
  nextMeetingAt?: string; // ISO
};

export function InvestorCard({
  investor,
  onOpen,
  onNewMeeting,
  onComment,
  onMore,
}: {
  investor: InvestorCardData;
  onOpen: (id: string) => void;
  onNewMeeting: (id: string) => void;
  onComment: (id: string) => void;
  onMore: (id: string) => void;
}) {
  const origin = ORIGIN_META[investor.origin ?? "manual"];
  const priority = PRIORITY_META[investor.priority ?? "none"];
  const contact = investor.email || investor.phone;
  const contextLine = buildContextLine(investor);
  const initials = investor.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onOpen(investor.id)}
        className={cn(
          "block w-full text-left rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50",
          "p-4 transition-all duration-200",
          "hover:border-[color:var(--gold)]/40 hover:bg-[color:var(--card)]/80",
          "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]",
          priority.ring,
        )}
      >
        {/* Header — avatar + prioridade */}
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-[11px] font-medium tracking-wider text-[color:var(--gold)]">
            {initials || "•"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] leading-tight truncate">{investor.name}</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--muted-foreground)] truncate">
              {contact}
            </p>
          </div>
          {investor.priority && investor.priority !== "none" ? (
            <span
              aria-label={priority.label}
              title={priority.label}
              className={cn("mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full", priority.dot)}
            />
          ) : null}
        </div>

        {/* Meta — próxima reunião + origem */}
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-[color:var(--muted-foreground)] min-w-0 truncate">
            <Calendar className="h-3 w-3 shrink-0 text-[color:var(--gold)]/70" />
            <span className="truncate">
              {investor.nextMeetingAt
                ? formatMeetingLabel(investor.nextMeetingAt)
                : "Sem reunião agendada"}
            </span>
          </span>
          <span
            title={`Origem: ${origin.label}`}
            className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", origin.dot)} />
            {origin.label}
          </span>
        </div>

        {/* Linha contextual — sinal leve sobre o momento do investidor */}
        <p className="mt-2 text-[10.5px] leading-snug text-[color:var(--muted-foreground)]/90 truncate">
          {contextLine}
        </p>
      </button>

      {/* Ações rápidas — aparecem em hover/focus */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-end gap-1",
          "opacity-0 translate-y-1 transition-all duration-200",
          "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
          "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
        )}
      >
        <QuickAction label="Abrir Perfil" onClick={() => onOpen(investor.id)}>
          <UserIcon className="h-3.5 w-3.5" />
        </QuickAction>
        <QuickAction label="Nova Reunião" onClick={() => onNewMeeting(investor.id)}>
          <Calendar className="h-3.5 w-3.5" />
        </QuickAction>
        <QuickAction label="Comentário" onClick={() => onComment(investor.id)}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </QuickAction>
        <QuickAction label="Mais opções" onClick={() => onMore(investor.id)}>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </QuickAction>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--navy)]/90 text-[color:var(--muted-foreground)] backdrop-blur hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/50 transition"
    >
      {children}
    </button>
  );
}

function buildContextLine(inv: Investor): string {
  if (inv.status === "conversando") return "Solicitou reunião";
  if (inv.status === "novo") return "Aguardando contato";
  if (inv.status === "concluido") return "Leitura concluída · pronto para conversar";
  if (inv.readingPct > 0)
    return `Manual ${inv.readingPct}% · ${formatRelative(inv.lastActivity)}`;
  return `Última atividade ${formatRelative(inv.lastActivity)}`;
}

function formatMeetingLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / 86400000);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Hoje · ${time}`;
  if (diffDays === 1) return `Amanhã · ${time}`;
  if (diffDays > 1 && diffDays < 7) return `Em ${diffDays} dias · ${time}`;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · ${time}`;
}