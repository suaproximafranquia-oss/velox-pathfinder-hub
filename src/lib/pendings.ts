/**
 * Pendências inteligentes — derivadas do estado atual.
 *
 * Nunca cria tabela nova. Consome leads, reuniões e eventos para
 * apontar ao executivo o que merece atenção. Não substitui o
 * julgamento humano.
 */
import { loadLeads, type LeadRecord } from "@/lib/leads";
import { listMeetings, type Meeting } from "@/lib/meetings";
import { listEvents } from "@/lib/events/bus";

export type PendingKind =
  | "journey_interrupted"
  | "simulation_incomplete"
  | "meeting_upcoming"
  | "meeting_followup"
  | "return_pending";

export type Pending = {
  id: string;
  kind: PendingKind;
  title: string;
  description: string;
  investorId: string | null;
  investorName?: string;
  reference?: string; // ISO date / meetingId
  weight: number; // 1 mais discreto → 5 mais urgente
};

function forLead(l: LeadRecord): Pending[] {
  const out: Pending[] = [];
  const ageDays = (Date.now() - Date.parse(l.createdAt)) / 86400000;
  if (ageDays < 3) {
    out.push({
      id: `pd_return_${l.id}`,
      kind: "return_pending",
      title: "Retorno pendente",
      description: `${l.name} solicitou contato recente (${l.material}).`,
      investorId: l.id,
      investorName: l.name,
      weight: 4,
    });
  }
  return out;
}

function forMeeting(m: Meeting): Pending[] {
  const out: Pending[] = [];
  const when = Date.parse(m.scheduledAt);
  const diff = when - Date.now();
  if ((m.status === "Agendada" || m.status === "Confirmada" || m.status === "Reagendada") && diff > 0 && diff < 48 * 3600000) {
    out.push({
      id: `pd_up_${m.id}`,
      kind: "meeting_upcoming",
      title: "Reunião próxima",
      description: `${m.investorName} — ${new Date(m.scheduledAt).toLocaleString("pt-BR")}`,
      investorId: m.investorId,
      investorName: m.investorName,
      reference: m.id,
      weight: 5,
    });
  }
  if (m.status === "Concluída" && m.notes.length === 0) {
    out.push({
      id: `pd_fup_${m.id}`,
      kind: "meeting_followup",
      title: "Registro pós-reunião pendente",
      description: `${m.investorName} — reunião sem observações registradas.`,
      investorId: m.investorId,
      investorName: m.investorName,
      reference: m.id,
      weight: 3,
    });
  }
  return out;
}

function forSimulation(investorId: string | null | undefined): Pending[] {
  if (!investorId) return [];
  const started = listEvents({ types: ["simulator.started"], investorId });
  const done = listEvents({ types: ["simulator.completed"], investorId });
  if (started.length > done.length) {
    return [{
      id: `pd_sim_${investorId}`,
      kind: "simulation_incomplete",
      title: "Simulação não finalizada",
      description: "O investidor iniciou o Simulador Inteligente e não concluiu.",
      investorId,
      weight: 2,
    }];
  }
  return [];
}

function forJourney(investorId: string | null | undefined): Pending[] {
  if (!investorId) return [];
  const started = listEvents({ types: ["journey.started"], investorId });
  const done = listEvents({ types: ["manual.completed"], investorId });
  if (started.length > 0 && done.length === 0) {
    return [{
      id: `pd_jr_${investorId}`,
      kind: "journey_interrupted",
      title: "Jornada interrompida",
      description: "Manual iniciado sem conclusão registrada.",
      investorId,
      weight: 2,
    }];
  }
  return [];
}

export function derivePendings(scope?: { investorId?: string; executiveId?: string }): Pending[] {
  const leads = loadLeads().filter((l) =>
    scope?.investorId ? l.id === scope.investorId :
    scope?.executiveId ? l.responsibleExecutiveId === scope.executiveId :
    true,
  );
  const meetings = listMeetings({
    investorId: scope?.investorId,
    executiveId: scope?.executiveId,
  });

  const investorIds = new Set<string>();
  for (const l of leads) investorIds.add(l.id);
  for (const m of meetings) investorIds.add(m.investorId);

  const out: Pending[] = [];
  for (const l of leads) out.push(...forLead(l));
  for (const m of meetings) out.push(...forMeeting(m));
  for (const id of investorIds) {
    out.push(...forSimulation(id));
    out.push(...forJourney(id));
  }
  return out.sort((a, b) => b.weight - a.weight);
}

export const PENDING_KIND_LABEL: Record<PendingKind, string> = {
  journey_interrupted: "Jornada",
  simulation_incomplete: "Simulador",
  meeting_upcoming: "Reunião",
  meeting_followup: "Pós-reunião",
  return_pending: "Retorno",
};