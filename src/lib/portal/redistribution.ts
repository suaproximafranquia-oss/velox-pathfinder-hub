/**
 * COMANDO 4E §33–§38 — FILA DE REDISTRIBUIÇÃO.
 *
 * Fila circular (round-robin) com ponteiro persistente. O proprietário
 * do lead é PULADO sem consumir o turno: o ponteiro continua a partir
 * do destinatário real.
 */
/** Mesmo ponteiro já utilizado pela fila oficial — nunca um segundo. */
const POINTER_KEY = "atlas:redistribution:cursor:v1";
const HISTORY_KEY = "velox:workspace:redistribution-history:v1";

export type RedistributionPick = {
  recipientId: string | null;
  /** Índice do próximo turno após a entrega. */
  nextPointer: number;
  /** Executivos pulados por serem proprietários do lead. */
  skipped: string[];
};

/**
 * Decisão pura: dado o estado da fila, quem recebe o lead.
 * O proprietário atual jamais recebe o próprio lead de volta.
 */
export function pickRecipient(input: {
  queue: string[];
  pointer: number;
  /** Proprietário/responsável atual — nunca elegível. */
  currentOwnerId?: string | null;
}): RedistributionPick {
  const queue = input.queue.filter(Boolean);
  if (queue.length === 0) return { recipientId: null, nextPointer: input.pointer, skipped: [] };
  const start = ((input.pointer % queue.length) + queue.length) % queue.length;
  const skipped: string[] = [];
  for (let step = 0; step < queue.length; step += 1) {
    const index = (start + step) % queue.length;
    const candidate = queue[index]!;
    if (input.currentOwnerId && candidate === input.currentOwnerId) {
      // §34 — pula sem consumir o turno.
      skipped.push(candidate);
      continue;
    }
    return {
      recipientId: candidate,
      // §35 — o ponteiro passa a considerar o destinatário REAL.
      nextPointer: (index + 1) % queue.length,
      skipped,
    };
  }
  return { recipientId: null, nextPointer: start, skipped };
}

export function readPointer(): number {
  if (typeof window === "undefined") return 0;
  const raw = Number(window.localStorage.getItem(POINTER_KEY));
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

export function writePointer(value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POINTER_KEY, String(value));
  } catch {
    /* armazenamento indisponível */
  }
}

export type RedistributionEntry = {
  leadId: string;
  fromOwnerId: string | null;
  recipientId: string;
  redistributedBy: string;
  reason: string;
  at: string;
};

export function readRedistributionHistory(): RedistributionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RedistributionEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordRedistribution(entry: RedistributionEntry): void {
  if (typeof window === "undefined") return;
  try {
    const all = [...readRedistributionHistory(), entry].slice(-500);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {
    /* armazenamento indisponível */
  }
}

/**
 * §31/§32 — texto oficial da confirmação exibida na Central Única.
 */
export function redistributionPrompt(ownerName: string | null): string {
  return ownerName
    ? `Este lead pertence ao Executivo ${ownerName}. Deseja redistribuir mesmo assim?`
    : "Este lead ainda não possui proprietário. Deseja redistribuir?";
}

/** Executa a escolha usando o ponteiro persistente e registra o histórico. */
export function redistributeLead(input: {
  leadId: string;
  queue: string[];
  currentOwnerId: string | null;
  redistributedBy: string;
  reason?: string;
}): RedistributionPick {
  const pick = pickRecipient({
    queue: input.queue,
    pointer: readPointer(),
    currentOwnerId: input.currentOwnerId,
  });
  if (!pick.recipientId) return pick;
  writePointer(pick.nextPointer);
  recordRedistribution({
    leadId: input.leadId,
    fromOwnerId: input.currentOwnerId,
    recipientId: pick.recipientId,
    redistributedBy: input.redistributedBy,
    reason: input.reason ?? "Redistribuição operacional da Gestora.",
    at: new Date().toISOString(),
  });
  return pick;
}
