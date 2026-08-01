/**
 * CRM de Relacionamento — fluxo inteligente de distribuição de Leads.
 *
 * Contatos que chegam ao número institucional antes da sincronização do
 * GreenSales entram numa fila própria (intake). O fluxo é:
 *
 *   contato recebido → aguardando sincronização (janela configurável)
 *      ├─ GreenSales sincroniza no prazo → responsabilidade informada
 *      └─ prazo expirado → disponível para distribuição manual (Gestor)
 *
 * Após a distribuição o Executivo torna-se o responsável OFICIAL. Uma
 * sincronização tardia do GreenSales jamais reatribui o relacionamento:
 * o conflito é registrado e o responsável é mantido.
 */
import { recordCrmEvent } from "@/lib/crm/timeline";
import { phoneKeyOf, emailKeyOf } from "@/lib/crm/ownership";

export type CrmIntakeStatus =
  | "aguardando_sincronizacao"
  | "disponivel"
  | "distribuido"
  | "sincronizado";

export const CRM_INTAKE_LABEL: Record<CrmIntakeStatus, string> = {
  aguardando_sincronizacao: "Sincronização em andamento",
  disponivel: "Disponível para distribuição",
  distribuido: "Distribuído manualmente",
  sincronizado: "Sincronizado pelo GreenSales",
};

export const CRM_INTAKE_DOT: Record<CrmIntakeStatus, string> = {
  aguardando_sincronizacao: "bg-sky-500",
  disponivel: "bg-amber-400",
  distribuido: "bg-emerald-500",
  sincronizado: "bg-emerald-500",
};

export type CrmIntakeLead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** Canal/origem do primeiro contato. */
  origin: string;
  status: CrmIntakeStatus;
  /** ISO do primeiro contato — início da janela de sincronização. */
  receivedAt: string;
  /** ISO do fim da janela de espera. */
  syncDeadline: string;
  /** Responsável oficial — definido por sincronização ou distribuição. */
  ownerId?: string;
  /** Conflito de sincronização tardia, quando houver. */
  conflict?: { attemptedOwnerId: string; at: string };
};

/* ------------------------------------------------------------------ */
/* Configuração                                                        */
/* ------------------------------------------------------------------ */

const CONFIG_KEY = "crm.distribution.config.v1";
const STORE_KEY = "crm.intake.v1";

/** Janela padrão de espera pelo GreenSales — configurável pelo sistema. */
export const DEFAULT_SYNC_WAIT_HOURS = 3;

export type CrmDistributionConfig = { syncWaitHours: number };

export function getDistributionConfig(): CrmDistributionConfig {
  if (typeof window === "undefined") return { syncWaitHours: DEFAULT_SYNC_WAIT_HOURS };
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const hours = Number(parsed?.syncWaitHours);
    return {
      syncWaitHours: Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SYNC_WAIT_HOURS,
    };
  } catch {
    return { syncWaitHours: DEFAULT_SYNC_WAIT_HOURS };
  }
}

/** Alteração da janela de espera sem necessidade de desenvolvimento. */
export function setSyncWaitHours(hours: number): CrmDistributionConfig {
  const value = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SYNC_WAIT_HOURS;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ syncWaitHours: value }));
    } catch {
      /* armazenamento indisponível */
    }
  }
  return { syncWaitHours: value };
}

/* ------------------------------------------------------------------ */
/* Persistência                                                        */
/* ------------------------------------------------------------------ */

function readAll(): CrmIntakeLead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CrmIntakeLead[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: CrmIntakeLead[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(items));
  } catch {
    /* armazenamento indisponível */
  }
}

function matches(lead: CrmIntakeLead, phone: string, email: string): boolean {
  const p = phoneKeyOf(phone);
  const e = emailKeyOf(email);
  return (
    (p.length >= 8 && phoneKeyOf(lead.phone) === p) ||
    (e.length > 3 && emailKeyOf(lead.email) === e)
  );
}

/* ------------------------------------------------------------------ */
/* Fluxo                                                               */
/* ------------------------------------------------------------------ */

/**
 * Contato recebido no número institucional. Se o telefone/e-mail já
 * existir na base do CRM, nada é criado — a duplicidade é tratada pelas
 * regras de responsabilidade (DF-002.2).
 */
