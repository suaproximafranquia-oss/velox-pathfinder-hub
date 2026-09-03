/**
 * MODO DEMONSTRAÇÃO DA AÇÃO DO DIA — dados fictícios em memória.
 *
 * ISOLAMENTO ABSOLUTO: este módulo NÃO importa nenhuma `*.functions.ts`,
 * nenhum cliente de banco e nenhum executor. Ele só conhece os tipos
 * puros da Ação do Dia e o mesmo pipeline de normalização usado pela
 * fila real. Nada aqui cria lead, card, E0, timeline, cadência ou
 * mensagem — e nenhuma requisição sai do navegador.
 *
 * FILA CONTÍNUA: executar uma ação não a apaga; ela volta para o FINAL
 * da fila. A demonstração pode ser percorrida indefinidamente sem
 * gerar um único registro. Recarregar a página reinicia o fixture.
 */
import {
  normalizeDailyActions,
  operationalDate,
  resolveBucket,
  type DailyAction,
  type DailyActionKind,
  type DailyActionSource,
} from "@/lib/crm/daily-actions";
import type { AdapterResult, DailyActionsAdapter } from "@/lib/crm/daily-actions.adapter";

export const DEMO_LABEL = "DEMONSTRAÇÃO";

/** Telefone fictício — prefixo inexistente, jamais discável. */
function demoPhone(index: number): string {
  return `+55 (00) 90000-${String(1000 + index).slice(-4)}`;
}

function shiftDate(base: Date, days: number): string {
  const next = new Date(base.getTime() + days * 24 * 3600 * 1000);
  return operationalDate(next);
}

function atTime(base: Date, hourOffsetMinutes: number): string {
  return new Date(base.getTime() + hourOffsetMinutes * 60 * 1000).toISOString();
}

type Seed = {
  name: string;
  kind: DailyActionKind;
  source: DailyActionSource;
  stepLabel: string | null;
  title: string;
  /** Deslocamento em dias: negativo = atrasada, 0 = hoje, positivo = futura. */
  dayOffset: number;
  /** Minutos a partir de agora, quando o item tem horário marcado. */
  minutesFromNow?: number;
  priorityMax?: boolean;
  callable?: boolean;
  firstContact?: boolean;
  attempts?: { step: number; date: string; outcome: "SIM" | "NAO" }[];
};

/**
 * 36 ações fictícias cobrindo os cinco `kind`, as etapas E0/E1/E2/E3 e
 * os quatro buckets (agora, atrasada, hoje, futura).
 */
