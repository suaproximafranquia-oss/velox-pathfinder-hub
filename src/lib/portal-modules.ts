/**
 * Registro oficial dos módulos internos do Portal Velox.
 *
 * A Home é a única porta pública da plataforma: todo módulo interno é
 * aberto como overlay sobre ela. Este registro é a fonte única de
 * verdade que liga: chave do módulo → título → conteúdo interno →
 * rotas internas correspondentes (usadas apenas para proteger acessos
 * diretos por URL).
 */
export type PortalModuleKey =
  | "manual"
  | "universo"
  | "simulador"
  | "estrutura"
  | "revista"
  | "principios";

export type PortalModuleDef = {
  key: PortalModuleKey;
  title: string;
  /** Conteúdo interno carregado dentro do overlay (quando aplicável). */
  panelSrc?: string;
  /** Módulos que abrem um componente próprio (ex.: Simulador). */
  action?: "simulator" | "scheduling" | "magazine" | "institutional";
  /** Prefixos de rota interna protegidos contra acesso público direto. */
  guardedPaths: string[];
};

export const PORTAL_MODULES: PortalModuleDef[] = [
  { key: "manual", title: "Manual do Investidor", panelSrc: "/manual", guardedPaths: ["/manual"] },
  {
    key: "universo",
    title: "Material Institucional de Apresentação",
    panelSrc: "/universo",
    guardedPaths: ["/universo"],
  },
  {
    key: "simulador",
    title: "Simulador Inteligente de Potencial de Receita",
    action: "simulator",
    guardedPaths: [],
  },
  {
    key: "estrutura",
    title: "Nossa Estrutura",
    action: "institutional",
    guardedPaths: [],
  },
  {
    key: "revista",
    title: "Revista Velox",
    action: "magazine",
    guardedPaths: [],
  },
  {
    key: "principios",
    title: "Princípios Velox",
    action: "institutional",
    guardedPaths: [],
  },
];

export function getPortalModule(key?: string | null): PortalModuleDef | null {
  if (!key) return null;
  return PORTAL_MODULES.find((m) => m.key === key) ?? null;
}

/** Descobre a qual módulo pertence uma rota interna. */
export function moduleForPath(pathname: string): PortalModuleDef | null {
  return (
    PORTAL_MODULES.find((m) =>
      m.guardedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
    ) ?? null
  );
}

/** Toda rota interna é protegida — só a Home é pública. */
export function isGuardedPath(pathname: string): boolean {
  return moduleForPath(pathname) !== null;
}
