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
  Phone,
  Mail,
  MapPin,
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
  onSelect,
}: {
  item: CrmConversation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={[
        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        active
          ? "bg-[color:var(--crm-accent-soft)]"
          : "hover:bg-[color:var(--crm-hover)]",
      ].join(" ")}
    >
      <CrmAvatar name={item.name} initials={item.initials} photoUrl={item.photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <span className="shrink-0 text-[11px] text-[color:var(--crm-muted)]">
            {item.lastActivityLabel}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-[color:var(--crm-muted)]">
          {item.lastInteraction}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${CRM_STATE_DOT[item.state]}`}
            aria-hidden
          />
          <span className="truncate text-[11px] text-[color:var(--crm-muted)]">
            {item.stateLabel} · {item.statusLabel}
          </span>
        </span>
      </span>
    </button>
  );
}

const SIGNALS = [
  { key: "portal", label: "Portal do Investidor", Icon: Compass },
  { key: "timeline", label: "Timeline", Icon: Clock },
  { key: "alertas", label: "Alertas", Icon: Bell },
  { key: "ia", label: "IA", Icon: Sparkles },
  { key: "reunioes", label: "Reuniões", Icon: CalendarDays },
  { key: "templates", label: "Templates", Icon: FileText },
  { key: "historico", label: "Histórico", Icon: History },
  { key: "integracoes", label: "Integrações", Icon: Plug },
] as const;

/** Sinalizadores visuais — não são botões, apenas indicadores. */
export function CrmSignals() {
  return (
    <span className="flex items-center gap-1" aria-label="Indicadores operacionais">
      {SIGNALS.map(({ key, label, Icon }) => (
        <span
          key={key}
          title={label}
          aria-label={label}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-[color:var(--crm-hover)] text-[color:var(--crm-muted)]"
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      ))}
    </span>
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <span className="hidden min-w-0 flex-col xl:flex">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--crm-muted)]">
        {label}
      </span>
      <span className="truncate text-xs">{value}</span>
    </span>
  );
}

export function CrmConversationHeader({ item }: { item: CrmConversation }) {
  return (
    <div className="flex items-center gap-4 border-b border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-5 py-2.5">
      <CrmAvatar name={item.name} initials={item.initials} photoUrl={item.photoUrl} size={36} />
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-medium">{item.name}</h2>
          <CrmSignals />
        </div>
        <span className="flex items-center gap-2 text-[11px] text-[color:var(--crm-muted)]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${CRM_STATE_DOT[item.state]}`}
            aria-hidden
          />
          {item.stateLabel} · {item.phone}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-6">
        <HeaderField label="Telefone" value={item.phone} />
        <HeaderField label="Status" value={item.statusLabel} />
        <HeaderField label="Origem" value={item.originLabel} />
        <HeaderField label="Executivo" value={item.ownerName} />
        <HeaderField label="Workspace" value={item.workspaceLabel} />
      </div>
    </div>
  );
}

/** Estado elegante enquanto não existem mensagens reais. */
export function CrmThread({ item }: { item: CrmConversation }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]">
        <MessageSquare className="h-5 w-5" />
      </span>
      <p className="text-sm">
        {item.name} ainda não possui histórico de relacionamento.
      </p>
      <p className="max-w-md text-xs leading-relaxed text-[color:var(--crm-muted)]">
        O relacionamento será exibido aqui conforme novas interações forem
        acontecendo. Último movimento registrado: {item.lastInteraction} ·{" "}
        {item.lastActivityLabel}.
      </p>
      <div className="mt-2 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { label: "Cidade", value: item.city, Icon: MapPin },
          { label: "Telefone", value: item.phone, Icon: Phone },
          { label: "E-mail", value: item.email, Icon: Mail },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-3 py-2 text-left"
          >
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--crm-muted)]">
              <Icon className="h-3 w-3" /> {label}
            </span>
            <span className="mt-0.5 block truncate text-xs">{value}</span>
          </div>
        ))}
      </div>
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
      <h3 className="text-[10px] uppercase tracking-wider text-[color:var(--crm-muted)]">
        {title}
      </h3>
      <div className="mt-2 space-y-1.5 text-sm">
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
      <span className="min-w-0 truncate text-xs">{value}</span>
    </div>
  );
}
