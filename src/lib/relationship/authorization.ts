/**
 * COMANDO 3G — decisão pura de autorização de leitura do motor.
 *
 * Não altera a lógica do motor: apenas decide QUEM pode ler O QUÊ.
 * Regras: homologação é da gestão; produção é do executivo responsável
 * (ou da gestão); rodadas de homologação não se misturam.
 */
import type { EngineScope } from "./types";

export type RelationshipReadRequest = {
  scope: EngineScope;
  /** Papel administrativo (super admin). */
  isAdmin: boolean;
  /** Gestão (diretora/manager). */
  isManager: boolean;
  /** O executivo autenticado é o responsável pelo lead consultado. */
  ownsLead: boolean;
  /** Rodada solicitada (homologação). */
  requestedRunId?: string | null;
  /** Rodada à qual o registro pertence. */
  recordRunId?: string | null;
};

export function canReadRelationship(req: RelationshipReadRequest): boolean {
  if (req.scope === "homologation") {
    if (!req.isAdmin && !req.isManager) return false;
    // Uma rodada nunca enxerga registros de outra rodada.
    if (req.requestedRunId != null && (req.recordRunId ?? null) !== req.requestedRunId) {
      return false;
    }
    return true;
  }
  return req.isAdmin || req.isManager || req.ownsLead;
}

/** Homologação exige gestão — usado antes de qualquer leitura de rodada. */
export function canReadHomologation(req: Pick<RelationshipReadRequest, "isAdmin" | "isManager">) {
  return req.isAdmin || req.isManager;
}