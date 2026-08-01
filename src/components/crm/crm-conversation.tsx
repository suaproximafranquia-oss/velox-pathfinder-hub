import { useState, type ReactNode } from "react";
import {
  MessageSquare,
  CalendarPlus,
  Phone,
  Plug,
  Send,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { type CrmConversation } from "@/lib/crm/relationships";
import { CRM_RELATIONSHIP_META } from "@/lib/crm/relationship-state";
import { whatsappPresence } from "@/lib/crm/presence";

/** Indicador padronizado do estágio automático do relacionamento. */
export function CrmStateDot({ item }: { item: CrmConversation }) {
  const meta = CRM_RELATIONSHIP_META[item.relationshipState];
  return (
    <span
      className="relative flex h-2 w-2 shrink-0 items-center justify-center"
      title={meta.label}
      aria-label={meta.label}
    >
      {meta.pulse ? (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${meta.dot}`}
          style={{ animationDuration: "2.4s" }}
          aria-hidden
        />
      ) : null}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
    </span>
  );
}

/** Chip discreto do estágio — exibido apenas na Ficha do investidor. */
export function CrmStateChip({ item }: { item: CrmConversation }) {
  const meta = CRM_RELATIONSHIP_META[item.relationshipState];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
      >
        <CrmStateDot item={item} />
        {meta.label}
      </span>
    </span>
  );
}

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
          <CrmStateDot item={item} />
          <span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--crm-muted)]">
            {CRM_RELATIONSHIP_META[item.relationshipState].label}
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

/**
 * Presença do WhatsApp — o cabeçalho jamais exibe dados do Portal do
 * Investidor. Apenas Online, "Visto por último" ou Offline.
 */
function whatsappPresence(iso: string): { online: boolean; label: string } {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return { online: false, label: "Offline" };
  const diff = Date.now() - ts;
  if (diff < 5 * 60 * 1000) return { online: true, label: "Online" };
  const d = new Date(ts);
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return { online: false, label: `Visto por último hoje às ${hhmm}` };
  const yesterday = new Date(Date.now() - 864e5).toDateString() === d.toDateString();
  if (yesterday) return { online: false, label: `Visto por último ontem às ${hhmm}` };
  if (diff < 30 * 864e5)
    return {
      online: false,
      label: `Visto por último em ${d.toLocaleDateString("pt-BR")} às ${hhmm}`,
    };
  return { online: false, label: "Offline" };
}

export function CrmConversationHeader({ item }: { item: CrmConversation }) {
  const presence = whatsappPresence(item.lastActivityIso);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3.5">
      <CrmAvatar name={item.name} initials={item.initials} photoUrl={item.photoUrl} size={42} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{item.name}</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--crm-muted)]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              presence.online
                ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-[color:var(--crm-muted)]/40"
            }`}
            aria-hidden
          />
          {presence.label}
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

/** Pequenos detalhes corporativos por bloco da ficha. */
export type CrmRecordTone =
  | "azul"
  | "verde"
  | "roxo"
  | "laranja"
  | "azul-claro"
  | "vermelho"
  | "neutro";

const TONE: Record<CrmRecordTone, { icon: string; bar: string }> = {
  azul: { icon: "bg-blue-50 text-blue-600", bar: "bg-blue-500" },
  verde: { icon: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" },
  roxo: { icon: "bg-violet-50 text-violet-600", bar: "bg-violet-500" },
  laranja: { icon: "bg-amber-50 text-amber-600", bar: "bg-amber-500" },
  "azul-claro": { icon: "bg-sky-50 text-sky-600", bar: "bg-sky-400" },
  vermelho: { icon: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
  neutro: {
    icon: "bg-[color:var(--crm-hover)] text-[color:var(--crm-muted)]",
    bar: "bg-[color:var(--crm-muted)]/40",
  },
};

/** Bloco categorizado da Ficha Operacional (painel direito). */
export function CrmRecordSection({
  title,
  hint,
  tone = "neutro",
  icon: Icon,
  children,
}: {
  title: string;
  hint?: string;
  tone?: CrmRecordTone;
  icon?: typeof MessageSquare;
  children?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <section className="rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${t.icon}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className={`h-3.5 w-[3px] rounded-full ${t.bar}`} aria-hidden />
        )}
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--crm-muted)]">
          {title}
        </h3>
      </div>
      <div className="mt-3 space-y-2.5 text-sm">
        {children ?? (
          <p className="text-xs leading-relaxed text-[color:var(--crm-muted)]">
            {hint ?? "Em preparação para as próximas etapas."}
          </p>
        )}
      </div>
    </section>
  );
}

export function CrmRecordRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-[color:var(--crm-muted)]">{label}</span>
      <span className="min-w-0 truncate text-xs font-medium">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

/** Linha do WhatsApp — clique copia o número, sem abrir conversa/navegador. */
export function CrmCopyRow({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = value?.trim();
  if (!text) return <CrmRecordRow label={label} value="—" />;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-[color:var(--crm-muted)]">{label}</span>
      <button
        type="button"
        title="Copiar número"
        aria-label={`Copiar ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(
            () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            },
            () => undefined,
          );
        }}
        className="group flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium transition-colors hover:bg-[color:var(--crm-hover)]"
      >
        <span className="min-w-0 truncate">{text}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-[color:var(--crm-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>
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
