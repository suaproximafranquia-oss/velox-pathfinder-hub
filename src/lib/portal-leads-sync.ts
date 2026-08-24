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
  // O espelho no servidor mantém três escopos: a Central Única da
  // Gestora é persistida como carteira própria (green_sales).
  const remoteScope = scope === "central_unica" ? "green_sales" : scope;
  void syncPortalLead({
    data: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      whatsapp: lead.whatsapp,
      city: lead.city,
      origin: lead.origin,
      material: lead.material,
      scope: remoteScope,
      personalized: lead.personalized,
      responsibleExecutiveId: lead.responsibleExecutiveId,
      responsibleExecutiveSlug: extra?.responsibleExecutiveSlug ?? null,
      campaign: extra?.campaign ?? null,
      device: extra?.device ?? null,
      createdAt: lead.createdAt,
      /**
       * COMANDO 3A §3 — `last_activity_at` só é enviado quando existe uma
       * ATIVIDADE REAL do investidor (jornada, calculadora, retorno).
       * Sincronizações operacionais do executivo (notas, status, cache)
       * não informam o campo e o servidor preserva o valor oficial —
       * sem isso o lead voltava indevidamente ao estado "Novo".
       */
      lastActivityAt: extra?.lastActivityAt,
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
  scope: "green_sales" | "redistribuicao" | "portal" | "tiktok" | "meta";
  personalized: boolean;
  responsible_executive_id: string | null;
  created_at: string;
  last_activity_at?: string | null;
  journey_percent?: number | null;
  journey_chapter?: string | null;
  journey_stage?: string | null;
  journey_completed_at?: string | null;
  journey_last_event_at?: string | null;
  portal_released_at?: string | null;
  whatsapp_confirmed_at?: string | null;
  notes?: string | null;
  viewed_at?: string | null;
  closed_at?: string | null;
  commercial_state?: "journey" | "active" | "archived" | null;
  journey_started_at?: string | null;
  relationship_started_at?: string | null;
  relationship_started_by?: string | null;
  relationship_started_by_name?: string | null;
  relationship_source?: "executive" | "investor_request" | null;
  archived_at?: string | null;
  archived_by?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
  is_private?: boolean | null;
  ownership_claimed_at?: string | null;
  ownership_origin?: string | null;
  last_outbound_at?: string | null;
  last_inbound_at?: string | null;
  conversation_window_opened_at?: string | null;
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
    journeyPercent: row.journey_percent ?? 0,
    journeyChapter: row.journey_chapter ?? null,
    journeyStage: row.journey_stage ?? null,
    journeyCompletedAt: row.journey_completed_at ?? null,
    journeyLastEventAt: row.journey_last_event_at ?? null,
    portalReleasedAt: row.portal_released_at ?? null,
    whatsappConfirmedAt: row.whatsapp_confirmed_at ?? null,
    lastActivityAt: row.last_activity_at ?? null,
    notes: row.notes ?? "",
    viewedAt: row.viewed_at ?? null,
    closedAt: row.closed_at ?? null,
    commercialState: row.commercial_state ?? "active",
    journeyStartedAt: row.journey_started_at ?? null,
    relationshipStartedAt: row.relationship_started_at ?? null,
    relationshipStartedBy: row.relationship_started_by ?? null,
    relationshipStartedByName: row.relationship_started_by_name ?? null,
    relationshipSource: row.relationship_source ?? null,
    archivedAt: row.archived_at ?? null,
    archivedBy: row.archived_by ?? null,
    restoredAt: row.restored_at ?? null,
    restoredBy: row.restored_by ?? null,
    isPrivate: row.is_private ?? false,
    ownershipClaimedAt: row.ownership_claimed_at ?? null,
    ownershipOrigin: row.ownership_origin ?? null,
    lastOutboundAt: row.last_outbound_at ?? null,
    lastInboundAt: row.last_inbound_at ?? null,
    conversationWindowOpenedAt: row.conversation_window_opened_at ?? null,
  };
}

/**
 * Busca a base real e espelha no armazenamento local usado por
 * `listAllInvestors()`. O servidor é a fonte de verdade do escopo.
 */
export async function pullLeads(): Promise<number> {
  const rows = (await listPortalLeads()) as unknown as RemoteLead[];
  const remote = rows.map(toLocal);
  // Substituição autoritativa: registros ausentes no servidor não podem ser
  // restaurados por outro navegador. O armazenamento local é apenas cache.
  replaceLeads(remote);
  return remote.length;
}

/**
 * BLINDAGEM DEFINITIVA — não existe mais remoção de Lead por esta
 * camada. Um Lead registrado no Portal jamais é excluído (ver
 * `src/lib/lead-guard.ts`); leads ausentes na origem recebem o estado
 * NÃO LOCALIZADO e permanecem armazenados.
 */

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
