/**
 * Configuração institucional da plataforma (white label).
 *
 * A Atlas Platform é neutra por design. Nenhum componente deve referenciar
 * diretamente uma empresa: sempre consuma os valores desta configuração.
 * Futuras implantações substituem apenas este arquivo (ou o carregam de
 * um workspace remoto) para reaproveitar todo o restante do código.
 */

export type WorkspaceBranding = {
  /** Identificador estável do workspace (usado para isolamento de dados). */
  id: string;
  /** Nome de exibição do workspace (identidade principal no header). */
  workspaceName: string;
  /** Subtítulo curto exibido junto ao nome. */
  workspaceTagline: string;
  /** Nome institucional da plataforma (usado no rodapé "Powered by"). */
  platformName: string;
  /** Subtítulo curto — mantido para compatibilidade com telas legadas. */
  platformTagline: string;
  /** Rodapé institucional. */
  poweredBy: string;
  /** URL opcional do logotipo do workspace (SVG/PNG). Quando ausente, o
   *  header exibe apenas o nome do workspace. */
  workspaceLogoUrl?: string;
};

/**
 * Registro de workspaces disponíveis na plataforma. Preparado para
 * evolução multi-tenant: no futuro, esta lista poderá ser carregada
 * dinamicamente do Administrador Global da Atlas Platform.
 */
export const WORKSPACES: Record<string, WorkspaceBranding> = {
  velox: {
    id: "velox",
    workspaceName: "VELOX",
    workspaceTagline: "Corporate Workspace",
    platformName: "Atlas Platform",
    platformTagline: "Corporate Workspace",
    poweredBy: "Powered by Atlas Platform",
  },
};

/** Workspace ativo nesta implantação. */
export const ACTIVE_WORKSPACE_ID = "velox";

export const WORKSPACE: WorkspaceBranding = WORKSPACES[ACTIVE_WORKSPACE_ID];