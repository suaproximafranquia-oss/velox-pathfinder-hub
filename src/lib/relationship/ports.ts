/**
 * PORTAS DO MOTOR — isolamento entre produção e homologação.
 *
 * O motor não conhece banco, WhatsApp nem simulador: ele recebe um
 * repositório e um despachante já vinculados a um escopo. É assim que a
 * mesma lógica roda em produção e na homologação sem compartilhar dados
 * nem estados críticos (COMANDO 1B §12).
 */
import type { TemplateResolver } from "./templates";
import type {
  CadenceRecord,
  EngineDecision,
  EngineEvent,
  EngineScope,
  QueueItem,
} from "./types";

export type EngineRepository = {
  scope: EngineScope;
  runId: string | null;
  loadRecord: (leadId: string) => Promise<CadenceRecord | null>;
  saveRecord: (record: CadenceRecord) => Promise<void>;
  /** Retorna false quando o evento já havia sido aplicado (idempotência). */
  registerEvent: (event: EngineEvent) => Promise<boolean>;
  loadQueue: (leadId: string) => Promise<QueueItem[]>;
  upsertQueueItem: (item: Omit<QueueItem, "id"> & { id?: string }) => Promise<QueueItem>;
  /**
   * Reserva atômica da tarefa: só UM processo consegue mover a tarefa de
   * PENDING para PROCESSING. Retorna false quando outro processo já a
   * reservou — é a trava contra execução duplicada (§7).
   */
  claimQueueItem: (id: string) => Promise<boolean>;
  updateQueueItem: (id: string, patch: Partial<QueueItem>) => Promise<void>;
  cancelPendingItems: (leadId: string, reason: string) => Promise<number>;
  recordDecision: (decision: EngineDecision) => Promise<void>;
  loadTemplates: () => Promise<TemplateResolver>;
};

export type DispatchRequest = {
  scope: EngineScope;
  leadId: string;
  step: string;
  /** Quando true, o envio precisa usar template oficial de janela. */
  useTemplate: boolean;
  templateId: string | null;
  /** Compatibilidade histórica: o link agora vem da própria mensagem. */
  contentId?: string | null;
  contentUrl?: string | null;
};

export type DispatchResult = {
  delivered: boolean;
  externalId?: string | null;
  error?: string;
};

/**
 * Despachante do escopo. A implementação de produção fala com o canal
 * oficial; a de homologação registra a mensagem fictícia. Nenhuma delas
 * pode receber um lead do outro escopo.
 */
export type EngineDispatcher = {
  scope: EngineScope;
  /** Trava final: o destinatário pertence a este escopo? */
  assertRecipientAllowed: (leadId: string) => Promise<{ ok: boolean; reason?: string }>;
  send: (request: DispatchRequest) => Promise<DispatchResult>;
};