/**
 * TESTE CONTROLADO DE ENTRADA — 24 HORAS (definições puras).
 *
 * Este arquivo não envia, não grava e não decide nada de negócio: ele
 * apenas descreve O QUE será testado e QUANDO. A execução usa o caminho
 * único de ingestão já existente (`intakeLead`) e o motor real.
 *
 * SEGURANÇA: todo lead gerado aqui é fictício e carrega marcação
 * técnica (`is_test` + `test_batch_id`). Telefone com prefixo não
 * roteável, e-mail em domínio inexistente, nenhum dado pessoal real.
 */

/** Prefixo de telefone inexistente e não roteável. */
export const TEST_PHONE_PREFIX = "5500";
/** Identificação do tipo de lote — distingue do laboratório de cenários. */
export const BATCH_24H_KIND = "entrada_24h";
/** Domínio fictício reservado ao teste. */
export const TEST_EMAIL_DOMAIN = "teste.velox.local";

export type EntryType = "greensales" | "portal" | "reentrada";
export type TimeSlot = "madrugada" | "janela_aberta" | "pos_fechamento";

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  greensales: "GreenSales",
  portal: "Portal",
  reentrada: "Reentrada",
};

export const SLOT_LABEL: Record<TimeSlot, string> = {
  madrugada: "Madrugada",
  janela_aberta: "Janela aberta",
  pos_fechamento: "Pós-fechamento",
};

/** Faixas-alvo em hora local da operação (America/Sao_Paulo). */
export const SLOT_RANGE: Record<TimeSlot, { startMin: number; endMin: number }> = {
  // 01:00 → 05:00
  madrugada: { startMin: 60, endMin: 300 },
  // 07:00 → 12:00
  janela_aberta: { startMin: 420, endMin: 720 },
  // 12:01 → 18:00
  pos_fechamento: { startMin: 721, endMin: 1080 },
};

export const ENTRY_TYPES: EntryType[] = ["greensales", "portal", "reentrada"];
export const TIME_SLOTS: TimeSlot[] = ["madrugada", "janela_aberta", "pos_fechamento"];

/** A operação está em UTC-3 o ano inteiro. */
const UTC_OFFSET_HOURS = 3;
export const TEST_TIME_ZONE = "America/Sao_Paulo";

/** Gerador determinístico: a mesma semente reproduz a mesma ordem. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Data e minutos locais (operação) de um instante. */
export function localParts(value: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

function addCalendarDay(isoDate: string, days = 1): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

/** Instante UTC correspondente a um horário local da operação. */
export function atLocalMinutes(isoDate: string, minutes: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(
    Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, UTC_OFFSET_HOURS, 0, 0, 0) + minutes * 60_000,
  ).toISOString();
}

export type PlannedEvent = {
  position: number;
  entryType: EntryType;
  slot: TimeSlot;
  externalId: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  scheduledAt: string;
};

const CITIES = ["Ribeirão Preto", "Taubaté", "Uberlândia", "Curitiba", "Belo Horizonte", "Sorocaba"];

/** Identificador do lote: TEST-BATCH-24H-YYYYMMDD-HHMM (hora local). */
export function buildBatch24hId(now: Date = new Date()): string {
  const { date, minutes } = localParts(now);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `TEST-BATCH-24H-${date.replace(/-/g, "")}-${hh}${mm}`;
}

function slotCode(slot: TimeSlot): string {
  return slot === "madrugada" ? "MAD" : slot === "janela_aberta" ? "JAN" : "POS";
}

function typeCode(type: EntryType): string {
  return type === "greensales" ? "GS" : type === "portal" ? "PORTAL" : "REENTRADA";
}

/**
 * Próxima ocorrência da faixa, sempre no futuro. Uma pequena margem
 * evita que um horário caia no mesmo minuto da criação do lote.
 */
function scheduleForSlot(slot: TimeSlot, now: Date, rand: () => number): string {
  const range = SLOT_RANGE[slot];
  const { date, minutes } = localParts(now);
  const marginMin = 3;
  const span = range.endMin - range.startMin;
  const sameDayFloor = Math.max(range.startMin, minutes + marginMin);
  const useSameDay = sameDayFloor < range.endMin;
  const targetDate = useSameDay ? date : addCalendarDay(date, 1);
  const floor = useSameDay ? sameDayFloor : range.startMin;
  const ceiling = useSameDay ? range.endMin : range.startMin + span;
  const chosen = Math.floor(floor + rand() * Math.max(1, ceiling - floor));
  return atLocalMinutes(targetDate, Math.min(chosen, range.endMin));
}

