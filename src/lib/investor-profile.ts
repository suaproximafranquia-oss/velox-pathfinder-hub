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

  const timeline: TimelineEntry[] = [
    ...allLeads.map<TimelineEntry>((l) => ({
      id: l.id,
      at: l.createdAt,
      kind: "lead",
      title: "Contato registrado",
      description: `${l.material} · ${l.origin}`,
    })),
    ...meetings.map<TimelineEntry>((m) => ({
      id: m.id,
      at: m.createdAt,
      kind: "meeting",
      title: `Reunião ${m.status.toLowerCase()}`,
      description: new Date(m.scheduledAt).toLocaleString("pt-BR"),
    })),
    ...events.map(fmt),
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