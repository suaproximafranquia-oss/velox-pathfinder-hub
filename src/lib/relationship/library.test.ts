/** Biblioteca permanente — reutilização de um mesmo material (COMANDO 3C §7). */
import { describe, expect, it } from "vitest";
import {
  contentGroupsOf,
  contentLibraryGaps,
  contentLibraryStats,
  contentsForGroup,
  selectContent,
  type ValueContent,
} from "./content";

function item(over: Partial<ValueContent>): ValueContent {
  return {
    id: "c1",
    group: "E1",
    name: "Material",
    kind: "pdf",
    url: "https://exemplo.invalido/a.pdf",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    usageCount: 0,
    ...over,
  };
}

describe("biblioteca de conteúdos", () => {
  it("um mesmo material atende a vários grupos sem duplicação", () => {
    const shared = item({ id: "shared", group: "E1", groups: ["E1", "R1"] });
    const library = [shared];
    expect(contentGroupsOf(shared)).toEqual(["E1", "R1"]);
    expect(contentsForGroup(library, "E1")).toHaveLength(1);
    expect(contentsForGroup(library, "R1")).toHaveLength(1);
    expect(contentsForGroup(library, "E3")).toHaveLength(0);
    expect(selectContent(library, "R1", []).content?.id).toBe("shared");
  });

  it("conteúdo inativo não é selecionado nem conta como cobertura", () => {
    const library = [item({ id: "off", groups: ["E1", "E3", "R1", "R2"], active: false })];
    expect(selectContent(library, "E1", []).content).toBeNull();
    expect(contentLibraryGaps(library)).toHaveLength(4);
  });

  it("estatística reflete grupos obrigatórios cobertos", () => {
    const library = [
      item({ id: "a", groups: ["E1", "E3"] }),
      item({ id: "b", groups: ["R1", "R2"] }),
    ];
    const stats = contentLibraryStats(library);
    expect(stats.total).toBe(2);
    expect(stats.missingRequired).toEqual([]);
    expect(stats.byGroup.find((g) => g.group === "E1")?.active).toBe(1);
  });
});
