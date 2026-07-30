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
import { supabase } from "@/integrations/supabase/client";
import { syncPortalLead, listPortalLeads, deletePortalLead } from "@/lib/portal-leads.functions";
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
  const localOnly = loadLeads().filter((l) => !remoteIds.has(l.id));
  replaceLeads([...remote, ...localOnly]);
  return remote.length;
}

export async function removeLeadEverywhere(id: string): Promise<void> {
  try {
    await deletePortalLead({ data: { id } });
  } catch {
    /* remoção local já ocorreu */
  }
}

/** Assina alterações em tempo real da carteira. */
export function subscribeLeads(onChange: () => void): () => void {
  const channel = supabase
    .channel("portal-leads-workspace")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "portal_leads" },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
