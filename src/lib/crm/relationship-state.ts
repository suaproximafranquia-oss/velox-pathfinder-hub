/**
 * CRM de Relacionamento — Motor Inteligente do Relacionamento (DF 2.4.4).
 *
 * O estágio de cada relacionamento é SEMPRE derivado do comportamento
 * observado: o Executivo nunca altera manualmente o estado. Este motor é
 * exclusivo do CRM e não interfere no `lead-state` usado pelos demais
 * módulos da plataforma.
 *
 *  🟢 novo                 — Lead criado, sem qualquer resposta do investidor.
 *  🟡 aguardando_resposta  — Executivo enviou mensagem, investidor não respondeu.
 *  🔵 em_atendimento       — Investidor respondeu: conversa ativa.
 *  🔴 inativo              — Sem interação relevante na janela configurada.
 */

export type CrmRelationshipState =
  | "novo"
  | "aguardando_resposta"
  | "em_atendimento"
  | "inativo";

export const CRM_RELATIONSHIP_META: Record<
  CrmRelationshipState,
  { label: string; hint: string; dot: string; chip: string; pulse: boolean }
> = {
  novo: {
    label: "Novo",
    hint: "Lead recém-criado, ainda sem resposta do investidor.",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    pulse: false,
  },
  aguardando_resposta: {
    label: "Aguardando resposta",
    hint: "Mensagem enviada pelo Executivo, sem retorno do investidor.",
    dot: "bg-amber-400",
    chip: "bg-amber-50 text-amber-700",
    pulse: false,
  },
  em_atendimento: {
    label: "Em atendimento",
    hint: "O investidor respondeu — conversa ativa.",
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-700",
    pulse: true,
  },
  inativo: {
    label: "Inativo",
    hint: "Sem interação relevante durante o período configurado.",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700",
    pulse: false,
  },
};

/**
 * MICROCOMANDO — estado VISUAL único da conversa.
 *
 * A lista do CRM nunca exibe dois indicadores: "não lida" (azul) é um
 * estado, não um selo adicional. Verde (Novo) → Laranja (Em atendimento)
 * ao abrir; Laranja → Azul ao marcar como não lida; Azul → Laranja ao
 * abrir novamente. Sempre por conversa, nunca em lote.
 */
export type CrmVisualState = CrmRelationshipState | "nao_lida";

export const CRM_VISUAL_META: Record<
  CrmVisualState,
  { label: string; hint: string; dot: string; chip: string; pulse: boolean }
> = {
  ...CRM_RELATIONSHIP_META,
  nao_lida: {
    label: "Não lida",
    hint: "Marcada manualmente pelo Executivo como pendente de leitura.",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700",
    pulse: false,
  },
};


type Entry = {
  /** Último envio registrado do Executivo. */
  lastOutboundAt?: string;
  /** Última resposta registrada do investidor. */
  lastInboundAt?: string;
  /** Abertura de janela provocada pelo envio de um Template aprovado. */
  lastWindowOpenedAt?: string;
};

type StateMap = Record<string, Entry>;

const CONFIG_KEY = "velox:crm:relationship-inactivity-days:v1";
/** DF 2.4.7 — inatividade oficial: 10 dias sem interação. */
const DEFAULT_INACTIVITY_DAYS = 10;

import { loadLeads, patchCachedLead } from "@/lib/leads";
import { updateWorkspaceOperational } from "@/lib/workspace-operational.functions";

function read(): StateMap {
  return Object.fromEntries(loadLeads().map((lead) => [lead.id, {
    lastOutboundAt: lead.lastOutboundAt ?? undefined,
    lastInboundAt: lead.lastInboundAt ?? undefined,
    lastWindowOpenedAt: lead.conversationWindowOpenedAt ?? undefined,
  }]));
}

function write(map: StateMap) {
  for (const [id, entry] of Object.entries(map)) {
    const patch = {
      lastOutboundAt: entry.lastOutboundAt ?? null,
      lastInboundAt: entry.lastInboundAt ?? null,
      conversationWindowOpenedAt: entry.lastWindowOpenedAt ?? null,
    };
    patchCachedLead(id, patch);
    void updateWorkspaceOperational({ data: { id, ...patch } }).catch(() => undefined);
  }
}

