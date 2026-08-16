/**
 * CONFIGURAÇÃO CENTRAL DO MOTOR (COMANDO 2A §86, §105).
 *
 * Nenhuma constante de cadência pode ser declarada fora deste arquivo.
 * Se uma regra precisar mudar, muda aqui — não em componentes.
 */
import type { CadenceFlow, CadenceStep } from "./types";

export type StepDefinition = {
  step: CadenceStep;
  flow: CadenceFlow;
  /** Dias úteis a partir do evento de referência do fluxo. */
  businessDaysAfterReference: number;
  /** Finalidade do template oficial usado quando a janela está fechada. */
  templatePurpose: string;
  /** Grupo de conteúdo de valor autorizado nesta etapa (null = sem conteúdo). */
  contentGroup: string | null;
  /** Última etapa do fluxo: ao executar, a cadência encerra. */
  terminal: boolean;
};

/**
 * FLUXO 1 — lead que nunca responde: E0 → E1 → E3 → E4 → E12.
 * FLUXO 2 — visualizou duas vezes sem responder: E0 → E1 → V3 → V4 (fim).
 * FLUXO 3 — respondeu e sumiu: R1 → R2 → R3, sempre 2 dias úteis após a
 * última interação válida.
 *
 * Os textos oficiais NÃO existem aqui: o motor conhece apenas a
 * finalidade e busca o template oficial associado na Central de Templates.
 */
export const STEPS: Record<CadenceStep, StepDefinition> = {
  E0: {
    step: "E0",
    flow: "sem_resposta",
    businessDaysAfterReference: 0,
    templatePurpose: "primeiro_contato",
    contentGroup: null,
    terminal: false,
  },
  E1: {
    step: "E1",
    flow: "sem_resposta",
    businessDaysAfterReference: 1,
    templatePurpose: "segundo_contato",
    contentGroup: "acompanhamento",
    terminal: false,
  },
  E3: {
    step: "E3",
    flow: "sem_resposta",
    businessDaysAfterReference: 2,
    templatePurpose: "terceiro_contato",
    contentGroup: "prova",
    terminal: false,
  },
  E4: {
    step: "E4",
    flow: "sem_resposta",
    businessDaysAfterReference: 3,
    templatePurpose: "quarto_contato",
    contentGroup: "definicao",
    terminal: false,
  },
  E12: {
    step: "E12",
    flow: "sem_resposta",
    businessDaysAfterReference: 5,
    templatePurpose: "encerramento",
    contentGroup: null,
    terminal: true,
  },
  V3: {
    step: "V3",
    flow: "visualizacao",
    businessDaysAfterReference: 2,
    templatePurpose: "visualizacao_sem_resposta",
    contentGroup: "prova",
    terminal: false,
  },
  V4: {
    step: "V4",
    flow: "visualizacao",
    businessDaysAfterReference: 3,
    templatePurpose: "visualizacao_firme",
    contentGroup: "definicao",
    terminal: true,
  },
  R1: {
    step: "R1",
    flow: "reengajamento",
    businessDaysAfterReference: 2,
    templatePurpose: "reengajamento_1",
    contentGroup: "reengajamento",
    terminal: false,
  },
  R2: {
    step: "R2",
    flow: "reengajamento",
    businessDaysAfterReference: 2,
    templatePurpose: "reengajamento_2",
    contentGroup: "reengajamento",
    terminal: false,
  },
  R3: {
    step: "R3",
    flow: "reengajamento",
    businessDaysAfterReference: 2,
    templatePurpose: "reengajamento_encerramento",
    contentGroup: null,
    terminal: true,
  },
};

/** Sequência oficial de cada fluxo. Ordem é validada antes do disparo. */
export const FLOW_SEQUENCE: Record<CadenceFlow, CadenceStep[]> = {
  sem_resposta: ["E0", "E1", "E3", "E4", "E12"],
  visualizacao: ["E0", "E1", "V3", "V4"],
  reengajamento: ["R1", "R2", "R3"],
};

export type RelationshipConfig = {
  /** Motor desligado: nenhuma nova execução é criada; a fila é preservada. */
  enabled: boolean;
  /** Janela de conversação livre, em horas. */
  windowHours: number;
  /** Horário operacional (hora local da operação). */
  businessHours: { start: number; end: number };
  timeZone: string;
  /** Feriados YYYY-MM-DD tratados como dias não úteis. */
  nonBusinessDays: string[];
  /** Visualizações sem resposta que trocam o lead para o fluxo 2. */
  readsToSwitchFlow: number;
  /** Espera, em dias úteis, entre tentativas do fluxo de reengajamento. */
  reengagementBusinessDays: number;
  /** Tentativas de reenvio de uma etapa que falhou tecnicamente. */
  maxAttempts: number;
  /** Envios manuais e automáticos exigem template oficial associado. */
  requireOfficialTemplate: boolean;
};

export const RELATIONSHIP_CONFIG: RelationshipConfig = {
  /**
   * Nasce DESLIGADO. Enquanto estiver desligado o motor calcula,
   * registra e explica decisões, mas não executa nenhum disparo — e a
   * automação legada de boas-vindas segue respondendo pelo primeiro
   * contato. Ligar o motor desliga automaticamente a legada (§109).
   */
  enabled: false,
  windowHours: 24,
  businessHours: { start: 9, end: 20 },
  timeZone: "America/Sao_Paulo",
  nonBusinessDays: [],
  readsToSwitchFlow: 2,
  reengagementBusinessDays: 2,
  maxAttempts: 3,
  requireOfficialTemplate: true,
};

/** Fonte única de verdade sobre quem responde pelo primeiro contato. */
export function engineOwnsFirstContact(config = RELATIONSHIP_CONFIG): boolean {
  return config.enabled;
}

/** Finalidades de template usadas pelo motor — sem textos, só vínculo. */
export const ENGINE_TEMPLATE_PURPOSES = Array.from(
  new Set(Object.values(STEPS).map((s) => s.templatePurpose)),
);

/** Aberturas/reaberturas operacionais disponíveis ao motor e ao Executivo. */
export const OPENING_TEMPLATE_PURPOSES = [
  "abertura_conversa_1",
  "abertura_conversa_2",
  "abertura_conversa_3",
] as const;