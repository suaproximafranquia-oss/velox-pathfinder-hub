/**
 * JORNADA CONSOLIDADA DO LEAD (SERVER ONLY) — BLOCO 2.
 *
 * Uma ÚNICA leitura cronológica de tudo que aconteceu com a pessoa,
 * independentemente do ambiente em que a ação ocorreu (Portal,
 * Workspace, Cadência, Remarketing). Esta camada é somente LEITURA:
 * nenhuma trilha existente é migrada, apagada ou duplicada — os eventos
 * continuam nascendo onde já nasciam e aqui apenas se encontram.
 *
 * O texto das mensagens vem SEMPRE do snapshot congelado no envio
 * (`relationship_message_sends`); a Biblioteca nunca é consultada para
 * reconstruir histórico.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type JourneyEntryKind =
  | "entrada"
  | "sincronizacao"
  | "coluna"
  | "mensagem_enviada"
  | "mensagem_recebida"
  | "cadencia"
  | "e20"
  | "acesso_link"
  | "ligacao"
  | "reuniao"
  | "nota"
  | "portal"
  | "remarketing"
  | "oportunidade"
  | "evento";

/**
 * CAMADA DA ENTRADA.
 *
 * `relacional` = a Jornada do Investidor propriamente dita: o que interessa
 * ao executivo. `tecnico` = auditoria interna (sincronização, distribuição,
 * definição de responsável, duplicidade, simulações). Nada é apagado: a
 * camada técnica continua legível na aba de auditoria.
 */
export type JourneyLayer = "relacional" | "tecnico";

export type JourneyEntry = {
  id: string;
  at: string;
  kind: JourneyEntryKind;
  title: string;
  /** Linha curta de apoio (campanha, motivo, resultado…). */
  subtitle?: string | null;
  /** Conteúdo longo — expansível. É sempre o snapshot congelado. */
  body?: string | null;
  origin: string;
  actor?: string | null;
  /** Etapa/versão da Biblioteca usada no envio, quando aplicável. */
  step?: string | null;
  version?: number | null;
  simulated?: boolean;
  layer: JourneyLayer;
};

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

const TIMELINE_TITLES: Record<string, string> = {
  lead_criado: "Lead criado",
  sincronizacao: "Sincronização",
  sincronizacao_tardia: "Sincronização tardia",
  sincronizacao_iniciada: "Sincronização iniciada",
  distribuicao_realizada: "Distribuição realizada",
  relacionamento_oficial: "Relacionamento oficial definido",
  relacionamento_iniciado: "Relacionamento iniciado",
  contato_recebido: "Contato recebido",
  atividade_portal: "Atividade no Portal",
  primeiro_contato: "Primeiro contato",
  nota_executivo: "Nota do executivo",
  mudanca_coluna: "Mudança de coluna",
  oportunidade: "OPORTUNIDADE",
};

/**
 * WHITELIST RELACIONAL — só estes eventos da `crm_timeline` contam como
 * jornada. Todo o resto é auditoria técnica por padrão: nada de
 * sincronização, distribuição, duplicidade, conversa aberta ou definição
 * interna de responsável aparece para o executivo.
 */
const RELATIONAL_TIMELINE_EVENTS = new Set([
  "lead_criado",
  "contato_recebido",
  "atividade_portal",
  "nota_executivo",
  "mudanca_coluna",
  "oportunidade",
  "primeiro_contato",
]);

function timelineLayer(event: string): JourneyLayer {
  if (event.startsWith("cadencia_")) return "relacional";
  return RELATIONAL_TIMELINE_EVENTS.has(event) ? "relacional" : "tecnico";
}

function timelineKind(event: string): JourneyEntryKind {
  if (event === "nota_executivo") return "nota";
  if (event === "mudanca_coluna") return "coluna";
  if (event === "oportunidade") return "oportunidade";
  if (event.startsWith("sincroniza")) return "sincronizacao";
  if (event.startsWith("cadencia_")) return "cadencia";
  if (event === "atividade_portal") return "portal";
  if (event === "lead_criado") return "entrada";
  return "evento";
}

/**
 * Simulação registrada em `crm_messages`: a tabela não tem coluna própria,
 * então o rótulo gravado no envio é a única marca disponível.
 */
function isSimulatedMessage(row: { body?: string | null; author_name?: string | null }): boolean {
  const marker = E0_SIMULATION_LABEL;
  return (
    String(row.body ?? "").includes(marker) || String(row.author_name ?? "").includes(marker)
  );
}