const SEEDS: Seed[] = [
  // ——— Primeiro contato (E0) ———
  { name: "João Demonstração", kind: "primeiro_contato", source: "first_contact", stepLabel: "E0", title: "Primeiro contato com lead novo", dayOffset: 0, priorityMax: true, firstContact: true },
  { name: "Maria Exemplo", kind: "primeiro_contato", source: "first_contact", stepLabel: "E0", title: "Primeiro contato com lead novo", dayOffset: -1, priorityMax: true, firstContact: true },
  { name: "Carlos Teste", kind: "primeiro_contato", source: "first_contact", stepLabel: "E0", title: "Primeiro contato com lead novo", dayOffset: 0, priorityMax: true, firstContact: true },
  { name: "Fernanda Amostra", kind: "primeiro_contato", source: "first_contact", stepLabel: "E0", title: "Primeiro contato com lead novo", dayOffset: -2, priorityMax: true, firstContact: true },
  { name: "Rogério Fictício", kind: "primeiro_contato", source: "first_contact", stepLabel: "E0", title: "Primeiro contato com lead novo", dayOffset: 0, priorityMax: true, firstContact: true },

  // ——— Reuniões ———
  { name: "Ana Simulação", kind: "reuniao", source: "meeting", stepLabel: null, title: "Reunião de apresentação da franquia", dayOffset: 0, minutesFromNow: 8, priorityMax: true },
  { name: "Bruno Exemplo", kind: "reuniao", source: "meeting", stepLabel: null, title: "Reunião de alinhamento de investimento", dayOffset: 0, minutesFromNow: 95, priorityMax: true },
  { name: "Débora Modelo", kind: "reuniao", source: "meeting", stepLabel: null, title: "Reunião com o investidor", dayOffset: 0, minutesFromNow: 240, priorityMax: true },
  { name: "Otávio Demonstração", kind: "reuniao", source: "meeting", stepLabel: null, title: "Reunião de retomada", dayOffset: -1, minutesFromNow: -1500, priorityMax: true },
  { name: "Patrícia Amostra", kind: "reuniao", source: "meeting", stepLabel: null, title: "Reunião de fechamento", dayOffset: 1, minutesFromNow: 1500, priorityMax: true },

  // ——— Compromissos da Agenda ———
  { name: "Alinhamento da equipe (exemplo)", kind: "compromisso", source: "agenda", stepLabel: null, title: "Alinhamento da equipe (exemplo)", dayOffset: 0, minutesFromNow: 45, priorityMax: true },
  { name: "Treinamento interno (exemplo)", kind: "compromisso", source: "agenda", stepLabel: null, title: "Treinamento interno (exemplo)", dayOffset: 0, minutesFromNow: 300 },
  { name: "Revisão da carteira (exemplo)", kind: "compromisso", source: "agenda", stepLabel: null, title: "Revisão da carteira (exemplo)", dayOffset: -1, minutesFromNow: -1400 },
  { name: "Planejamento semanal (exemplo)", kind: "compromisso", source: "agenda", stepLabel: null, title: "Planejamento semanal (exemplo)", dayOffset: 1, minutesFromNow: 1600 },

  // ——— Mensagens da jornada (E1, E2, E3 e fechamento) ———
  { name: "Renata Fictícia", kind: "mensagem", source: "queue", stepLabel: "E1", title: "Mensagem E1 — Primeiro acompanhamento", dayOffset: 0 },
  { name: "Gustavo Exemplo", kind: "mensagem", source: "queue", stepLabel: "E1", title: "Mensagem E1 — Primeiro acompanhamento", dayOffset: -1 },
  { name: "Helena Teste", kind: "mensagem", source: "queue", stepLabel: "E2", title: "Mensagem E2 — Acompanhamento", dayOffset: 0 },
  { name: "Ricardo Amostra", kind: "mensagem", source: "queue", stepLabel: "E2", title: "Mensagem E2 — Acompanhamento", dayOffset: -3 },
  { name: "Sônia Demonstração", kind: "mensagem", source: "queue", stepLabel: "E3", title: "Mensagem E3 — Segundo acompanhamento", dayOffset: 0 },
  { name: "Vinícius Modelo", kind: "mensagem", source: "queue", stepLabel: "E3", title: "Mensagem E3 — Segundo acompanhamento", dayOffset: -2 },
  { name: "Tatiane Exemplo", kind: "mensagem", source: "queue", stepLabel: "E4", title: "Mensagem E4 — Acompanhamento mais firme", dayOffset: 0 },
  { name: "Eduardo Fictício", kind: "mensagem", source: "closure", stepLabel: "E7 — Checkpoint da Apresentação Digital", title: "Checkpoint da Apresentação Digital", dayOffset: 0 },
  { name: "Luciana Amostra", kind: "mensagem", source: "closure", stepLabel: "Finalização do ciclo", title: "Finalização do ciclo", dayOffset: -1 },
  { name: "Marcelo Teste", kind: "mensagem", source: "queue", stepLabel: "R1", title: "Mensagem R1 — Primeira tentativa após desaparecimento", dayOffset: 0 },
  { name: "Priscila Demonstração", kind: "mensagem", source: "queue", stepLabel: "V3", title: "Mensagem V3 — Visualizou e não respondeu", dayOffset: 1 },

  // ——— Ligações da cadência ———
  { name: "Alberto Exemplo", kind: "ligacao", source: "cadence", stepLabel: null, title: "Ligação", dayOffset: 0, callable: true },
  { name: "Bianca Fictícia", kind: "ligacao", source: "cadence", stepLabel: "2ª tentativa", title: "Ligação — 2ª tentativa", dayOffset: 0, callable: true, attempts: [{ step: 1, date: "", outcome: "NAO" }] },
  { name: "Cláudio Modelo", kind: "ligacao", source: "cadence", stepLabel: "3ª tentativa", title: "Ligação — 3ª tentativa", dayOffset: -1, callable: true, attempts: [{ step: 1, date: "", outcome: "NAO" }, { step: 2, date: "", outcome: "NAO" }] },
  { name: "Daniela Teste", kind: "ligacao", source: "cadence", stepLabel: null, title: "Ligação", dayOffset: 0, callable: true },
  { name: "Elias Amostra", kind: "ligacao", source: "cadence", stepLabel: "2ª tentativa", title: "Ligação — 2ª tentativa", dayOffset: -2, callable: true, attempts: [{ step: 1, date: "", outcome: "SIM" }] },
  { name: "Flávia Demonstração", kind: "ligacao", source: "cadence", stepLabel: null, title: "Ligação", dayOffset: 0, callable: true },
  { name: "Gabriel Exemplo", kind: "ligacao", source: "cadence", stepLabel: null, title: "Ligação", dayOffset: -1, callable: true },
  { name: "Isabela Fictícia", kind: "ligacao", source: "cadence", stepLabel: "4ª tentativa", title: "Ligação — 4ª tentativa", dayOffset: 0, callable: true, attempts: [{ step: 1, date: "", outcome: "NAO" }, { step: 2, date: "", outcome: "NAO" }, { step: 3, date: "", outcome: "NAO" }] },
  { name: "Júlio Modelo", kind: "ligacao", source: "cadence", stepLabel: null, title: "Ligação", dayOffset: 1, callable: true },
  { name: "Karina Teste", kind: "ligacao", source: "cadence", stepLabel: null, title: "Ligação", dayOffset: 0, callable: true },
  { name: "Leandro Amostra", kind: "ligacao", source: "cadence", stepLabel: null, title: "Ligação", dayOffset: -4, callable: true },
];

