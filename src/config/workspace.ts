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
  /**
   * Executivo Padrão do workspace — utilizado quando um visitante conclui o
   * Manual pelo link público (sem executivo específico atribuído). Este
   * parâmetro será administrado pela futura tela "Configurações da
   * Plataforma"; enquanto ela não existe, deixamos vazio e o resolver
   * cai automaticamente para o primeiro Administrador ativo apenas para
   * fins de demonstração — sem hard-code de nome pessoal.
   */
  defaultExecutiveId?: string;
};

/**
 * Registro de workspaces disponíveis na plataforma. Preparado para
 * evolução multi-tenant: no futuro, esta lista poderá ser carregada
 * dinamicamente do Administrador Global da Atlas Platform.
 */
export const WORKSPACES: Record<string, WorkspaceBranding> = {
  velox: {
    id: "velox",
    workspaceName: "Velox Soluções Financeiras",
    workspaceTagline: "Corporate Workspace",
    platformName: "Atlas Platform",
    platformTagline: "Corporate Workspace",
    poweredBy: "Powered by Atlas Platform",
    // Vazio por padrão. A tela de Configurações da Plataforma preencherá
    // este valor futuramente; até lá o resolver usa o primeiro Administrador.
    defaultExecutiveId: undefined,
  },
};

/** Workspace ativo nesta implantação. */
export const ACTIVE_WORKSPACE_ID = "velox";

export const WORKSPACE: WorkspaceBranding = WORKSPACES[ACTIVE_WORKSPACE_ID];