import { notifySync } from "@/lib/sync-bus";
/**
 * CRM de Relacionamento — Timeline automática do sistema.
 *
 * Toda ocorrência relevante é registrada automaticamente, sem qualquer
 * interação do usuário: data, hora, origem, motivo, Executivo responsável
 * e evento ocorrido. O log é append-only.
 */
export type CrmTimelineEvent =
  | "relacionamento_oficial"
  | "duplicidade_detectada"
  | "acesso_bloqueado"
  | "conversa_aberta"
  | "sincronizacao"
  | "contato_recebido"
  | "sincronizacao_iniciada"
  | "tempo_expirado"
  | "distribuicao_realizada"
  | "sincronizacao_tardia"
  | "conflito_identificado"
  | "responsavel_mantido"
  | "lead_criado"
  | "lead_redistribuido"
  | "reuniao_agendada"
  | "mensagem_enviada"
  | "atividade_portal"
  | "relacionamento_iniciado"
  | "relacionamento_arquivado"
  | "relacionamento_restaurado"
  | "retorno_identificado"
  | "template_automatico"
  | "janela_reaberta"
  | "portal_liberado";

export const CRM_TIMELINE_LABEL: Record<CrmTimelineEvent, string> = {
  relacionamento_oficial: "Relacionamento oficial definido",
  duplicidade_detectada: "Duplicidade identificada",
  acesso_bloqueado: "Acesso bloqueado por relacionamento ativo",
  conversa_aberta: "Conversa aberta",
  sincronizacao: "Sincronização de base",
  contato_recebido: "Contato recebido",
  sincronizacao_iniciada: "Sincronização iniciada",
  tempo_expirado: "Tempo de espera expirado",
  distribuicao_realizada: "Distribuição realizada",
  sincronizacao_tardia: "Sincronização tardia",
  conflito_identificado: "Conflito identificado",
  responsavel_mantido: "Responsável mantido",
  lead_criado: "Lead criado no CRM",
  lead_redistribuido: "Lead redistribuído",
  reuniao_agendada: "Reunião agendada pelo CRM",
  mensagem_enviada: "Mensagem enviada pelo Executivo",
  atividade_portal: "Atividade do investidor no Portal",
  relacionamento_iniciado: "Relacionamento comercial iniciado",
  relacionamento_arquivado: "Relacionamento arquivado no Backup Portal",
  relacionamento_restaurado: "Conversa restaurada do Backup Portal",
  retorno_identificado: "Retorno do investidor identificado",
  template_automatico: "Template automático enviado pelo sistema",
  janela_reaberta: "Janela de conversação reaberta por Template",
  portal_liberado: "Portal do Investidor liberado manualmente",
};

export type CrmTimelineEntry = {
  id: string;
  /** ISO completo — data e hora do registro. */
  at: string;
  investorId: string;
  event: CrmTimelineEvent;
  /** Origem do investidor/ocorrência (Green Sales, Portal, manual…). */
  origin: string;
  /** Motivo objetivo da ocorrência. */
  reason: string;
  /** Executivo responsável oficial no momento do registro. */
  ownerId: string;
  /** Usuário que provocou a ocorrência (pode diferir do responsável). */
  actorId: string;
};

const STORAGE_KEY = "crm.timeline.v1";
const LIMIT = 2000;

function readAll(): CrmTimelineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CrmTimelineEntry[]) : [];
  } catch {
    return [];
  }
}

/** Cache completo — usado pela sincronização com o servidor. */
export function readAllTimeline(): CrmTimelineEntry[] {
  return readAll();
}

/** Substitui o cache pela Timeline oficial autorizada do banco. */
export function mergeRemoteTimeline(remote: CrmTimelineEntry[]): void {
  if (typeof window === "undefined") return;
  const official = remote.slice().sort((a, b) => (a.at < b.at ? -1 : 1)).slice(-LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(official));
  } catch {
    /* armazenamento indisponível */
  }
  notifySync("timeline");
}

/** Registro automático — silencioso e idempotente por ocorrência única. */
export function recordCrmEvent(entry: Omit<CrmTimelineEntry, "id" | "at">): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  const last = all[all.length - 1];
  if (
    last &&
    last.investorId === entry.investorId &&
    last.event === entry.event &&
    last.actorId === entry.actorId &&
    Date.now() - Date.parse(last.at) < 60_000
  ) {
    return; // evita duplicar a mesma ocorrência em sequência
  }
  const next: CrmTimelineEntry = {
    ...entry,
    id: `crmtl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...all, next].slice(-LIMIT)),
    );
  } catch {
    /* armazenamento indisponível */
  }
  // Fonte de verdade no servidor — o cache local é só apresentação.
  void import("@/lib/crm/server-sync").then((m) => m.mirrorCrmRecords({ timeline: [next] }));
  notifySync("timeline");
}

export function listCrmTimeline(investorId?: string): CrmTimelineEntry[] {
  const all = readAll();
  const scoped = investorId ? all.filter((e) => e.investorId === investorId) : all;
  return scoped.slice().reverse();
}

export function formatCrmTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
