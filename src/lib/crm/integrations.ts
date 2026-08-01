/**
 * CRM de Relacionamento — registro de integrações previstas.
 *
 * Somente descritores. Nenhuma integração é implementada nesta etapa;
 * o registro existe para que as próximas etapas apenas preencham os
 * adaptadores correspondentes.
 */
export type CrmIntegrationKey =
  | "meta_api"
  | "portal_investidor"
  | "central_executivo"
  | "alertas"
  | "agendamentos"
  | "templates"
  | "ia";

export type CrmIntegration = {
  key: CrmIntegrationKey;
  label: string;
  description: string;
  /** "interna" reutiliza módulos do ecossistema; "externa" usa API de terceiro. */
  kind: "interna" | "externa";
  status: "planejado";
};

export const CRM_INTEGRATIONS: CrmIntegration[] = [
  {
    key: "meta_api",
    label: "API Oficial da Meta",
    description: "Mensageria oficial para conversas com investidores.",
    kind: "externa",
    status: "planejado",
  },
  {
    key: "portal_investidor",
    label: "Portal do Investidor",
    description: "Sinais de jornada e identidade do investidor.",
    kind: "interna",
    status: "planejado",
  },
  {
    key: "central_executivo",
    label: "Central do Executivo",
    description: "Sessão, usuários e permissões compartilhadas.",
    kind: "interna",
    status: "planejado",
  },
  {
    key: "alertas",
    label: "Sistema de Alertas",
    description: "Encaminhamento de avisos operacionais.",
    kind: "interna",
    status: "planejado",
  },
  {
    key: "agendamentos",
    label: "Sistema de Agendamentos",
    description: "Reuniões e compromissos do relacionamento.",
    kind: "interna",
    status: "planejado",
  },
  {
    key: "templates",
    label: "Sistema de Templates",
    description: "Modelos padronizados de comunicação.",
    kind: "interna",
    status: "planejado",
  },
  {
    key: "ia",
    label: "Inteligência Artificial",
    description: "Camada de apoio analítico e geração de texto.",
    kind: "interna",
    status: "planejado",
  },
];