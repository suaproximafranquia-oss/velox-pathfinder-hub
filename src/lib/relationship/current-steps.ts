/**
 * FOTOGRAFIA ATUAL DAS ETAPAS (temporária e explícita).
 *
 * Esta lista é a transcrição literal dos códigos de etapa que HOJE
 * aparecem na Biblioteca de Conteúdos / Homologação. Ela existe para
 * que o sistema deixe de depender de uma nova importação do documento
 * Word para saber "quais etapas existem agora".
 *
 * REGRAS DESTA FOTOGRAFIA:
 *  • é uma FOTO, não uma sequência: a ordem abaixo é a ordem de
 *    exibição, nunca uma regra de transição;
 *  • nenhuma etapa é inferida, completada ou inventada — o que não
 *    aparece na foto simplesmente não está aqui;
 *  • ela NÃO substitui e NÃO altera o motor: `STEPS`/`FLOW_SEQUENCE`
 *    em `config.ts` continuam sendo a única fonte executável;
 *  • o Word permanece armazenado como DOCUMENTAÇÃO HISTÓRICA
 *    (`word-library.ts`) e não é mais consultado para responder
 *    "quais etapas existem hoje".
 *
 * Conflitos conhecidos com a nomenclatura técnica do motor (E2, E5,
 * E6, E7, E8, R4) estão registrados abaixo e são preservados: nada é
 * renomeado, migrado ou apagado nesta fase.
 */

/** Fluxo E — jornada principal, conforme a fotografia atual. */
export const CURRENT_FLOW_E = ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"] as const;

/** Fluxo R — reengajamento, conforme a fotografia atual. */
export const CURRENT_FLOW_R = ["R1", "R2", "R3", "R4"] as const;

/** Fluxo RE — reentrada, conforme a fotografia atual. */
export const CURRENT_FLOW_RE = ["RE0", "RE1", "RE2", "RE3"] as const;

/** Fluxo RF — relacionamento esfriado, conforme a fotografia atual. */
export const CURRENT_FLOW_RF = ["RF0", "RF1"] as const;

export const CURRENT_STEP_SNAPSHOT: readonly string[] = [
  ...CURRENT_FLOW_E,
  ...CURRENT_FLOW_R,
  ...CURRENT_FLOW_RE,
  ...CURRENT_FLOW_RF,
];

export type CurrentStepFlow = "E" | "R" | "RE" | "RF";

export const CURRENT_STEP_FLOWS: Record<CurrentStepFlow, readonly string[]> = {
  E: CURRENT_FLOW_E,
  R: CURRENT_FLOW_R,
  RE: CURRENT_FLOW_RE,
  RF: CURRENT_FLOW_RF,
};

export const CURRENT_STEP_FLOW_LABELS: Record<CurrentStepFlow, string> = {
  E: "Fluxo E",
  R: "Fluxo R",
  RE: "Fluxo RE",
  RF: "Fluxo RF",
};

/** A etapa pertence à fotografia atual? Leitura pura, sem efeito no motor. */
export function isCurrentSnapshotStep(step: string | null | undefined): boolean {
  if (!step) return false;
  return CURRENT_STEP_SNAPSHOT.includes(step.trim().toUpperCase());
}

/**
 * CONSOLIDAÇÃO: E0–E8, R1–R4 e RE0–RE3 são etapas executáveis da régua
 * V2 (`cadence-v2`). Não há mais código da fotografia sem etapa no
 * motor — a lista permanece exportada, vazia, por compatibilidade.
 */
export const SNAPSHOT_STEPS_WITHOUT_ENGINE_STEP: readonly string[] = [];

/**
 * CHAVES HISTÓRICAS: existem em registros antigos (envios, filas,
 * snapshots, Biblioteca) e continuam legíveis para auditoria. Não são
 * identidade de nenhuma etapa atual e não recebem conteúdo novo.
 * RF0/RF1 permanecem na fotografia como fluxo futuro, sem execução hoje.
 */
export const ENGINE_STEPS_OUTSIDE_SNAPSHOT: readonly string[] = [
  "E0_V1",
  "E12",
  "E20",
  "E27",
  "E30",
  "V3",
  "V4",
  "FINALIZACAO",
  "RESPOSTA_AUTOMATICA",
];
