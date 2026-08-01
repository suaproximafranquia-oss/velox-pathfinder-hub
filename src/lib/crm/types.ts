/**
 * CRM de Relacionamento — tipos fundacionais.
 *
 * Esta etapa cria APENAS a fundação arquitetural. Nenhuma funcionalidade
 * é implementada aqui: os tipos existem para que os módulos futuros
 * (pipeline, interações, tarefas) nasçam sobre uma base estável.
 *
 * Regras herdadas do ecossistema Velox:
 *  - mesmo banco, mesma autenticação, mesmos usuários e permissões;
 *  - todo registro pertence a um Executivo (`ownerId`) e a um workspace.
 */
import type { ExecutiveRole } from "@/lib/executive-auth";

/** Etapas previstas do relacionamento. Estrutura preparada, sem regras. */
export type CrmStage =
  | "novo"
  | "contato_inicial"
  | "qualificacao"
  | "reuniao"
  | "proposta"
  | "decisao"
  | "encerrado";

export const CRM_STAGE_LABEL: Record<CrmStage, string> = {
  novo: "Novo",
  contato_inicial: "Contato inicial",
  qualificacao: "Qualificação",
  reuniao: "Reunião",
  proposta: "Proposta",
  decisao: "Decisão",
  encerrado: "Encerrado",
};

/** Registro base de relacionamento — sempre vinculado a um Executivo. */
export type CrmRelationship = {
  id: string;
  workspaceId: string;
  /** Executivo proprietário. Base de todo o isolamento por usuário. */
  ownerId: string;
  investorName: string;
  stage: CrmStage;
  createdAt: number;
  updatedAt: number;
};

/** Contexto mínimo do usuário utilizado pelas checagens do CRM. */
export type CrmActor = {
  userId: string;
  workspaceId: string;
  role: ExecutiveRole;
};