/** Período de inatividade configurável (em dias). */
export function inactivityDays(): number {
  if (typeof window === "undefined") return DEFAULT_INACTIVITY_DAYS;
  const raw = Number(window.localStorage.getItem(CONFIG_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INACTIVITY_DAYS;
}

export function setInactivityDays(days: number): void {
  if (typeof window === "undefined" || !Number.isFinite(days) || days <= 0) return;
  window.localStorage.setItem(CONFIG_KEY, String(Math.round(days)));
}

/** Registro automático — mensagem enviada pelo Executivo. */
export function markOutboundMessage(investorId: string, at = new Date().toISOString()): void {
  const map = read();
  map[investorId] = { ...(map[investorId] ?? {}), lastOutboundAt: at };
  write(map);
}

/** Registro automático — resposta recebida do investidor. */
export function markInboundMessage(investorId: string, at = new Date().toISOString()): void {
  const map = read();
  map[investorId] = { ...(map[investorId] ?? {}), lastInboundAt: at };
  write(map);
}

/** Última resposta registrada do investidor — base da janela de 24 horas. */
export function lastInboundAt(investorId: string): string | null {
  return read()[investorId]?.lastInboundAt ?? null;
}

/**
 * DEF 2.4.15 §2 — o envio de um Template aprovado abre imediatamente uma
 * nova Janela de Conversação de 24 horas.
 */
export function markWindowOpened(
  investorId: string,
  at = new Date().toISOString(),
): void {
  const map = read();
  map[investorId] = { ...(map[investorId] ?? {}), lastWindowOpenedAt: at };
  write(map);
}

/**
 * Âncora oficial da janela: a mais recente entre a resposta do investidor
 * e a última abertura por Template.
 */
export function windowAnchorAt(investorId: string): string | null {
  const entry = read()[investorId] ?? {};
  const a = ts(entry.lastInboundAt);
  const b = ts(entry.lastWindowOpenedAt);
  const max = Math.max(a, b);
  return max > 0 ? new Date(max).toISOString() : null;
}

function ts(iso?: string | null): number {
  if (!iso) return 0;
  const v = Date.parse(iso);
  return Number.isFinite(v) ? v : 0;
}

export type CrmRelationshipSubject = {
  id: string;
  /** Última atividade observada do investidor (resposta/interação). */
  lastInvestorActivityIso?: string;
};

/**
 * Resolução automática do estágio (DF 2.4.7 §1).
 *
 * Ciclo oficial (DEF 2.4.10 §1):
 *   Novo → Aguardando resposta (1º envio do Executivo)
 *        → Em atendimento (resposta ou atividade do investidor)
 *        → Inativo (10 dias sem qualquer interação do investidor).
 *
 * Reativação: qualquer nova resposta ou nova atividade do investidor
 * devolve o relacionamento automaticamente para "Em atendimento".
 */
export function resolveRelationshipState(
  subject: CrmRelationshipSubject,
  now = Date.now(),
): CrmRelationshipState {
  const entry = read()[subject.id] ?? {};
  const outbound = ts(entry.lastOutboundAt);
  const inbound = ts(entry.lastInboundAt);
  // Atividade no Portal conta como interação do investidor.
  const portalActivity = ts(subject.lastInvestorActivityIso);
  const lastRelevant = Math.max(outbound, inbound, portalActivity);
  const limit = inactivityDays() * 86_400_000;

  // Inativo: 10 dias sem qualquer interação do investidor nem do Executivo.
  if (lastRelevant > 0 && now - lastRelevant > limit) return "inativo";

  // Resposta do investidor — ou atividade posterior ao último envio —
  // caracteriza conversa ativa.
  if (inbound > 0) return "em_atendimento";
  if (outbound > 0) return portalActivity > outbound ? "em_atendimento" : "aguardando_resposta";
  return "novo";
}

/**
 * Reativação: verdadeira quando o investidor voltou a interagir depois da
 * janela de inatividade. Usada para gerar o alerta automático.
 */
export function isReactivated(subject: CrmRelationshipSubject, now = Date.now()): boolean {
  const entry = read()[subject.id] ?? {};
  const lastRelevant = Math.max(ts(entry.lastOutboundAt), ts(entry.lastInboundAt));
  if (lastRelevant <= 0) return false;
  if (now - lastRelevant <= inactivityDays() * 86_400_000) return false;
  return ts(subject.lastInvestorActivityIso) > lastRelevant;
}
