/**
 * Escopo de dados do Brain Analytics.
 * Prepara a arquitetura para que qualquer indicador possa ser
 * filtrado por um dos modos abaixo. Os componentes consomem apenas
 * `ScopeSelection` — a fonte de dados pode ser trocada sem impacto.
 */
import type { ExecutiveRole, ExecutiveSession } from "../executive-auth";

export type ScopeMode =
  | "personal"
  | "team"
  | "company"
  | "executive"
  | "comparison";

export type ScopeSelection = {
  mode: ScopeMode;
  /** Usado quando mode = "executive". */
  executiveId?: string;
  /** Usado quando mode = "comparison" (apenas Admin). */
  compareIds?: string[];
};

export const SCOPE_LABEL: Record<ScopeMode, string> = {
  personal: "Individual",
  team: "Minha Equipe",
  company: "Equipe",
  executive: "Executivo Específico",
  comparison: "Executivo Específico",
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
    case "personal":
      return session.name.split(" ")[0];
    case "team":
      return "Equipe";
    case "company":
      return "Equipe";
    case "executive":
      return "Executivo selecionado";
    case "comparison":
      return "Executivo selecionado";
  }
}
