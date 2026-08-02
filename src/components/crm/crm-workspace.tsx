import { useState, type ReactNode } from "react";
import {
  MessageSquare,
  FileText,
  Search,
  ChevronRight,
  ChevronLeft,
  Share2,
} from "lucide-react";
import type { CrmAreaKey } from "@/lib/crm/modules";
import { CrmCanvas } from "@/components/crm/crm-canvas";

/**
 * Estrutura visual do ambiente operacional do CRM.
 *
 * Três áreas: trilho de módulos + coluna esquerda, área central e painel
 * direito. Nenhuma funcionalidade é implementada — apenas a estrutura
 * preparada para receber os componentes das próximas etapas.
 */

const AREA_ICONS: Record<CrmAreaKey, typeof MessageSquare> = {
  conversas: MessageSquare,
  distribuicao: Share2,
  templates: FileText,
};

export function CrmRail({
  areas,
  active,
  onSelect,
}: {
  areas: { key: CrmAreaKey; label: string }[];
  active: CrmAreaKey;
  onSelect: (k: CrmAreaKey) => void;
}) {
  return (
    <nav
      aria-label="Módulos do CRM"
      className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] py-3"
    >
      {areas.map((area) => {
        const Icon = AREA_ICONS[area.key];
        const isActive = area.key === active;
        return (
          <button
            key={area.key}
            type="button"
            title={area.label}
            aria-label={area.label}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(area.key)}
            className={[
              "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-all duration-150 hover:scale-105 active:scale-100",
              isActive
                ? "bg-[color:var(--crm-accent-soft)] text-[color:var(--crm-accent)]"
                : "text-[color:var(--crm-muted)] hover:bg-[color:var(--crm-hover)]",
            ].join(" ")}
          >
            <Icon className="h-[18px] w-[18px]" />
            {isActive ? (
              <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[color:var(--crm-accent)]" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export function CrmListPane({
  title,
  subtitle,
  query,
  onQueryChange,
  searchPlaceholder = "Buscar",
  count,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  query?: string;
  onQueryChange?: (v: string) => void;
  searchPlaceholder?: string;
  count?: number;
  /** Ação exibida ao lado da pesquisa (ex.: Novo Lead). */
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="hidden h-full w-[300px] shrink-0 flex-col border-r border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] shadow-[1px_0_0_0_var(--crm-border)] md:flex xl:w-[340px]"
    >
      <header className="border-b border-[color:var(--crm-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{title}</h2>
          {typeof count === "number" ? (
            <span className="rounded-full bg-[color:var(--crm-hover)] px-2 py-0.5 text-[11px] text-[color:var(--crm-muted)]">
              {count}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[color:var(--crm-muted)]">{subtitle}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-[color:var(--crm-hover)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[color:var(--crm-muted)]" />
            <input
              disabled={!onQueryChange}
              value={query ?? ""}
              onChange={(e) => onQueryChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--crm-muted)]"
            />
          </div>
          {action}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">{children}</div>
    </section>
  );
}

export function CrmMainPane({
  title,
  header,
  children,
  footer,
}: {
  title: string;
  header?: ReactNode;
  children?: ReactNode;
  /** Barra inferior de envio de mensagem. */
  footer?: ReactNode;
}) {
  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col border-x border-[color:var(--crm-border)] bg-[color:var(--crm-background)]">
      <header className="flex items-center justify-between gap-4 border-b border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-5 py-3">
        {header ?? <h2 className="truncate text-sm font-medium">{title}</h2>}
      </header>
      <div className="crm-chat-surface relative min-h-0 flex-1 overflow-y-auto p-5">
        <CrmCanvas />
        <div className="relative h-full">{children}</div>
      </div>
      {footer}
    </section>
  );
}


export function CrmDetailsPane({
  open,
  title,
  onToggle,
  children,
}: {
  open: boolean;
  title: string;
  onToggle: () => void;
  children?: ReactNode;
}) {
  if (!open) {
    return (
      <div className="crm-enter hidden h-full shrink-0 items-start border-l border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] lg:flex">
        <button
          type="button"
          onClick={onToggle}
          title={title}
          aria-label={`Exibir ${title}`}
          className="mt-5 flex h-16 w-7 cursor-pointer items-center justify-center rounded-l-lg text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <aside
      aria-label={title}
      className="crm-slide-in relative hidden h-full w-[330px] shrink-0 flex-col border-l border-[color:var(--crm-border)] bg-[color:var(--crm-background)] shadow-[-1px_0_0_0_var(--crm-border)] lg:flex 2xl:w-[390px]"
    >
      {/* Controle na própria borda da ficha — nunca no cabeçalho da conversa. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Recolher ${title}`}
        title={`Recolher ${title}`}
        className="absolute -left-3 top-5 z-10 flex h-7 w-6 cursor-pointer items-center justify-center rounded-l-lg border border-r-0 border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] text-[color:var(--crm-muted)] shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-accent)]"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <header className="border-b border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-5 py-3.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">{children}</div>
    </aside>
  );
}

export function CrmPlaceholder({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] px-4 py-6 text-center">
      <p className="text-sm text-[color:var(--crm-foreground)]">{label}</p>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-[color:var(--crm-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function useDetailsPane(initial = true) {
  return useState(initial);
}