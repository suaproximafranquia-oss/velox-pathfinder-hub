/**
 * CONFIGURAÇÃO CENTRAL DO MOTOR (COMANDO 2A §86, §105).
 *
 * Nenhuma constante de cadência pode ser declarada fora deste arquivo.
 * Se uma regra precisar mudar, muda aqui — não em componentes.
 */
import { defaultNonBusinessDays } from "./holidays";
import { E30_BUSINESS_DAYS_AFTER_START, E30_ENABLED } from "./reactivation";
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
 * FLUXO 1 — lead que nunca responde: E0 → E1 → E3 → E4 → E12 → E30
 * (E30 integrada pelo COMANDO 4A §8; ativação controlada por E30_ENABLED).
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
  /**
   * COMANDO 4F-B §E0 V1 — variante de primeiro contato para quem entrou
   * pelo Portal do Investidor. Mesma posição do fluxo; muda apenas o
   * texto, que reconhece a jornada já iniciada.
   */
  E0_V1: {
    step: "E0_V1",
    flow: "sem_resposta",
    businessDaysAfterReference: 0,
    templatePurpose: "primeiro_contato_portal",
    contentGroup: null,
    terminal: false,
  },
  E1: {
    step: "E1",
    flow: "sem_resposta",
    businessDaysAfterReference: 1,
    templatePurpose: "segundo_contato",
    contentGroup: "E1",
    terminal: false,
  },
  E3: {
    step: "E3",
    flow: "sem_resposta",
    businessDaysAfterReference: 2,
    templatePurpose: "terceiro_contato",
    contentGroup: "E3",
    terminal: false,
  },
  E4: {
    step: "E4",
    flow: "sem_resposta",
    businessDaysAfterReference: 3,
    templatePurpose: "quarto_contato",
    // §14 — E4 é uma mensagem objetiva, sem conteúdo anexado.
    contentGroup: null,
    terminal: false,
  },
  E12: {
    step: "E12",
    flow: "sem_resposta",
    businessDaysAfterReference: 5,
    templatePurpose: "encerramento",
    contentGroup: "FINALIZACAO",
    // Enquanto a E30 estiver desativada a E12 encerra o fluxo; com a E30
    // ativa, o fluxo continua até o recontato tardio.
    terminal: !E30_ENABLED,
  },
  /**
   * COMANDO 4A §8 — E30 integrada ao fluxo existente (nunca uma cadência
   * independente). A regra de negócio já definida vive em
   * `reactivation.ts`: 22 dias úteis contados a partir do INÍCIO DA
   * JORNADA, nunca para leads históricos. Permanece travada por
   * `E30_ENABLED` até existir texto oficial aprovado — enquanto
   * desativada, a guarda de ordem do fluxo a mantém fora da fila e a E12
   * segue como encerramento.
   */
  E30: {
    step: "E30",
    flow: "sem_resposta",
    businessDaysAfterReference: E30_BUSINESS_DAYS_AFTER_START,
    templatePurpose: "recontato_e30",
    contentGroup: null,
    terminal: true,
  },
  V3: {
    step: "V3",
    flow: "visualizacao",
    businessDaysAfterReference: 2,
    templatePurpose: "visualizacao_sem_resposta",
    // §18 — não anexa conteúdo automaticamente.
    contentGroup: null,
    terminal: false,
  },
  V4: {
    step: "V4",
    flow: "visualizacao",
    businessDaysAfterReference: 3,
    templatePurpose: "visualizacao_firme",
    contentGroup: null,
    terminal: true,
  },
  R1: {
    step: "R1",
    flow: "reengajamento",
    businessDaysAfterReference: 2,
    templatePurpose: "reengajamento_1",
    contentGroup: "R1",
    terminal: false,
  },
  R2: {
    step: "R2",
    flow: "reengajamento",
    businessDaysAfterReference: 2,
    templatePurpose: "reengajamento_2",
    contentGroup: "R2",
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
  /**
   * FLUXO 4 — REENTRADA (COMANDO 2B §2, §7).
   *
   * Um lead já conhecido que se cadastra novamente NÃO recomeça o fluxo
   * de primeiro contato: ele entra em uma sequência própria, mais curta
   * e mais direta, que reconhece o histórico anterior. Os intervalos são
   * configuráveis — mudam aqui, nunca em componentes.
   */
  RE0: {
    step: "RE0",
    flow: "reentrada",
    businessDaysAfterReference: 0,
    templatePurpose: "reentrada_contato",
    contentGroup: null,
    terminal: false,
  },
  RE1: {
    step: "RE1",
    flow: "reentrada",
    businessDaysAfterReference: 2,
    templatePurpose: "reentrada_criterios",
    contentGroup: "RE1",
    terminal: false,
  },
  RE2: {
    step: "RE2",
    flow: "reentrada",
    businessDaysAfterReference: 3,
    templatePurpose: "reentrada_estrutura",
    contentGroup: "RE2",
    terminal: false,
  },
  RE3: {
    step: "RE3",
    flow: "reentrada",
    businessDaysAfterReference: 5,
    templatePurpose: "reentrada_encerramento",
    contentGroup: "FINALIZACAO",
    terminal: true,
  },
  /**
   * FLUXO 5 — RELACIONAMENTO ESFRIADO (COMANDO 3D §18–§20).
   *
   * Lead que JÁ teve conversa real (agendamento, vídeo ou apresentação)
   * e voltou para FRIO. Nunca retorna a E0/E1: entra em RF0 no próximo
   * dia útil (nunca no mesmo dia) e encerra em RF1 após 3 dias úteis.
   */
  RF0: {
    step: "RF0",
    flow: "relacionamento_frio",
    businessDaysAfterReference: 1,
    templatePurpose: "relacionamento_frio_retomada",
    contentGroup: null,
    terminal: false,
  },
  RF1: {
    step: "RF1",
    flow: "relacionamento_frio",
    businessDaysAfterReference: 3,
    templatePurpose: "relacionamento_frio_encerramento",
    contentGroup: "FINALIZACAO",
    terminal: true,
  },
};

