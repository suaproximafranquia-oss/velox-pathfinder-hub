/**
 * Configuração institucional da plataforma (white label).
 *
 * A Atlas Platform é neutra por design. Nenhum componente deve referenciar
 * diretamente uma empresa: sempre consuma os valores desta configuração.
 * Futuras implantações substituem apenas este arquivo (ou o carregam de
 * um workspace remoto) para reaproveitar todo o restante do código.
 */

export type WorkspaceBranding = {
  /** Nome institucional da plataforma. Ex.: "Atlas Platform". */
  platformName: string;
  /** Subtítulo curto exibido junto ao nome. Ex.: "Corporate Workspace". */
  platformTagline: string;
  /** Rodapé institucional. Ex.: "Powered by Velox". */
  poweredBy: string;
  /** Nome do workspace ativo (primeira empresa cliente). */
  workspaceName: string;
  /** Iniciais exibidas no marcador visual do cabeçalho. */
  monogram: string;
};

export const WORKSPACE: WorkspaceBranding = {
  platformName: "Atlas Platform",
  platformTagline: "Corporate Workspace",
  poweredBy: "Powered by Velox",
  workspaceName: "Velox",
  monogram: "A",
};