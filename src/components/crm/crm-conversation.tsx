import { useEffect, useRef, useState, type ReactNode } from "react";
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
  Link2,
} from "lucide-react";
import { type CrmConversation } from "@/lib/crm/relationships";
import { CRM_RELATIONSHIP_META } from "@/lib/crm/relationship-state";
import { whatsappPresence } from "@/lib/crm/presence";
import {
  formatCrmMessageDay,
  formatCrmMessageTime,
  type CrmMessage,
} from "@/lib/crm/messages";
import { copyToClipboard } from "@/lib/clipboard";

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

/**
 * Barra de ações — exclusivamente ações imediatas da conversa. Qualquer
 * informação já presente na Ficha do Investidor não aparece aqui.
 */
export function CrmActionBar({
  phone,
  onSchedule,
}: {
  phone?: string;
  onSchedule?: () => void;
}) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return (
    <div className="flex items-center gap-0.5" aria-label="Ações da conversa">
      <a
        href={digits ? `tel:+${digits}` : undefined}
        title="Ligação"
        aria-label="Ligação"
        aria-disabled={!digits}
        className={[
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          digits
            ? "text-[color:var(--crm-muted)] hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-foreground)]"
            : "pointer-events-none text-[color:var(--crm-muted)]/40",
        ].join(" ")}
      >
        <Phone className="h-4 w-4" />
      </a>
      <button
        type="button"
        onClick={onSchedule}
        title="Agendar reunião"
        aria-label="Agendar reunião"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-foreground)]"
      >
        <CalendarPlus className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Integrações"
        aria-label="Integrações"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-foreground)]"
      >
        <Plug className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CrmConversationHeader({
  item,
  onSchedule,
}: {
  item: CrmConversation;
  onSchedule?: () => void;
}) {
  const presence = whatsappPresence(item.id);
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
        <CrmActionBar phone={item.phone} onSchedule={onSchedule} />
      </div>
    </div>
  );
}

/**
 * Barra inferior de envio — permanentemente visível na conversa.
 * ENTER envia a mensagem, registra no histórico e atualiza o estágio.
 */
export function CrmComposer({
  onSend,
  disabled = false,
  hint,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    if (disabled) return;
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  };
  return (
    <div className="shrink-0 border-t border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-5 py-3">
      <div className="flex items-center gap-2">
        <input
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={disabled ? (hint ?? "Conversa indisponível") : "Digite uma mensagem..."}
          aria-label="Digite uma mensagem"
          className="min-w-0 flex-1 rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[color:var(--crm-muted)] focus:border-[color:var(--crm-accent)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[color:var(--crm-accent)] px-3.5 py-2.5 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <Send className="h-3.5 w-3.5" />
          Enviar
        </button>
      </div>
    </div>
  );
}

/**
 * Histórico completo da conversa — ordem cronológica, rolagem automática
 * e separação visual entre mensagens enviadas e recebidas.
 */
export function CrmThread({
  item,
  messages,
}: {
  item: CrmConversation;
  messages: CrmMessage[];
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, item.id]);

  if (messages.length === 0) {
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

  let lastDay = "";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5 pb-1">
      {messages.map((m) => {
        const day = formatCrmMessageDay(m.at);
        const showDay = day !== lastDay;
        lastDay = day;
        const sent = m.direction === "enviada";
        return (
          <div key={m.id} className="flex flex-col">
            {showDay ? (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-[color:var(--crm-hover)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[color:var(--crm-muted)]">
                  {day}
                </span>
              </div>
            ) : null}
            <div className={sent ? "flex justify-end" : "flex justify-start"}>
              <div
                className={[
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
                  sent
                    ? "rounded-br-md bg-[color:var(--crm-accent)] text-white"
                    : "rounded-bl-md border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] text-[color:var(--crm-foreground)]",
                ].join(" ")}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <span
                  className={[
                    "mt-1 block text-right text-[10px] tabular-nums",
                    sent ? "text-white/70" : "text-[color:var(--crm-muted)]",
                  ].join(" ")}
                >
                  {formatCrmMessageTime(m.at)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

/** Botão de cópia real de link (área de transferência) com confirmação. */
export function CrmCopyLinkButton({
  url,
  label = "Copiar link",
}: {
  url?: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const value = url?.trim();
  return (
    <button
      type="button"
      disabled={!value}
      onClick={() => {
        if (!value) return;
        void copyToClipboard(value).then((ok) => {
          if (!ok) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
      {copied ? "Link copiado" : label}
    </button>
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
