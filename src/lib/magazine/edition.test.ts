import { describe, expect, it } from "vitest";
import {
  archivedEditions,
  currentEdition,
  daysRemaining,
  editionEndsOn,
  editionStatus,
  editionNeedsSuccessor,
  renumberPages,
  formatEditionCode,
  formatPeriod,
  nextEditionNumber,
  type MagazineEdition,
} from "./edition";

const page = (id: string, position: number) => ({
  id,
  editionId: "e1",
  position,
  eyebrow: null,
  title: `Conteúdo ${position}`,
  body: "texto",
  caption: null,
  mediaKind: "none" as const,
  mediaUrl: null,
});

const base = (over: Partial<MagazineEdition>): MagazineEdition => ({
  id: over.id ?? "e1",
  number: over.number ?? 1,
  title: "Edição de teste",
  subtitle: null,
  coverUrl: null,
  startsOn: over.startsOn ?? "2026-08-01",
  published: over.published ?? true,
  createdByName: "Teste",
  createdAt: "2026-08-01T00:00:00Z",
  pages: over.pages ?? [page("p1", 1)],
});

describe("Revista Velox — ciclo de 10 dias corridos", () => {
  it("encerra no décimo dia corrido", () => {
    expect(editionEndsOn("2026-08-01")).toBe("2026-08-10");
  });

  it("só começa a contar depois do primeiro conteúdo publicado", () => {
    const semConteudo = base({ startsOn: "2026-08-01", pages: [] });
    expect(editionStatus(semConteudo, "2026-08-02")).toBe("nao_iniciada");
  });

  it("classifica desativada, agendada, vigente e encerrada", () => {
    const edition = base({ startsOn: "2026-08-01" });
    expect(editionStatus({ ...edition, published: false }, "2026-08-02")).toBe("desativada");
    expect(editionStatus(edition, "2026-07-31")).toBe("agendada");
    expect(editionStatus(edition, "2026-08-01")).toBe("vigente");
    expect(editionStatus(edition, "2026-08-10")).toBe("vigente");
    expect(editionStatus(edition, "2026-08-11")).toBe("encerrada");
  });

  it("calcula os dias restantes da edição vigente", () => {
    const edition = base({ startsOn: "2026-08-01" });
    expect(daysRemaining(edition, "2026-08-01")).toBe(9);
    expect(daysRemaining(edition, "2026-08-10")).toBe(0);
    expect(daysRemaining(edition, "2026-08-11")).toBe(0);
  });

  it("elege uma única edição vigente e envia as demais ao acervo", () => {
    const editions = [
      base({ id: "a", number: 1, startsOn: "2026-07-01" }),
      base({ id: "b", number: 2, startsOn: "2026-08-01" }),
      base({ id: "c", number: 3, startsOn: "2026-09-01", published: false }),
    ];
    expect(currentEdition(editions, "2026-08-05")?.id).toBe("b");
    expect(archivedEditions(editions, "2026-08-05").map((e) => e.id)).toEqual(["a"]);
  });

  it("mantém a última edição encerrada acessível quando não há vigente", () => {
    const editions = [base({ id: "a", number: 1, startsOn: "2026-07-01" })];
    expect(currentEdition(editions, "2026-08-30")?.id).toBe("a");
    expect(editionNeedsSuccessor(editions, "2026-08-30")?.id).toBe("a");
    expect(editionNeedsSuccessor(editions, "2026-07-05")).toBeNull();
  });

  it("renumera os conteúdos sem deixar buracos após exclusão", () => {
    const pages = [page("p1", 1), page("p3", 3), page("p7", 7)];
    expect(renumberPages(pages)).toEqual([
      { id: "p1", position: 1 },
      { id: "p3", position: 2 },
      { id: "p7", position: 3 },
    ]);
  });

  it("numera e rotula as edições em sequência", () => {
    expect(nextEditionNumber([{ number: 1 }, { number: 4 }])).toBe(5);
    expect(nextEditionNumber([])).toBe(1);
    expect(formatEditionCode(1)).toBe("Edição 001");
    expect(formatPeriod("2026-08-01")).toBe("01/08/2026 — 10/08/2026");
  });
});
