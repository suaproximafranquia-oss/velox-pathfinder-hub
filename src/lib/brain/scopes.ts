/**
 * Escopo de dados do Brain Analytics.
 * Prepara a arquitetura para que qualquer indicador possa ser
 * filtrado por um dos modos abaixo. Os componentes consomem apenas
 * `ScopeSelection` — a fonte de dados pode ser trocada sem impacto.
 */
import type { ExecutiveRole, ExecutiveSession } from "../executive-auth";

export type ScopeMode =
  | "team"
  | "executive";

export type ScopeSelection = {
  mode: ScopeMode;
  /** Usado quando mode = "executive". */
  executiveId?: string;
};

export const SCOPE_LABEL: Record<ScopeMode, string> = {
  team: "Minha Equipe",
  executive: "Executivo Específico",
};

export function availableScopes(role: ExecutiveRole): ScopeMode[] {
  if (role === "super_admin" || role === "diretora") return ["team", "executive"];
  return ["executive"];
}

export function defaultScope(role: ExecutiveRole, userId?: string): ScopeSelection {
  if (role === "super_admin") return { mode: "team" };
  if (role === "diretora") return { mode: "team" };
  return { mode: "executive", executiveId: userId };
}

/**
 * Assinatura estavel para futuras fontes reais. Hoje o Brain gera
 * um snapshot simulado; amanha uma implementacao real recebe a
 * mesma `ScopeSelection` sem que os componentes sejam alterados.
 */
export function scopeSummary(session: ExecutiveSession, scope: ScopeSelection): string {
  switch (scope.mode) {
    case "team":
      return "Equipe";
    case "executive":
      return "Executivo selecionado";
  }
}
