/**
 * CRM de Relacionamento — mapa das áreas funcionais futuras.
 *
 * Apenas declaração estrutural: cada área receberá, nas próximas etapas,
 * suas rotas e telas dentro de `/crm/<key>`. Nenhuma funcionalidade é
 * implementada aqui.
 */
export type CrmAreaKey =
  | "conversas"
  | "distribuicao"
  | "timeline"
  | "alertas"
  | "templates"
  | "agendamentos"
  | "portal"
  | "ia"
  | "historico"
  | "integracoes";

export type CrmArea = {
  key: CrmAreaKey;
  label: string;
  description: string;
  /** Caminho reservado — as rotas serão criadas nas próximas etapas. */
  path: `/crm/${CrmAreaKey}`;
  status: "planejado";
};

export const CRM_AREAS: CrmArea[] = [
  {
    key: "conversas",
    label: "Conversas",
    description: "Atendimento e mensagens com o investidor.",
    path: "/crm/conversas",
    status: "planejado",
  },
  {
    key: "distribuicao",
    label: "Distribuição de Leads",
    description: "Novos contatos, sincronização do GreenSales e conflitos.",
    path: "/crm/distribuicao",
    status: "planejado",
  },
  {
    key: "timeline",
    label: "Timeline de Eventos",
    description: "Linha do tempo cronológica do relacionamento.",
    path: "/crm/timeline",
    status: "planejado",
  },
  {
    key: "alertas",
    label: "Alertas",
    description: "Avisos e acionamentos do relacionamento.",
    path: "/crm/alertas",
    status: "planejado",
  },
  {
    key: "templates",
    label: "Templates",
    description: "Modelos de mensagem e documentos padronizados.",
    path: "/crm/templates",
    status: "planejado",
  },
  {
    key: "agendamentos",
    label: "Agendamentos",
    description: "Compromissos e reuniões vinculados ao investidor.",
    path: "/crm/agendamentos",
    status: "planejado",
  },
  {
    key: "portal",
    label: "Portal do Investidor",
    description: "Ponte com a experiência do investidor.",
    path: "/crm/portal",
    status: "planejado",
  },
  {
    key: "ia",
    label: "Inteligência Artificial",
    description: "Apoio analítico e sugestões ao Executivo.",
    path: "/crm/ia",
    status: "planejado",
  },
  {
    key: "historico",
    label: "Histórico",
    description: "Registro consolidado das interações.",
    path: "/crm/historico",
    status: "planejado",
  },
  {
    key: "integracoes",
    label: "Integrações",
    description: "Conexões com sistemas internos e externos.",
    path: "/crm/integracoes",
    status: "planejado",
  },
];