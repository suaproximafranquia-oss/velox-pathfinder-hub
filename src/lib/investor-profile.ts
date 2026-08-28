/**
 * Perfil Inteligente do Investidor — agregador de leitura.
 *
 * Consolida em uma única estrutura tudo que já existe sobre um
 * investidor: identidade capturada em `leads`, reuniões, eventos do
 * bus e pendências derivadas. Não persiste dados novos: apenas
 * agrega o que os módulos oficiais produzem.
 */
import { loadLeads, type LeadRecord } from "@/lib/leads";
import { listMeetings, type Meeting } from "@/lib/meetings";
import { listEvents, type PortalEvent } from "@/lib/events/bus";
import { derivePendings, type Pending } from "@/lib/pendings";

export type TimelineEntry = {
  id: string;
  at: string;
  kind: "event" | "meeting" | "lead";
  title: string;
  description?: string;
};

export type InvestorProfile = {
  id: string;
  identity: LeadRecord | null;
  leads: LeadRecord[];
  meetings: Meeting[];
  events: PortalEvent[];
  timeline: TimelineEntry[];
  pendings: Pending[];
};

function fmt(e: PortalEvent): TimelineEntry {
  const map: Record<string, string> = {
    "journey.started": "Jornada iniciada",
    "manual.started": "Manual iniciado",
    "manual.chapter.completed": "Capítulo do Manual concluído",
    "manual.completed": "Manual concluído",
    "material.viewed": "Material acessado",
    "simulator.started": "Simulação iniciada",
    "simulator.completed": "Simulação concluída",
    "meeting.created": "Reunião criada",
    "meeting.rescheduled": "Reunião reagendada",
    "meeting.completed": "Reunião concluída",
    "meeting.cancelled": "Reunião cancelada",
    "profile.updated": "Perfil atualizado",
    "profile.interests.captured": "Perfil comercial preenchido",
    "whatsapp.requested": "Solicitou atendimento via WhatsApp.",
    "lead.status.changed": "Status do Lead atualizado",
  };
  return {
    id: e.id,
    at: e.at,
    kind: "event",
    title: map[e.type] ?? e.type,
  };
}

export function buildInvestorProfile(investorId: string): InvestorProfile {
  const allLeads = loadLeads().filter((l) => l.id === investorId);
  const identity = allLeads[0] ?? null;
  const meetings = listMeetings({ investorId });
  const events = listEvents({ investorId });

  /**
   * "Contato registrado" é a ENTRADA REAL do lead — um acontecimento por
   * entrada, não uma linha por espelho de cache. Duplicidade local
   * (mesmo lead repetido na estrutura de leitura) não pode virar vários
   * contatos históricos. A identidade oficial do lead é preservada:
   * nada é criado, renomeado ou mesclado — apenas não repetimos a mesma
   * entrada na linha do tempo.
   */
  const seenEntries = new Set<string>();
  const leadEntries: TimelineEntry[] = [];
  for (const l of allLeads) {
    const key = `${l.id}|${l.createdAt}`;
    if (seenEntries.has(key)) continue;
    seenEntries.add(key);
    leadEntries.push({
      id: `lead_${key}`,
      at: l.createdAt,
      kind: "lead",
      title: "Contato registrado",
      description: `${l.material} · ${l.origin}`,
    });
  }

  /**
   * HISTÓRICO = ACONTECIMENTOS, NÃO REGRAVAÇÕES DE ESTADO.
   *
   * Emissões antigas (anteriores à guarda de mudança real) deixaram no
   * barramento local várias linhas "Status do Lead atualizado" para o
   * mesmo estado. Elas não representam mudança: colapsamos repetições
   * consecutivas do mesmo destino de estado, preservando a primeira
   * ocorrência real. Nenhum evento de acontecimento distinto é removido.
   */
  const statusEvents = events
    .filter((e) => e.type === "lead.status.changed")
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  const redundantStatusIds = new Set<string>();
  let previousTarget: string | null = null;
  for (const event of statusEvents) {
    const target = String((event.payload as { to?: string } | undefined)?.to ?? "");
    if (target && target === previousTarget) redundantStatusIds.add(event.id);
    else previousTarget = target || previousTarget;
  }

  const timeline: TimelineEntry[] = [
    ...leadEntries,
    ...meetings.map<TimelineEntry>((m) => ({
      id: m.id,
      at: m.createdAt,
      kind: "meeting",
      title: `Reunião ${m.status.toLowerCase()}`,
      description: new Date(m.scheduledAt).toLocaleString("pt-BR"),
    })),
    ...events.filter((e) => !redundantStatusIds.has(e.id)).map(fmt),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));


  return {
    id: investorId,
    identity,
    leads: allLeads,
    meetings,
    events,
    timeline,
    pendings: derivePendings({ investorId }),
  };
}