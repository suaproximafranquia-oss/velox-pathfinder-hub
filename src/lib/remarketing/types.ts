/**
 * Tipos e estados do CRM de Remarketing.
 *
 * Ambiente operacional independente: nenhum destes estados existe no
 * CRM de Relacionamento e nenhuma etapa/cadência é compartilhada.
 */
export type RemarketingCampaignStatus =
  | "rascunho"
  | "pronta"
  | "em_execucao"
  | "pausada"
  | "cancelada"
  | "concluida";

export const CAMPAIGN_STATUS_LABEL: Record<RemarketingCampaignStatus, string> = {
  rascunho: "Rascunho",
  pronta: "Pronta",
  em_execucao: "Em execução",
  pausada: "Pausada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

export type RemarketingContactStatus =
  | "pendente"
  | "enviado"
  | "erro"
  | "cancelado"
  | "invalido"
  | "duplicado";

export const CONTACT_STATUS_LABEL: Record<RemarketingContactStatus, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  erro: "Erro",
  cancelado: "Cancelado",
  invalido: "Inválido",
  duplicado: "Duplicado",
};

export type RemarketingContact = {
  id: string;
  campaignId: string;
  phone: string;
  rawInput: string;
  status: RemarketingContactStatus;
  error: string | null;
  sentAt: string | null;
};

export type RemarketingCampaign = {
  id: string;
  name: string;
  templateName: string;
  templateLabel: string;
  templateLanguage: string | null;
  templateBody: string;
  status: RemarketingCampaignStatus;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  pendingCount: number;
  sentCount: number;
  errorCount: number;
  cancelledCount: number;
  createdByName: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
};

export function canStart(status: RemarketingCampaignStatus): boolean {
  return status === "pronta" || status === "pausada" || status === "rascunho";
}

export function canPause(status: RemarketingCampaignStatus): boolean {
  return status === "em_execucao";
}

export function canCancel(status: RemarketingCampaignStatus): boolean {
  return status !== "cancelada" && status !== "concluida";
}
