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
  personal: "Meu Painel",
  team: "Minha Equipe",
  company: "Empresa",
  executive: "Executivo Especifico",
  comparison: "Comparacao entre Executivos",
};

export function availableScopes(role: ExecutiveRole): ScopeMode[] {
  if (role === "super_admin")
    return ["company", "team", "executive", "comparison", "personal"];
  if (role === "diretora") return ["team", "executive", "personal"];
  return ["personal"];
}

export function defaultScope(role: ExecutiveRole): ScopeSelection {
  if (role === "super_admin") return { mode: "company" };
  if (role === "diretora") return { mode: "team" };
  return { mode: "personal" };
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
      return "Empresa";
    case "executive":
      return "Executivo selecionado";
    case "comparison":
      return "Comparacao";
  }
}
