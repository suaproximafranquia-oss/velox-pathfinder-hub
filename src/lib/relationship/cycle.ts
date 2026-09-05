/**
 * CICLO HISTÓRICO x CICLO OPERACIONAL (BLOCO 1).
 *
 * Um ciclo (instância de cadência) nasce em um momento. A partir do
 * MARCO OPERACIONAL da Financeira (`crm_automation_settings
 * .cadence_activation_date`), todo ciclo novo nasce carimbado com
 * `operationalSince`. Ciclos anteriores ao marco NÃO foram reescritos:
 * eles permanecem sem carimbo e são classificados por compatibilidade.
 *
 * Esta é a ÚNICA autoridade sobre a pergunta "este ciclo é dívida
 * operacional atual ou é história?". Nenhum outro arquivo deve comparar
 * datas com o marco por conta própria.
 *
 * Regra:
 *   • ciclo COM carimbo  ⇒ nasceu na nova operação ⇒ OPERACIONAL;
 *   • ciclo SEM carimbo  ⇒ legado: só é operacional se a data de início
 *     conhecida for igual/posterior ao marco (compatibilidade);
 *   • sem marco configurado ⇒ nada é considerado operacional (na dúvida,
 *     jamais criar obrigação nova).
 *
 * Mudar o marco no futuro não transforma um ciclo carimbado em história:
 * o carimbo é do ciclo, não da configuração.
 */

/** Data do marco (YYYY-MM-DD) ou nulo quando ainda não definido. */
export type ActivationMark = string | null | undefined;

export type CycleStamp = {
  /** Nascimento operacional do ciclo (ISO) — nulo em ciclos legados. */
  operationalSince?: string | null;
  /** Início da cadência, usado apenas na compatibilidade de legado. */
  startedAt?: string | null;
  /** Última atualização — último recurso para ciclos sem início. */
  updatedAt?: string | null;
};

/** Carimbo de um ciclo que está nascendo agora. */
export function newCycleOperationalSince(nowIso: string): string {
  return nowIso;
}

/** Compara um instante ISO com o marco (data comercial YYYY-MM-DD). */
function isAtOrAfterMark(iso: string | null | undefined, mark: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) >= mark;
}

export type CycleClassification = {
  operational: boolean;
  reason: string;
};

/** Classificação explícita e auditável de um ciclo. */
export function classifyCycle(cycle: CycleStamp, mark: ActivationMark): CycleClassification {
  if (!mark) {
    return {
      operational: false,
      reason:
        "Marco operacional não definido — nenhum ciclo é tratado como obrigação operacional atual.",
    };
  }
  if (cycle.operationalSince) {
    return {
      operational: true,
      reason: `Ciclo nascido na nova operação em ${cycle.operationalSince}.`,
    };
  }
  const legacyReference = cycle.startedAt ?? cycle.updatedAt ?? null;
  if (isAtOrAfterMark(legacyReference, mark)) {
    return {
      operational: true,
      reason: `Ciclo sem carimbo, porém iniciado em ${legacyReference} (a partir do marco ${mark}).`,
    };
  }
  return {
    operational: false,
    reason: `Ciclo histórico (anterior ao marco ${mark}) — permanece registrado, sem gerar obrigação nova.`,
  };
}

/** Atalho booleano da classificação. */
export function isOperationalCycle(cycle: CycleStamp, mark: ActivationMark): boolean {
  return classifyCycle(cycle, mark).operational;
}
