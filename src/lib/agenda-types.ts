/**
 * Tipos da AGENDA OPERACIONAL GLOBAL.
 *
 * Vivem fora de `agenda.functions.ts` porque aquele módulo declara
 * server functions e precisa permanecer um invólucro fino.
 */

export type AgendaPriority = "maxima" | "media" | "minima";

/**
 * Natureza do item — determina como ele é apresentado:
 *  - `compromisso`: evento próprio, com horário, editável;
 *  - `reuniao`: reunião já existente em outro módulo, somente leitura;
 *  - `acao`: ação do motor de cadência, SEM horário (faixa "Ações do dia").
 */
export type AgendaKind = "compromisso" | "reuniao" | "acao";

export type AgendaItem = {
  id: string;
  title: string;
  kind: AgendaKind;
  /** Nulo para ações do dia — nenhum horário é fabricado. */
  startsAt: string | null;
  endsAt: string | null;
  /** Dia do item (America/Sao_Paulo), sempre presente. */
  dateISO: string;
  priority: AgendaPriority;
  note?: string | null;
  readOnly: boolean;
};

/** A identidade do executivo é resolvida no servidor — nunca enviada pelo cliente. */
export type AgendaRange = { fromISO: string; toISO: string };

export type AgendaDraft = {
  title: string;
  startsAt: string;
  endsAt: string;
  priority: AgendaPriority;
  note?: string | null;
};

export type AgendaCreateResult =
  | { ok: true; id: string }
  | { ok: false; reason: "conflito"; conflictWith: string; conflictAt: string }
  | { ok: false; reason: "invalido"; message: string };
