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
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700",
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

type Entry = {
  /** Último envio registrado do Executivo. */
  lastOutboundAt?: string;
  /** Última resposta registrada do investidor. */
  lastInboundAt?: string;
};

type StateMap = Record<string, Entry>;

const KEY = "velox:crm:relationship-state:v1";
const CONFIG_KEY = "velox:crm:relationship-inactivity-days:v1";
const DEFAULT_INACTIVITY_DAYS = 7;

function read(): StateMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StateMap) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: StateMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* noop */
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
 * Resolução automática do estágio. Toda interação do investidor posterior
 * ao último envio do Executivo é tratada como resposta.
 */
export function resolveRelationshipState(
  subject: CrmRelationshipSubject,
  now = Date.now(),
): CrmRelationshipState {
  const entry = read()[subject.id] ?? {};
  const outbound = ts(entry.lastOutboundAt);
  const inbound = Math.max(ts(entry.lastInboundAt), ts(subject.lastInvestorActivityIso));
  const lastRelevant = Math.max(outbound, inbound);
  const limit = inactivityDays() * 86_400_000;

  // Inatividade: nenhuma interação relevante dentro da janela configurada.
  if (lastRelevant > 0 && now - lastRelevant > limit) return "inativo";

  // Resposta do investidor após o último envio → conversa ativa.
  if (inbound > 0 && inbound >= outbound && outbound > 0) return "em_atendimento";
  if (outbound > 0) return "aguardando_resposta";
  if (inbound > 0) return "em_atendimento";
  return "novo";
}
