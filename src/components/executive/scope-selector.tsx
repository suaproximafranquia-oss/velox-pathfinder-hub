/**
 * Seletor de escopo corporativo — mesmo componente visual utilizado no
 * Brain Analytics (ETAPA 02.1 · ITEM 03). Permite ao Administrador e à
 * Gestora alternar entre "Minha Equipe" e "Executivo Específico".
 */
import { UserSquare2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SCOPE_LABEL,
  availableScopes,
  type ScopeMode,
  type ScopeSelection,
} from "@/lib/brain/scopes";
import { visibleCollaborators } from "@/lib/teams";
import type { ExecutiveSession } from "@/lib/executive-auth";

export function ScopeSelector({
  session,
  scope,
  onChange,
}: {
  session: ExecutiveSession;
  scope: ScopeSelection;
  onChange: (next: ScopeSelection) => void;
}) {
  const scopes = availableScopes(session.activeRole);
  const executives = visibleCollaborators(session);
  if (scopes.length < 2) return null;

  function choose(mode: ScopeMode) {
    if (mode === "executive") {
      onChange({ mode, executiveId: scope.executiveId ?? executives[0]?.id ?? session.userId });
      return;
    }
    onChange({ mode });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scopes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => choose(m)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
            scope.mode === m
              ? "border-[color:var(--gold)]/40 bg-[color:var(--accent)] text-[color:var(--foreground)]"
              : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
          )}
        >
          {SCOPE_LABEL[m]}
        </button>
      ))}
      {scope.mode === "executive" && (
        <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-1.5 text-xs">
          <UserSquare2 className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          <select
            value={scope.executiveId ?? session.userId}
            onChange={(e) => onChange({ mode: "executive", executiveId: e.target.value })}
            className="bg-transparent outline-none text-[color:var(--foreground)]"
          >
            {executives.map((e) => (
              <option key={e.id} value={e.id} className="bg-[color:var(--navy)]">
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
