import { useState, type ReactNode } from "react";
import {
  MessageSquare,
  Clock,
  Bell,
  FileText,
  CalendarDays,
  Compass,
  Sparkles,
  History,
  Plug,
  Search,
  PanelRightClose,
  PanelRightOpen,
  Share2,
} from "lucide-react";
import type { CrmAreaKey } from "@/lib/crm/modules";

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
  timeline: Clock,
  alertas: Bell,
  templates: FileText,
  agendamentos: CalendarDays,
  portal: Compass,
  ia: Sparkles,
  historico: History,
  integracoes: Plug,
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
              "relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
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
  children,
}: {
  title: string;
  subtitle?: string;
  query?: string;
  onQueryChange?: (v: string) => void;
  searchPlaceholder?: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="hidden h-full w-[300px] shrink-0 flex-col border-r border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] md:flex xl:w-[340px]"
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
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[color:var(--crm-hover)] px-3 py-2">
          <Search className="h-4 w-4 text-[color:var(--crm-muted)]" />
          <input
            disabled={!onQueryChange}
            value={query ?? ""}
            onChange={(e) => onQueryChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--crm-muted)]"
          />
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
  onToggleDetails,
  detailsOpen,
}: {
  title: string;
  header?: ReactNode;
  children?: ReactNode;
  onToggleDetails: () => void;
  detailsOpen: boolean;
}) {
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-[color:var(--crm-background)]">
      <header className="flex items-center justify-between gap-4 border-b border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-5 py-3">
        {header ?? <h2 className="truncate text-sm font-medium">{title}</h2>}
        <button
          type="button"
          onClick={onToggleDetails}
          aria-label={detailsOpen ? "Ocultar painel de detalhes" : "Exibir painel de detalhes"}
          className="hidden rounded-lg p-2 text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)] lg:block"
        >
          {detailsOpen ? (
            <PanelRightClose className="h-[18px] w-[18px]" />
          ) : (
            <PanelRightOpen className="h-[18px] w-[18px]" />
          )}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </section>
  );
}

export function CrmDetailsPane({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <aside
      aria-label={title}
      className="hidden h-full w-[330px] shrink-0 flex-col border-l border-[color:var(--crm-border)] bg-[color:var(--crm-background)] lg:flex 2xl:w-[390px]"
    >
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