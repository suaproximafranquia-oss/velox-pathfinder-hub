/**
 * Ponte entre o Lead local (navegador do investidor) e a base real
 * (Lovable Cloud) consumida pelo Workspace do Executivo.
 *
 * Antes desta camada o Lead nascia apenas no localStorage do visitante —
 * o Card jamais chegava ao navegador do executivo. Aqui garantimos:
 *  1. gravação imediata e silenciosa no servidor a cada Lead/atualização;
 *  2. leitura + tempo real no Workspace, sem recarregar a página;
 *  3. persistência após reload (a verdade passa a ser o servidor).
 */
import {
  syncPortalLead,
  listPortalLeads,
  deletePortalLead,
  lookupPortalLead,
} from "@/lib/portal-leads.functions";
import { resolveLeadScope } from "@/lib/lead-routing";
import { loadLeads, replaceLeads, type LeadRecord } from "@/lib/leads";

/** Envia (fire-and-forget) o Lead para o servidor. Nunca bloqueia a UI. */
export function pushLead(lead: LeadRecord, extra?: {
  responsibleExecutiveSlug?: string | null;
  campaign?: string | null;
  device?: string | null;
  lastActivityAt?: string;
  journey?: Record<string, unknown>;
}): void {
  if (typeof window === "undefined") return;
  const scope =
    lead.scope ??
    resolveLeadScope({
      personalized: lead.personalized,
      responsibleExecutiveId: lead.responsibleExecutiveId,
    });
  void syncPortalLead({
    data: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      whatsapp: lead.whatsapp,
      city: lead.city,
      origin: lead.origin,
      material: lead.material,
      scope,
      personalized: lead.personalized,
      responsibleExecutiveId: lead.responsibleExecutiveId,
      responsibleExecutiveSlug: extra?.responsibleExecutiveSlug ?? null,
      campaign: extra?.campaign ?? null,
      device: extra?.device ?? null,
      createdAt: lead.createdAt,
      lastActivityAt: extra?.lastActivityAt ?? new Date().toISOString(),
      journey: extra?.journey ?? {},
    },
  }).catch(() => {
    /* silencioso: a jornada do investidor nunca pode quebrar por rede */
  });
}

type RemoteLead = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  city: string | null;
  origin: string | null;
  material: string | null;
  scope: "green_sales" | "portal";
  personalized: boolean;
  responsible_executive_id: string | null;
  created_at: string;
};

function toLocal(row: RemoteLead): LeadRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp ?? "",
    city: row.city ?? "",
    origin: row.origin ?? "Portal Velox",
    material: row.material ?? "",
    createdAt: row.created_at,
    responsibleExecutiveId: row.responsible_executive_id,
    personalized: row.personalized,
    scope: row.scope,
  };
}

/**
 * Busca a base real e espelha no armazenamento local usado por
 * `listAllInvestors()`. O servidor é a fonte de verdade do escopo.
 */
export async function pullLeads(): Promise<number> {
  const rows = (await listPortalLeads()) as unknown as RemoteLead[];
  const remote = rows.map(toLocal);
  const remoteIds = new Set(remote.map((l) => l.id));
  const local = loadLeads();
  const localById = new Map(local.map((l) => [l.id, l]));
  // DEF 2.5.3 §6 — campos operacionais mantidos apenas no Workspace
  // (ex.: Notas do Executivo) não podem ser perdidos ao espelhar a base.
  const merged = remote.map((l) => {
    const notes = localById.get(l.id)?.notes;
    return notes ? { ...l, notes } : l;
  });
  const localOnly = local.filter((l) => !remoteIds.has(l.id));
  replaceLeads([...merged, ...localOnly]);
  return remote.length;
}

export async function removeLeadEverywhere(id: string): Promise<void> {
  try {
    await deletePortalLead({ data: { id } });
  } catch {
    /* remoção local já ocorreu */
  }
}

/**
 * Recupera a jornada do investidor em outro navegador ou dispositivo.
 *
 * O Gateway chama esta função ANTES de criar qualquer registro: se o
 * servidor já conhece esse e-mail + WhatsApp, o Lead é espelhado no
 * armazenamento local e o fluxo seguinte reconhece o visitante como
 * recorrente, sem duplicar cadastro, conversa ou backup.
 */
export async function restoreLeadFromCloud(input: {
  email: string;
  phone: string;
}): Promise<LeadRecord | null> {
  if (typeof window === "undefined") return null;
  try {
    const row = (await lookupPortalLead({
      data: { email: input.email, phone: input.phone },
    })) as unknown as RemoteLead | null;
    if (!row) return null;
    const lead = toLocal(row);
    const local = loadLeads();
    if (local.some((l) => l.id === lead.id)) return lead;
    replaceLeads([lead, ...local]);
    return lead;
  } catch {
    return null;
  }
}

/**
 * Assina alterações em tempo real da carteira.
 *
 * O cliente de tempo real é carregado sob demanda: só o Workspace do
 * executivo precisa dele, então o investidor nunca paga esse download.
 */
export function subscribeLeads(onChange: () => void): () => void {
  let dispose: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    if (cancelled) return;
    const channel = supabase
      .channel("portal-leads-workspace")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_leads" },
        () => onChange(),
      )
      .subscribe();
    dispose = () => {
      void supabase.removeChannel(channel);
    };
  })();

  return () => {
    cancelled = true;
    dispose?.();
  };
}