/** Jornada completa do lead, em ordem cronológica crescente. */
export async function loadLeadJourney(leadId: string): Promise<JourneyEntry[]> {
  const { data: lead } = await supabaseAdmin
    .from("portal_leads")
    .select("id,name,origin,external_source,created_at,external_created_at")
    .eq("id", leadId)
    .maybeSingle();

  const phone = await (async () => {
    const { data } = await supabaseAdmin
      .from("portal_leads")
      .select("external_payload")
      .eq("id", leadId)
      .maybeSingle();
    const payload = (data?.external_payload ?? {}) as Record<string, any>;
    return digitsOnly(payload["telefone"] ?? payload["phone"] ?? payload["whatsapp"] ?? "");
  })();

  const [timeline, messages, snapshots, occurrences, accesses, calls, meetings, portalEvents] =
    await Promise.all([
      supabaseAdmin.from("crm_timeline").select("*").eq("investor_id", leadId),
      supabaseAdmin.from("crm_messages").select("*").eq("investor_id", leadId),
      supabaseAdmin.from("relationship_message_sends").select("*").eq("lead_id", leadId),
      supabaseAdmin.from("relationship_e20_occurrences").select("*").eq("lead_id", leadId),
      supabaseAdmin.from("relationship_e20_accesses").select("*").eq("lead_id", leadId),
      supabaseAdmin.from("crm_cadence_tasks").select("*").eq("lead_id", leadId),
      supabaseAdmin.from("portal_meetings").select("*").eq("investor_id", leadId),
      supabaseAdmin.from("portal_journey_events").select("*").eq("investor_id", leadId),
    ]);

  const entries: JourneyEntry[] = [];

  if (lead) {
    entries.push({
      id: `entrada_${lead.id}`,
      at: (lead as any).external_created_at ?? lead.created_at,
      kind: "entrada",
      title: "Entrada do lead",
      subtitle: `Origem: ${(lead as any).origin ?? (lead as any).external_source ?? "não informada"}`,
      origin: "portal_leads",
    });
  }

  // Mensagens com snapshot: o corpo exibido é o texto congelado.
  const snapshotByMessageId = new Map<string, any>();
  for (const row of (snapshots.data ?? []) as any[]) {
    if (row.message_id) snapshotByMessageId.set(row.message_id, row);
    entries.push({
      id: `snap_${row.id}`,
      at: row.sent_at,
      kind: "mensagem_enviada",
      title: `${row.step} enviada`,
      subtitle:
        row.library_version != null
          ? `Biblioteca ${row.step} — versão ${row.library_version}${row.simulated ? " · simulada" : ""}`
          : row.simulated
            ? "Simulada"
            : null,
      body: row.rendered_body,
      origin: row.origin ?? "motor",
      actor: row.actor_name ?? "Motor de Relacionamento",
      step: row.step,
      version: row.library_version ?? null,
      simulated: Boolean(row.simulated),
    });
  }

  for (const row of (messages.data ?? []) as any[]) {
    // Já existe snapshot para esta mensagem — não duplicar na jornada.
    if (snapshotByMessageId.has(row.id)) continue;
    const received = row.direction !== "enviada";
    entries.push({
      id: `msg_${row.id}`,
      at: row.at,
      kind: received ? "mensagem_recebida" : "mensagem_enviada",
      title: received ? "Mensagem recebida" : "Mensagem enviada",
      body: row.body,
      origin: "crm",
      actor: row.author_name ?? row.author_id ?? null,
    });
  }

  for (const row of (timeline.data ?? []) as any[]) {
    const event = String(row.event ?? "");
    entries.push({
      id: `tl_${row.id}`,
      at: row.at,
      kind: timelineKind(event),
      title: TIMELINE_TITLES[event] ?? event.replaceAll("_", " "),
      subtitle: row.reason ?? null,
      ...(event === "nota_executivo" ? { body: row.reason ?? null } : {}),
      origin: row.origin ?? "sistema",
      actor: row.actor_id ?? null,
    });
  }

  for (const row of (occurrences.data ?? []) as any[]) {
    entries.push({
      id: `e20_${row.id}`,
      at: row.generated_at,
      kind: "e20",
      title: "E20 — convite gerado",
      subtitle: `Link individual válido até ${row.expires_at?.slice(0, 10) ?? "—"}`,
      body: row.link_url,
      origin: "motor",
      actor: row.generated_by_name ?? null,
      step: "E20",
    });
    if (row.closed_at) {
      entries.push({
        id: `e20c_${row.id}`,
        at: row.closed_at,
        kind: "e20",
        title: "E20 — ocorrência encerrada",
        subtitle: row.close_reason ?? null,
        origin: "motor",
      });
    }
  }

  for (const row of (accesses.data ?? []) as any[]) {
    entries.push({
      id: `acc_${row.id}`,
      at: row.accessed_at,
      kind: "acesso_link",
      title: "Acesso ao link do convite",
      subtitle: row.outcome ?? null,
      origin: "portal",
    });
  }

  for (const row of (calls.data ?? []) as any[]) {
    if (!row.completed_at) continue;
    entries.push({
      id: `call_${row.id}`,
      at: row.completed_at,
      kind: "ligacao",
      title: "Ligação efetuada",
      subtitle: row.outcome ?? null,
      ...(row.note ? { body: row.note } : {}),
      origin: "cadencia",
      actor: row.completed_by ?? null,
    });
  }

  for (const row of (meetings.data ?? []) as any[]) {
    entries.push({
      id: `meet_${row.id}`,
      at: row.scheduled_at ?? row.created_at,
      kind: "reuniao",
      title: row.status === "cancelada" ? "Reunião cancelada" : "Reunião agendada",
      subtitle: row.topic ?? row.executive_name ?? null,
      origin: row.origin ?? "reunioes",
      actor: row.executive_name ?? null,
    });
  }

  for (const row of (portalEvents.data ?? []) as any[]) {
    entries.push({
      id: `pj_${row.id}`,
      at: row.created_at,
      kind: "portal",
      title: "Atividade no Portal",
      subtitle: [row.module, row.detail, row.percent != null ? `${row.percent}%` : null]
        .filter(Boolean)
        .join(" · "),
      origin: "portal",
    });
  }

  /**
   * REMARKETING — ambiente separado, história única.
   * O vínculo é feito pelo telefone normalizado; o conteúdo exibido é o
   * corpo já gravado no envio (congelado), nunca a campanha atual.
   */
  if (phone) {
    const { data: conversations } = await supabaseAdmin
      .from("remarketing_conversations")
      .select("id,phone,campaign_name");
    const mine = (conversations ?? []).filter(
      (c: any) => digitsOnly(c.phone).slice(-11) === phone.slice(-11),
    );
    if (mine.length > 0) {
      const { data: rmsgs } = await supabaseAdmin
        .from("remarketing_messages")
        .select("*")
        .in(
          "conversation_id",
          mine.map((c: any) => c.id),
        );
      const campaignOf = new Map(mine.map((c: any) => [c.id, c.campaign_name]));
      for (const row of (rmsgs ?? []) as any[]) {
        entries.push({
          id: `rm_${row.id}`,
          at: row.occurred_at ?? row.created_at,
          kind: "remarketing",
          title: row.direction === "recebida" ? "Remarketing — resposta" : "Remarketing",
          subtitle: `Campanha: ${campaignOf.get(row.conversation_id) ?? "não informada"}${
            row.campaign_version ? ` · versão ${row.campaign_version}` : ""
          }`,
          body: row.body,
          origin: "remarketing",
          actor: row.author_name ?? null,
          simulated: Boolean(row.simulated),
        });
      }
    }
  }

  return entries
    .filter((e) => Boolean(e.at))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Nota manual do executivo — participa da jornada consolidada. */
export async function addLeadNote(params: {
  leadId: string;
  note: string;
  actorId: string;
  actorName: string;
}): Promise<JourneyEntry> {
  const text = params.note.trim();
  if (!text) throw new Error("Nota vazia.");
  const at = new Date().toISOString();
  const id = `tl_nota_${params.leadId}_${Date.now()}`;
  const { error } = await supabaseAdmin.from("crm_timeline").insert({
    id,
    investor_id: params.leadId,
    event: "nota_executivo",
    origin: "workspace",
    reason: text,
    owner_id: null,
    actor_id: params.actorName || params.actorId,
    at,
  } as any);
  if (error) throw new Error(error.message);
  return {
    id: `tl_${id}`,
    at,
    kind: "nota",
    title: "Nota do executivo",
    subtitle: text,
    body: text,
    origin: "workspace",
    actor: params.actorName,
  };
}