/** Sequência oficial de cada fluxo. Ordem é validada antes do disparo. */
export const FLOW_SEQUENCE: Record<CadenceFlow, CadenceStep[]> = {
  // COMANDO 4A §8/§18 — E30 é a etapa posterior de recontato do MESMO
  // fluxo (nunca uma cadência independente). A guarda de ordem garante
  // que ela só é considerada depois da E12.
  sem_resposta: ["E0", "E1", "E3", "E4", "E12", "E30"],
  visualizacao: ["E0", "E1", "V3", "V4"],
  reengajamento: ["R1", "R2", "R3"],
  reentrada: ["RE0", "RE1", "RE2", "RE3"],
  relacionamento_frio: ["RF0", "RF1"],
};

export type RelationshipConfig = {
  /** Motor desligado: nenhuma nova execução é criada; a fila é preservada. */
  enabled: boolean;
  /** Janela de conversação livre, em horas. */
  windowHours: number;
  /**
   * JANELA OPERACIONAL DE ENVIO (hora local da operação), de segunda a
   * sexta. Aceita fração de hora: 22.5 = 22:30. É a ÚNICA definição de
   * horário permitido — nenhuma etapa (E0, E1, E3…) tem regra própria.
   */
  businessHours: { start: number; end: number };
  /**
   * Janela de ENVIO no sábado (COMANDO 3D §8 e ajuste do §11).
   * `null` desliga o sábado. Domingo nunca envia.
   */
  saturdayHours: { start: number; end: number } | null;
  /**
   * EXCEÇÃO EXPLÍCITA E CENTRALIZADA DA E0/A0.
   *
   * O primeiro contato responde a um lead que ACABOU de se cadastrar:
   * ele vale TODOS os dias da semana (inclusive sábado e domingo),
   * limitado apenas à faixa horária abaixo. Nenhuma outra etapa
   * (E1, E3, E4, E12, V, R, RE, RF) usa esta janela — elas continuam
   * submetidas a `businessHours`/`saturdayHours` e a dias úteis.
   */
  e0Hours: { start: number; end: number };
  /** Fechamento operacional do dia (hora local) — §3. */
  dailyClosingHour: number;
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
   * ATIVAÇÃO CONTROLADA.
   *
   * O motor está LIGADO: ele decide, agenda, executa e registra as
   * etapas existentes. A saída externa continua governada pela chave de
   * simulação end-to-end (`E0_SIMULATION_ENABLED`) e pelo canal oficial
   * — ligar o motor NÃO significa disparar para a Meta. Ligar o motor
   * também cala a automação legada de boas-vindas (§109): nunca dois
   * motores respondendo pelo primeiro contato.
   */
  enabled: true,
  windowHours: 24,
  /**
   * JANELA DAS ETAPAS E1+ (decisão fechada no Refino Final): o motor
   * só envia entre 09:00 e 21:00, horário de Brasília. Fora dela a
   * etapa não é perdida nem cancelada — apenas reagendada para a
   * próxima abertura.
   */
  businessHours: { start: 9, end: 21 },
  /**
   * Sábado continua encerrando ao meio-dia (§16); a abertura acompanha
   * a janela do motor, que não abre antes das 09:00.
   */
  saturdayHours: { start: 9, end: 12 },
  /**
   * E0/A0 mantém JANELA PRÓPRIA: Seg–Sex 07:00 → 22:30 e Sáb 07:00 →
   * 12:00. Domingo SEM envio. A consciência de dia da semana é
   * aplicada em `src/lib/crm/e0-window.ts` — este campo registra a
   * faixa horária dos dias em que a E0 opera.
   */
  e0Hours: { start: 7, end: 22.5 },
  /** Fechamento operacional do dia: 22:00. */
  dailyClosingHour: 22,

  timeZone: "America/Sao_Paulo",
  /**
   * FERIADOS: nacionais + estaduais de São Paulo. Dia de feriado não
   * envia e não conta como dia útil em nenhum prazo.
   */
  nonBusinessDays: defaultNonBusinessDays(),

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