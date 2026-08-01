import type { ReactNode } from "react";
import {
  MessageSquare,
  Clock,
  Bell,
  Sparkles,
  CalendarDays,
  FileText,
  History,
  Plug,
  Compass,
  Lock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { CRM_STATE_DOT, type CrmConversation } from "@/lib/crm/relationships";

/** Avatar do investidor — foto quando existir, iniciais como alternativa. */
export function CrmAvatar({
  name,
  initials,
  photoUrl,
  size = 40,
}: {
  name: string;
  initials: string;
  photoUrl?: string;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[color:var(--crm-hover)] text-xs font-medium text-[color:var(--crm-muted)]"
    >
      {initials || "?"}
    </span>
  );
}

export function CrmConversationItem({
  item,
  active,
  unread = false,
  onSelect,
}: {
  item: CrmConversation;
  active: boolean;
  unread?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={[
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
        active
          ? "bg-[color:var(--crm-accent-soft)]"
          : "hover:bg-[color:var(--crm-hover)]",
      ].join(" ")}
    >
      <CrmAvatar name={item.name} initials={item.initials} photoUrl={item.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
            {item.name}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-[color:var(--crm-muted)]">
            {item.lastActivityLabel}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${CRM_STATE_DOT[item.state]}`}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--crm-muted)]">
            {item.statusLabel}
          </span>
          {unread ? (
            <span
              aria-label="Mensagens novas"
              title="Mensagens novas"
              className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--crm-accent)]"
            />
          ) : null}
        </span>
      </span>
    </button>
  );
}

const ACTIONS = [
  { key: "portal", label: "Portal do Investidor", Icon: Compass },
  { key: "timeline", label: "Timeline", Icon: Clock },
  { key: "alertas", label: "Alertas", Icon: Bell },
  { key: "ia", label: "IA", Icon: Sparkles },
  { key: "reunioes", label: "Reuniões", Icon: CalendarDays },
  { key: "templates", label: "Templates", Icon: FileText },
  { key: "historico", label: "Histórico", Icon: History },
  { key: "integracoes", label: "Integrações", Icon: Plug },
] as const;

/** Barra de ações — apenas ícones discretos, cada um com tooltip. */
export function CrmActionBar() {
  return (
    <div className="flex items-center gap-0.5" aria-label="Ações do relacionamento">
      {ACTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          title={label}
          aria-label={label}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-foreground)]"
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/** Presença simples derivada da última movimentação registrada. */
function isOnline(iso: string): boolean {
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) && Date.now() - ts < 5 * 60 * 1000;
}

export function CrmConversationHeader({ item }: { item: CrmConversation }) {
  const online = isOnline(item.lastActivityIso);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <CrmAvatar name={item.name} initials={item.initials} photoUrl={item.photoUrl} size={38} />
      <div className="flex min-w-0 flex-col">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{item.name}</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--crm-muted)]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              online ? "bg-emerald-500" : "bg-[color:var(--crm-muted)]/50"
            }`}
            aria-hidden
          />
          {online ? "Online" : "Offline"}
        </span>
      </div>
      <div className="ml-auto">
        <CrmActionBar />
      </div>
    </div>
  );
}

/** Estado elegante enquanto não existem mensagens reais. */
export function CrmThread({ item }: { item: CrmConversation }) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]">
        <MessageSquare className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">
        {item.name} ainda não possui histórico de relacionamento.
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-[color:var(--crm-muted)]">
        As mensagens desta conversa serão exibidas aqui.
      </p>
    </div>
  );
}

/** Bloco categorizado da Ficha Operacional (painel direito). */
export function CrmRecordSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-[color:var(--crm-border)] pb-4 last:border-0">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--crm-muted)]">
        {title}
      </h3>
      <div className="mt-2.5 space-y-2 text-sm">
        {children ?? (
          <p className="text-xs leading-relaxed text-[color:var(--crm-muted)]">
            {hint ?? "Em preparação para as próximas etapas."}
          </p>
        )}
      </div>
    </section>
  );
}

export function CrmRecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-[color:var(--crm-muted)]">{label}</span>
      <span className="min-w-0 truncate text-xs font-medium">{value}</span>
    </div>
  );
}

/** Bloqueio: investidor pertencente a outro Executivo. */
export function CrmBlockedRelationship({ item }: { item: CrmConversation }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Lock className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">
        Este investidor já possui um relacionamento ativo.
      </p>
      <dl className="w-full space-y-1.5 rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-4 py-3 text-left">
        <CrmRecordRow label="Responsável" value={item.ownerName} />
        <CrmRecordRow label="Origem" value={item.originLabel} />
        <CrmRecordRow label="Status" value={item.statusLabel} />
      </dl>
      <p className="text-xs leading-relaxed text-[color:var(--crm-muted)]">
        Solicite contato com o Executivo responsável para prosseguir. Nenhuma
        informação privada deste relacionamento é exibida.
      </p>
    </div>
  );
}

/** Visão administrativa do Gestor — sem qualquer conteúdo privado. */
export function CrmSupervisionView({ item }: { item: CrmConversation }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">Visão administrativa</p>
      <dl className="w-full space-y-1.5 rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-4 py-3 text-left">
        <CrmRecordRow label="Responsável" value={item.ownerName} />
        <CrmRecordRow label="Origem" value={item.originLabel} />
        <CrmRecordRow label="Status do relacionamento" value={item.statusLabel} />
        <CrmRecordRow label="Situação operacional" value={item.stateLabel} />
        <CrmRecordRow label="Última movimentação" value={item.lastActivityLabel} />
        <CrmRecordRow label="Workspace" value={item.workspaceLabel} />
      </dl>
      <p className="text-xs leading-relaxed text-[color:var(--crm-muted)]">
        Mensagens, notas, Timeline e demais conteúdos privados entre Executivo e
        Investidor não são exibidos nesta visão.
      </p>
    </div>
  );
}

/** Aviso de duplicidade detectada automaticamente. */
export function CrmDuplicateNotice({ item }: { item: CrmConversation }) {
  if (!item.duplicate) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-left">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="text-xs leading-relaxed text-amber-900">
        Duplicidade identificada por {item.duplicate.matchedBy}: já existe
        relacionamento ativo de {item.duplicate.investorName} sob
        responsabilidade de {item.duplicate.ownerName}.
      </p>
    </div>
  );
}