/** Monta o fixture já normalizado pelo MESMO pipeline da fila real. */
export function buildDemoDailyActions(nowIso: string = new Date().toISOString()): DailyAction[] {
  const base = new Date(nowIso);
  const actions: DailyAction[] = SEEDS.map((seed, index) => {
    const startsAt = seed.minutesFromNow === undefined ? null : atTime(base, seed.minutesFromNow);
    const dueDate = startsAt ? operationalDate(startsAt) : shiftDate(base, seed.dayOffset);
    const leadId = `demo_${String(index + 1).padStart(2, "0")}`;
    const attempts = (seed.attempts ?? []).map((attempt, i) => ({
      ...attempt,
      date: shiftDate(base, -(seed.attempts!.length - i) - 1),
    }));
    return {
      actionKey: `demo:${leadId}:${seed.kind}:${index}`,
      source: seed.source,
      kind: seed.kind,
      leadId: seed.kind === "compromisso" ? null : leadId,
      name: seed.name,
      phone: seed.kind === "compromisso" ? "" : demoPhone(index),
      scope: "demonstracao",
      stepLabel: seed.stepLabel,
      dueDate,
      startsAt,
      endsAt: startsAt ? atTime(base, (seed.minutesFromNow ?? 0) + 60) : null,
      overdue: dueDate < operationalDate(nowIso),
      priorityMax: Boolean(seed.priorityMax),
      bucket: resolveBucket({ dueDate, startsAt, nowIso }),
      title: seed.title,
      responsibleName: "Executivo de demonstração",
      attempts,
      ...(seed.firstContact ? { firstContactActionId: `demo-e0-${leadId}` } : {}),
      ...(seed.callable
        ? {
            cadence: {
              crmLeadId: `demo-crm-${leadId}`,
              step: attempts.length + 1,
              dueDate,
              cycleDate: dueDate,
            },
          }
        : {}),
    } satisfies DailyAction;
  });
  return normalizeDailyActions(actions);
}

/**
 * Adaptador de demonstração: tudo acontece em memória. Nenhuma das
 * operações abaixo alcança servidor, banco, E0, cadência, timeline ou
 * WhatsApp — elas apenas devolvem o resultado simulado, com `requeue`
 * para manter a fila contínua.
 */
export function createDemoDailyActionsAdapter(): DailyActionsAdapter {
  return {
    demoLabel: DEMO_LABEL,
    load: async () => buildDemoDailyActions(),
    executeFirstContact: async (item): Promise<AdapterResult> => ({
      ok: true,
      requeue: true,
      message: `Execução simulada: primeiro contato (E0) de ${item.name}. Nada foi enviado ou gravado.`,
    }),
    completeCall: async (item, outcome): Promise<AdapterResult> => ({
      ok: true,
      requeue: true,
      message: `Execução simulada: ligação de ${item.name} registrada como ${
        outcome === "SIM" ? "atendida" : "não atendida"
      }. Nada foi gravado.`,
    }),
    openWhatsapp: async (item): Promise<AdapterResult> => ({
      ok: true,
      message: `Execução simulada: nenhuma conversa real foi aberta com ${item.name}.`,
    }),
    openLead: () => {
      /* Demonstração não abre ficha real. */
    },
  };
}
