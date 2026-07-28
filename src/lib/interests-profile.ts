/**
 * Perfil Comercial do Investidor — captura de interesses no Manual (Cap. VI).
 *
 * Persiste as respostas do capítulo "Personalizando sua jornada" em
 * localStorage, gera um resumo dinâmico (IA Corporativa leve) e alimenta
 * o Perfil Inteligente através do barramento de eventos e dos comentários
 * internos do investidor. Não altera regras existentes: apenas produz
 * dados novos consumidos pelos módulos já implementados.
 */
import { emitEvent } from "@/lib/events/bus";
import { addComment } from "@/lib/investor-comments";
import { getResponsibleExecutive } from "@/lib/responsible-executive";

export type AudienceProfile = "pf" | "pj" | "ambos";

export type InterestsProfile = {
  investorId: string;
  executiveId: string | null;
  personalized: boolean;
  audience: AudienceProfile | null;
  interests: string[];
  summary: string;
  capturedAt: string;
};

const KEY = "velox:interests-profile:v1";
const VISITOR_KEY = "velox:visitor:id";

function ensureVisitorId(): string {
  if (typeof window === "undefined") return "guest";
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `vis_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function readAll(): InterestsProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as InterestsProfile[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: InterestsProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function getInterestsProfile(investorId?: string): InterestsProfile | null {
  const id = investorId ?? ensureVisitorId();
  return readAll().find((p) => p.investorId === id) ?? null;
}

export function listInterestsByExecutive(executiveId: string): InterestsProfile[] {
  return readAll().filter((p) => p.executiveId === executiveId);
}

const AUDIENCE_LABEL: Record<AudienceProfile, string> = {
  pf: "Pessoa Física",
  pj: "Pessoa Jurídica",
  ambos: "Pessoa Física e Jurídica",
};

const PJ_INTERESTS = new Set([
  "Capital de Giro",
  "Antecipação de Recebíveis",
  "Crédito Empresarial",
  "Seguro Empresarial",
  "Consórcio Empresarial",
]);

function buildSummary(audience: AudienceProfile | null, interests: string[]): string {
  if (!audience && interests.length === 0) {
    return "O investidor ainda não sinalizou preferências claras. Recomenda-se iniciar a conversa apresentando o portfólio de forma ampla e consultiva.";
  }
  const audiencePart = audience
    ? `Perfil comercial declarado: ${AUDIENCE_LABEL[audience]}.`
    : "Perfil comercial ainda não declarado.";
  if (interests.length === 0) {
    return `${audiencePart} Nenhuma solução específica foi destacada — vale iniciar a apresentação de forma consultiva, mapeando necessidades.`;
  }
  const pjCount = interests.filter((i) => PJ_INTERESTS.has(i)).length;
  const leaning =
    pjCount >= interests.length - pjCount
      ? "com maior aderência a soluções voltadas ao mercado empresarial"
      : "com maior aderência a soluções voltadas à pessoa física";
  const top = interests.slice(0, 3).join(", ");
  return `${audiencePart} O investidor demonstrou maior interesse por ${top}${
    interests.length > 3 ? ` e outras ${interests.length - 3} soluções` : ""
  } — ${leaning}. Recomenda-se iniciar a apresentação comercial priorizando estes temas.`;
}

export function saveInterestsProfile(input: {
  audience: AudienceProfile | null;
  interests: string[];
}): InterestsProfile {
  const investorId = ensureVisitorId();
  const responsible = getResponsibleExecutive();
  const summary = buildSummary(input.audience, input.interests);
  const now = new Date().toISOString();

  const profile: InterestsProfile = {
    investorId,
    executiveId: responsible.executive?.id ?? null,
    personalized: responsible.personalized,
    audience: input.audience,
    interests: input.interests,
    summary,
    capturedAt: now,
  };

  const list = readAll().filter((p) => p.investorId !== investorId);
  list.push(profile);
  writeAll(list);

  emitEvent({
    type: "profile.interests.captured",
    investorId,
    actorId: responsible.executive?.id ?? null,
    payload: {
      audience: input.audience,
      interests: input.interests,
      personalized: responsible.personalized,
    },
  });

  // Registra o resumo como comentário automático para alimentar a IA
  // Corporativa e o Perfil Inteligente do executivo responsável.
  addComment({
    investorId,
    authorId: "ai_corporate",
    authorName: "IA Corporativa",
    body: summary,
  });

  return profile;
}