/**
 * Plano do lote: 3 tipos × 3 faixas = 9 leads. A ORDEM dos eventos é
 * embaralhada pela semente (nunca agrupada por tipo), mas a garantia
 * estrutural é mantida: cada tipo tem madrugada, janela e pós-fechamento.
 */
export function planBatch24h(batchId: string, seed: string, now: Date = new Date()): PlannedEvent[] {
  const rand = seededRandom(seed);
  const combos: { entryType: EntryType; slot: TimeSlot }[] = [];
  for (const entryType of ENTRY_TYPES) {
    for (const slot of TIME_SLOTS) combos.push({ entryType, slot });
  }
  // Embaralhamento determinístico (Fisher-Yates com a semente do lote).
  for (let i = combos.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = combos[i]!;
    combos[i] = combos[j]!;
    combos[j] = a;
  }

  const planned = combos.map((combo, index) => {
    const scheduledAt = scheduleForSlot(combo.slot, now, rand);
    const suffix = String(index + 1).padStart(2, "0");
    const externalId = `${batchId}-${typeCode(combo.entryType)}-${slotCode(combo.slot)}-${suffix}`;
    return {
      position: index + 1,
      entryType: combo.entryType,
      slot: combo.slot,
      externalId,
      name: `TESTE ${typeCode(combo.entryType)} ${SLOT_LABEL[combo.slot]} ${suffix}`,
      phone: `${TEST_PHONE_PREFIX}${String(910000000 + index).slice(0, 9)}`,
      email: `${externalId.toLowerCase()}@${TEST_EMAIL_DOMAIN}`,
      city: CITIES[index % CITIES.length]!,
      scheduledAt,
    } satisfies PlannedEvent;
  });

  return planned.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

/** Trava final: nenhum destinatário que não seja fictício entra no teste. */
export function isSyntheticRecipient(lead: { phone: string; email: string }): boolean {
  return (
    lead.phone.startsWith(TEST_PHONE_PREFIX) && lead.email.endsWith(`@${TEST_EMAIL_DOMAIN}`)
  );
}

/** Payload equivalente ao entregue pela origem real (GreenSales). */
export function buildBatch24hPayload(
  lead: PlannedEvent,
  entryTagId: string,
  nowIso: string,
  options: { previousEntryIso?: string | null } = {},
): Record<string, unknown> {
  return {
    id: lead.externalId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    origin:
      lead.entryType === "portal"
        ? "Portal do Investidor"
        : lead.entryType === "reentrada"
          ? "GreenSales — nova entrada comercial"
          : "GreenSales",
    status: "novo",
    created_at: options.previousEntryIso ?? nowIso,
    updated_at: nowIso,
    last_register_at: nowIso,
    tags: [{ id: entryTagId }],
    forms: [{ title: `Teste 24h — ${ENTRY_TYPE_LABEL[lead.entryType]}` }],
    metas: [
      { meta_key: "cidade", meta_value: lead.city },
      { meta_key: "teste_tipo_entrada", meta_value: lead.entryType },
      { meta_key: "teste_faixa", meta_value: lead.slot },
    ],
  };
}

/**
 * Reconstrói o lead fictício a partir do registro persistido do evento.
 * Mantém a mesma fórmula usada no planejamento — o banco guarda apenas
 * a identidade; telefone, e-mail e cidade continuam derivados aqui.
 */
export function rebuildPlannedEvent(row: {
  position: number;
  entry_type: EntryType;
  slot: TimeSlot;
  external_id: string;
  lead_name: string;
  scheduled_at: string;
}): PlannedEvent {
  const index = row.position - 1;
  return {
    position: row.position,
    entryType: row.entry_type,
    slot: row.slot,
    externalId: row.external_id,
    name: row.lead_name,
    phone: `${TEST_PHONE_PREFIX}${String(910000000 + index).slice(0, 9)}`,
    email: `${row.external_id.toLowerCase()}@${TEST_EMAIL_DOMAIN}`,
    city: CITIES[index % CITIES.length]!,
    scheduledAt: row.scheduled_at,
  };
}
