/**
 * REVISTA VELOX — regra editorial oficial.
 *
 * Cada edição vive exatamente 10 DIAS CORRIDOS a partir da data de
 * início. Depois disso ela é encerrada automaticamente e passa ao
 * acervo: continua legível, mas deixa de ser a edição vigente. Nenhuma
 * data é inventada — o ciclo deriva sempre de `startsOn`.
 */
export const EDITION_DURATION_DAYS = 10;

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

export type EditionStatus = "rascunho" | "vigente" | "encerrada" | "agendada";

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

export function editionStatus(
  edition: Pick<MagazineEdition, "startsOn" | "published">,
  today: string = todayInSaoPaulo(),
): EditionStatus {
  if (!edition.published) return "rascunho";
  const start = parseDay(edition.startsOn);
  const reference = parseDay(today);
  if (reference < start) return "agendada";
  if (reference > parseDay(editionEndsOn(edition.startsOn))) return "encerrada";
  return "vigente";
}

/** Dias restantes da edição vigente (0 quando encerra hoje). */
export function daysRemaining(
  edition: Pick<MagazineEdition, "startsOn" | "published">,
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

/** Páginas em ordem editorial (esquerda = texto, direita = mídia). */
export function spreadsOf(pages: MagazinePage[]): MagazinePage[] {
  return [...pages].sort((a, b) => a.position - b.position);
}
