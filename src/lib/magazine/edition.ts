/**
 * REVISTA VELOX — regra editorial oficial.
 *
 * Cada edição vive exatamente 10 DIAS CORRIDOS. A contagem NÃO começa
 * pelo calendário: ela começa no dia em que o primeiro conteúdo da
 * edição é efetivamente publicado. Enquanto a edição não tiver nenhum
 * conteúdo, ela está "não iniciada" e nenhum prazo corre. Depois dos 10
 * dias a edição é encerrada e passa ao acervo — continua legível e
 * numerada, nunca é excluída.
 */
export const EDITION_DURATION_DAYS = 10;

/** Limite de caracteres do texto de uma página (preserva a diagramação). */
export const PAGE_BODY_MAX = 900;

export type MediaKind = "none" | "imagem" | "video";

export type MagazinePage = {
  id: string;
  editionId: string;
  position: number;
  eyebrow: string | null;
  title: string;
  body: string;
  caption: string | null;
  mediaKind: MediaKind;
  /** URL pronta para uso (assinada quando o arquivo vive no acervo). */
  mediaUrl: string | null;
};

export type MagazineEdition = {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  startsOn: string; // YYYY-MM-DD
  published: boolean;
  createdByName: string;
  createdAt: string;
  pages: MagazinePage[];
};

export type EditionStatus =
  /** Sem conteúdo: a contagem de 10 dias ainda não começou. */
  | "nao_iniciada"
  /** Oculta do Portal (desativada) — continua existindo e numerada. */
  | "desativada"
  | "vigente"
  | "encerrada"
  | "agendada";

export const EDITION_STATUS_LABEL: Record<EditionStatus, string> = {
  nao_iniciada: "não iniciada",
  desativada: "desativada",
  vigente: "vigente",
  encerrada: "encerrada",
  agendada: "agendada",
};

const DAY = 24 * 60 * 60 * 1000;

function parseDay(value: string): number {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Último dia (inclusive) em que a edição permanece vigente. */
export function editionEndsOn(startsOn: string): string {
  const end = new Date(parseDay(startsOn) + (EDITION_DURATION_DAYS - 1) * DAY);
  return end.toISOString().slice(0, 10);
}

/** Dia atual em America/Sao_Paulo — referência oficial do Portal. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A edição só existe editorialmente depois do primeiro conteúdo. */
export function editionHasStarted(edition: Pick<MagazineEdition, "pages">): boolean {
  return edition.pages.length > 0;
}

export function editionStatus(
  edition: Pick<MagazineEdition, "startsOn" | "published" | "pages">,
  today: string = todayInSaoPaulo(),
): EditionStatus {
  if (!editionHasStarted(edition)) return "nao_iniciada";
  if (!edition.published) return "desativada";
  const start = parseDay(edition.startsOn);
  const reference = parseDay(today);
  if (reference < start) return "agendada";
  if (reference > parseDay(editionEndsOn(edition.startsOn))) return "encerrada";
  return "vigente";
}

/** Dias restantes da edição vigente (0 quando encerra hoje). */
export function daysRemaining(
  edition: Pick<MagazineEdition, "startsOn" | "published" | "pages">,
  today: string = todayInSaoPaulo(),
): number {
  if (editionStatus(edition, today) !== "vigente") return 0;
  return Math.round((parseDay(editionEndsOn(edition.startsOn)) - parseDay(today)) / DAY);
}

/** Edição vigente — no máximo uma. Sem vigente, devolve a mais recente encerrada. */
export function currentEdition(
  editions: MagazineEdition[],
  today: string = todayInSaoPaulo(),
): MagazineEdition | null {
  const published = editions.filter((e) => e.published);
  return (
    published.find((e) => editionStatus(e, today) === "vigente") ??
    published
      .filter((e) => editionStatus(e, today) === "encerrada")
      .sort((a, b) => b.number - a.number)[0] ??
    null
  );
}

/** Acervo: tudo o que já foi publicado e não é a edição vigente. */
export function archivedEditions(
  editions: MagazineEdition[],
  today: string = todayInSaoPaulo(),
): MagazineEdition[] {
  return editions
    .filter((e) => e.published && editionStatus(e, today) === "encerrada")
    .sort((a, b) => b.number - a.number);
}

export function nextEditionNumber(editions: Array<{ number: number }>): number {
  return editions.reduce((max, e) => Math.max(max, e.number), 0) + 1;
}

export function formatEditionCode(number: number): string {
  return `Edição ${String(number).padStart(3, "0")}`;
}

export function formatPeriod(startsOn: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  return `${fmt(startsOn)} — ${fmt(editionEndsOn(startsOn))}`;
}

const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Mês/ano da edição — identificação curta usada nos cards da banca. */
export function formatEditionMonth(startsOn: string): string {
  const [y, m] = startsOn.slice(0, 10).split("-").map(Number);
  return `${MONTHS_PT[(m ?? 1) - 1] ?? ""}/${y ?? ""}`;
}

/**
 * Banca de edições do Portal: tudo o que já foi publicado com conteúdo
 * (vigente ou acervo) mais as edições agendadas, que aparecem
 * bloqueadas. Edições desativadas e sem conteúdo nunca aparecem.
 */
export function galleryEditions(
  editions: MagazineEdition[],
  today: string = todayInSaoPaulo(),
): MagazineEdition[] {
  return editions
    .filter((e) => {
      const status = editionStatus(e, today);
      return status === "vigente" || status === "encerrada" || status === "agendada";
    })
    .sort((a, b) => b.number - a.number);
}

/** Páginas em ordem editorial (esquerda = texto, direita = mídia). */
export function spreadsOf(pages: MagazinePage[]): MagazinePage[] {
  return [...pages].sort((a, b) => a.position - b.position);
}

/**
 * Alternância editorial das páginas duplas: conteúdos ímpares abrem com
 * o texto à esquerda; os pares invertem (mídia à esquerda). No celular a
 * leitura é sempre vertical — texto primeiro, mídia depois.
 */
export function mediaOnLeft(position: number): boolean {
  return position % 2 === 0;
}

/**
 * §Sequência — só existe UMA edição em preparação/vigência por vez. A
 * próxima edição só pode ser criada quando a atual encerrou o ciclo.
 */
export function canCreateEdition(
  editions: MagazineEdition[],
  today: string = todayInSaoPaulo(),
): boolean {
  return !editions.some((e) => {
    const status = editionStatus(e, today);
    return status === "vigente" || status === "agendada" || status === "nao_iniciada";
  });
}

/**
 * Numeração contínua: depois de excluir um conteúdo, as posições são
 * reconstruídas de 1..n. Nunca sobram buracos na sequência.
 */
export function renumberPages(pages: MagazinePage[]): Array<{ id: string; position: number }> {
  return spreadsOf(pages).map((page, index) => ({ id: page.id, position: index + 1 }));
}

/** Edição encerrada que precisa de aviso ao administrador (§16). */
export function editionNeedsSuccessor(
  editions: MagazineEdition[],
  today: string = todayInSaoPaulo(),
): MagazineEdition | null {
  const started = editions.filter((e) => editionHasStarted(e));
  if (started.some((e) => editionStatus(e, today) === "vigente")) return null;
  return (
    started
      .filter((e) => editionStatus(e, today) === "encerrada")
      .sort((a, b) => b.number - a.number)[0] ?? null
  );
}