export function registerIncomingContact(input: {
  name: string;
  phone: string;
  email?: string;
  origin?: string;
  /** Contatos já presentes na base oficial do Portal do Executivo. */
  knownContacts?: { phone: string; email: string }[];
}): CrmIntakeLead | null {
  const all = readAll();
  const phone = input.phone ?? "";
  const email = input.email ?? "";

  const known = (input.knownContacts ?? []).some((c) =>
    matches({ phone: c.phone, email: c.email } as CrmIntakeLead, phone, email),
  );
  if (known) return null;
  const existing = all.find((l) => matches(l, phone, email));
  if (existing) return existing;

  const hours = getDistributionConfig().syncWaitHours;
  const now = new Date();
  const lead: CrmIntakeLead = {
    id: `crmlead_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.name?.trim() || "Contato sem identificação",
    phone,
    email,
    origin: input.origin ?? "Número institucional",
    status: "aguardando_sincronizacao",
    receivedAt: now.toISOString(),
    syncDeadline: new Date(now.getTime() + hours * 3600_000).toISOString(),
  };
  writeAll([...all, lead]);

  recordCrmEvent({
    investorId: lead.id,
    event: "contato_recebido",
    origin: lead.origin,
    reason: "Novo contato sem correspondência na base do CRM.",
    ownerId: "",
    actorId: "sistema",
  });
  recordCrmEvent({
    investorId: lead.id,
    event: "sincronizacao_iniciada",
    origin: lead.origin,
    reason: `Aguardando retorno do GreenSales por ${hours}h.`,
    ownerId: "",
    actorId: "sistema",
  });
  return lead;
}

/** Encerra automaticamente as janelas vencidas. */
export function expireDueLeads(now: number = Date.now()): CrmIntakeLead[] {
  const all = readAll();
  let changed = false;
  const next = all.map((lead) => {
    if (
      lead.status === "aguardando_sincronizacao" &&
      Date.parse(lead.syncDeadline) <= now
    ) {
      changed = true;
      recordCrmEvent({
        investorId: lead.id,
        event: "tempo_expirado",
        origin: lead.origin,
        reason: "GreenSales não sincronizou dentro do prazo configurado.",
        ownerId: "",
        actorId: "sistema",
      });
      return { ...lead, status: "disponivel" as CrmIntakeStatus };
    }
    return lead;
  });
  if (changed) writeAll(next);
  return next;
}

export function listIntakeLeads(): CrmIntakeLead[] {
  return expireDueLeads().slice().sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
}

/** Tempo restante da janela de sincronização (ms; 0 quando encerrada). */
export function remainingSyncMs(lead: CrmIntakeLead, now: number = Date.now()): number {
  if (lead.status !== "aguardando_sincronizacao") return 0;
  return Math.max(0, Date.parse(lead.syncDeadline) - now);
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "prazo encerrado";
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

/** Um Lead só pode ser distribuído após o encerramento da espera. */
export function canDistribute(lead: CrmIntakeLead): boolean {
  return lead.status === "disponivel";
}

/** Distribuição manual pelo Gestor — define o responsável oficial. */
export function assignLead(
  leadId: string,
  executiveId: string,
  actorId: string,
): CrmIntakeLead | null {
  const all = expireDueLeads();
  const lead = all.find((l) => l.id === leadId);
  if (!lead || !canDistribute(lead)) return null;
  const updated: CrmIntakeLead = { ...lead, status: "distribuido", ownerId: executiveId };
  writeAll(all.map((l) => (l.id === leadId ? updated : l)));
  recordCrmEvent({
    investorId: lead.id,
    event: "distribuicao_realizada",
    origin: lead.origin,
    reason: "Distribuição manual realizada pelo Gestor.",
    ownerId: executiveId,
    actorId,
  });
  return updated;
}

/**
 * Sincronização do GreenSales.
 *
 * Dentro do prazo e sem responsável definido, a responsabilidade
 * informada é acatada. Já havendo responsável oficial, o vínculo é
 * MANTIDO e o conflito é registrado.
 */
export function applyGreenSalesSync(input: {
  phone: string;
  email?: string;
  executiveId: string;
}): { lead: CrmIntakeLead; conflict: boolean } | null {
  const all = expireDueLeads();
  const lead = all.find((l) => matches(l, input.phone, input.email ?? ""));
  if (!lead) return null;

  if (!lead.ownerId) {
    const updated: CrmIntakeLead = {
      ...lead,
      status: "sincronizado",
      ownerId: input.executiveId,
    };
    writeAll(all.map((l) => (l.id === lead.id ? updated : l)));
    recordCrmEvent({
      investorId: lead.id,
      event: "relacionamento_oficial",
      origin: "GreenSales",
      reason: "Responsabilidade informada pela sincronização do GreenSales.",
      ownerId: input.executiveId,
      actorId: "sistema",
    });
    return { lead: updated, conflict: false };
  }

  const updated: CrmIntakeLead = {
    ...lead,
    conflict: { attemptedOwnerId: input.executiveId, at: new Date().toISOString() },
  };
  writeAll(all.map((l) => (l.id === lead.id ? updated : l)));
  recordCrmEvent({
    investorId: lead.id,
    event: "sincronizacao_tardia",
    origin: "GreenSales",
    reason: "Sincronização recebida após a distribuição do relacionamento.",
    ownerId: lead.ownerId,
    actorId: "sistema",
  });
  recordCrmEvent({
    investorId: lead.id,
    event: "conflito_identificado",
    origin: "GreenSales",
    reason: "GreenSales indicou outro Executivo para um relacionamento ativo.",
    ownerId: lead.ownerId,
    actorId: input.executiveId,
  });
  recordCrmEvent({
    investorId: lead.id,
    event: "responsavel_mantido",
    origin: "GreenSales",
    reason: "Primeiro relacionamento preservado — responsável inalterado.",
    ownerId: lead.ownerId,
    actorId: "sistema",
  });
  return { lead: updated, conflict: true };
}
