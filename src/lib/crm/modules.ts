/**
 * DEF 3.0.3 — mapa mínimo das áreas do CRM.
 *
 * O CRM existe exclusivamente para o relacionamento entre Executivo e
 * Investidor. Tudo que já existe em outro módulo da plataforma (Agenda,
 * Portal do Investidor, Histórico/Timeline, IA e Integrações) foi
 * removido daqui para eliminar duplicidade e reduzir a navegação.
 */
export type CrmAreaKey = "conversas" | "distribuicao" | "templates";

export type CrmArea = {
  key: CrmAreaKey;
  label: string;
  description: string;
  path: `/crm/${CrmAreaKey}`;
  /** Área restrita à administração/supervisão do CRM. */
  adminOnly?: boolean;
};

export const CRM_AREAS: CrmArea[] = [
  {
    key: "conversas",
    label: "Conversas",
    description: "Atendimento e mensagens com o investidor.",
    path: "/crm/conversas",
  },
  {
    key: "distribuicao",
    label: "Distribuição de Leads",
    description: "Novos contatos, sincronização do GreenSales e conflitos.",
    path: "/crm/distribuicao",
    adminOnly: true,
  },
  {
    key: "templates",
    label: "Templates",
    description: "Modelos oficiais usados na conversa.",
    path: "/crm/templates",
  },
];