/**
 * ABSTRAÇÃO TEMPORAL DO MOTOR (COMANDO 2A §84).
 *
 * As regras de negócio nunca chamam `new Date()` diretamente: elas
 * pedem a hora ao relógio recebido. Em produção o relógio é real; na
 * homologação é virtual (24 horas reais = 12 dias virtuais, fator 12),
 * respeitando o mesmo calendário — inclusive finais de semana virtuais.
 */
export type EngineClock = {
  kind: "real" | "virtual";
  /** Instante atual do relógio. */
  now: () => Date;
  /** ISO do instante atual. */
  nowIso: () => string;
};

export const realClock: EngineClock = {
  kind: "real",
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
};

/** 24 horas reais = 12 dias virtuais. */
export const VIRTUAL_SPEED_FACTOR = 12;

export type VirtualClockState = {
  /** Instante real em que a rodada começou. */
  startedAtReal: string;
  /** Instante virtual correspondente ao início da rodada. */
  startedAtVirtual: string;
  /** Rodada pausada/encerrada: o relógio congela neste instante virtual. */
  frozenAtVirtual?: string | null;
  factor?: number;
};

/**
 * Relógio virtual da homologação. Congelado quando a rodada termina —
 * o ambiente fica inativo, mas continua instalado e consultável.
 */
export function createVirtualClock(
  state: VirtualClockState,
  realNow: () => Date = () => new Date(),
): EngineClock {
  const factor = state.factor ?? VIRTUAL_SPEED_FACTOR;
  const now = () => {
    if (state.frozenAtVirtual) return new Date(state.frozenAtVirtual);
    const elapsed = realNow().getTime() - new Date(state.startedAtReal).getTime();
    return new Date(new Date(state.startedAtVirtual).getTime() + Math.max(0, elapsed) * factor);
  };
  return { kind: "virtual", now, nowIso: () => now().toISOString() };
}