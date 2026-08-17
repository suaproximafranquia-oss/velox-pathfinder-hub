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

  it("conteúdo por link é selecionado e a troca de URL vale para os próximos envios", () => {
    const antes = item({
      id: "insta",
      group: "E1",
      groups: ["E1"],
      kind: "link",
      name: "TESTE — Vídeo Instagram E1",
      url: "https://www.instagram.com/p/ABC/",
    });
    expect(selectContent([antes], "E1", []).content?.url).toBe(
      "https://www.instagram.com/p/ABC/",
    );
    // Somente a URL muda: nenhuma etapa, template ou motor é alterado.
    const depois = { ...antes, url: "https://www.instagram.com/p/XYZ/" };
    expect(selectContent([depois], "E1", []).content?.url).toBe(
      "https://www.instagram.com/p/XYZ/",
    );
    // Isolamento por etapa: E1 nunca alimenta E3/R1/R2.
    expect(selectContent([depois], "E3", []).content).toBeNull();
    expect(selectContent([depois], "R1", []).content).toBeNull();
    expect(selectContent([depois], "R2", []).content).toBeNull();
  });
});

/**
 * COMANDO FINAL §12 — validação mínima da carga inicial por link:
 * cada etapa deve selecionar o conteúdo do seu próprio grupo.
 */
describe("carga inicial da biblioteca (links do Instagram)", () => {
  const seeded: ValueContent[] = [
    item({
      id: "e1",
      group: "E1",
      groups: ["E1"],
      name: "Desertos financeiros",
      kind: "video",
      url: "https://www.instagram.com/p/DcIAyu-A5yv/",
    }),
    item({
      id: "e3",
      group: "E3",
      groups: ["E3"],
      name: "Home Office ou Loja Física",
      kind: "video",
      url: "https://www.instagram.com/p/DcH-vj7Mw6a/",
    }),
    item({
      id: "r1",
      group: "R1",
      groups: ["R1"],
      name: "Como conhecemos e escolhemos a Velox",
      kind: "video",
      url: "https://www.instagram.com/p/DcH_mtbgkNp/",
    }),
    item({
      id: "r2",
      group: "R2",
      groups: ["R2"],
      name: "Começar sem garantia",
      kind: "video",
      url: "https://www.instagram.com/p/DcIAbOrsb2G/",
    }),
  ];

  it("não há lacuna nos grupos obrigatórios", () => {
    expect(contentLibraryGaps(seeded)).toEqual([]);
    expect(contentLibraryStats(seeded).missingRequired).toEqual([]);
  });

  it("cada etapa seleciona o conteúdo do próprio grupo", () => {
    for (const group of ["E1", "E3", "R1", "R2"] as const) {
      const chosen = selectContent(seeded, group, []).content;
      expect(chosen?.id).toBe(group.toLowerCase());
      expect(chosen?.url.startsWith("https://www.instagram.com/p/")).toBe(true);
    }
  });
});

/**
 * COMANDO 1B — complementação da Biblioteca: novos conteúdos por link e
 * reutilização multi-etapa (um único registro em várias etapas).
 */
describe("complementação da biblioteca (COMANDO 1B)", () => {
  const avaliar = item({
    id: "avaliar",
    group: "E3",
    groups: ["E3", "V3", "RE1"],
    kind: "video",
    name: "Como avaliar uma franquia antes de investir",
    url: "https://www.instagram.com/p/DcJcA7GA9g-/",
  });
  const estrutura = item({
    id: "estrutura",
    group: "E3",
    groups: ["E3", "V3", "RE2"],
    kind: "video",
    name: "Estrutura e suporte ao franqueado",
    url: "https://www.instagram.com/p/DcJciSdhpvF/",
  });
  const library: ValueContent[] = [
    item({
      id: "e3-antigo",
      group: "E3",
      groups: ["E3"],
      name: "Home Office ou Loja Física",
      url: "https://www.instagram.com/p/DcH-vj7Mw6a/",
    }),
    avaliar,
    estrutura,
    item({
      id: "consultoria",
      group: "E3",
      groups: ["E3"],
      kind: "video",
      name: "Suporte e consultoria ao franqueado",
      url: "https://www.instagram.com/p/DcJdev4gmzT/",
    }),
    item({
      id: "flavio",
      group: "R1",
      groups: ["R1"],
      kind: "video",
      name: "Flávio — 11 meses de Velox",
      url: "https://www.instagram.com/p/DcH_mtbgkNp/",
    }),
    item({
      id: "r2-antigo",
      group: "R2",
      groups: ["R2"],
      name: "Começar sem garantia",
      url: "https://www.instagram.com/p/DcIAbOrsb2G/",
    }),
    item({
      id: "objetivos",
      group: "R2",
      groups: ["R2"],
      kind: "video",
      name: "Objetivos, esforço e persistência",
      url: "https://www.instagram.com/p/DcJbefDAAFH/",
    }),
    item({
      id: "historia",
      group: "R2",
      groups: ["R2"],
      kind: "video",
      name: "Conte a sua própria história",
      url: "https://www.instagram.com/p/DcJbxCqhOHu/",
    }),
    item({
      id: "informacao",
      group: "R2",
      groups: ["R2"],
      kind: "video",
      name: "Informação, ambiente e escolha",
      url: "https://www.instagram.com/p/DcJcUYvABMT/",
    }),
  ];
  const names = (group: string) => contentsForGroup(library, group).map((c) => c.name);

  it("1) E3 encontra os três novos conteúdos, sem perder os antigos", () => {
    const e3 = names("E3");
    expect(e3).toContain("Como avaliar uma franquia antes de investir");
    expect(e3).toContain("Estrutura e suporte ao franqueado");
    expect(e3).toContain("Suporte e consultoria ao franqueado");
    expect(e3).toContain("Home Office ou Loja Física");
  });

  it("2) R1 encontra o conteúdo do Flávio", () => {
    expect(names("R1")).toEqual(["Flávio — 11 meses de Velox"]);
  });

  it("3) R2 encontra os três novos conteúdos", () => {
    const r2 = names("R2");
    expect(r2).toContain("Objetivos, esforço e persistência");
    expect(r2).toContain("Conte a sua própria história");
    expect(r2).toContain("Informação, ambiente e escolha");
    expect(r2).toContain("Começar sem garantia");
  });

  it("4/5/6) V3, RE1 e RE2 reutilizam os mesmos registros", () => {
    expect(names("V3").sort()).toEqual(
      ["Como avaliar uma franquia antes de investir", "Estrutura e suporte ao franqueado"].sort(),
    );
    expect(names("RE1")).toEqual(["Como avaliar uma franquia antes de investir"]);
    expect(names("RE2")).toEqual(["Estrutura e suporte ao franqueado"]);
  });

  it("7/8) conteúdo multi-etapa é um único registro e nada foi duplicado", () => {
    expect(contentGroupsOf(avaliar)).toEqual(["E3", "V3", "RE1"]);
    expect(library.filter((c) => c.url === avaliar.url)).toHaveLength(1);
    expect(new Set(library.map((c) => c.url)).size).toBe(library.length);
  });

  it("9) a seleção continua alternando entre os conteúdos ativos da etapa", () => {
    const first = selectContent(library, "R2", [], () => 0).content;
    const last = selectContent(library, "R2", [], () => 0.99).content;
    expect(first?.id).not.toBe(last?.id);
    // Já enviado não é repetido enquanto houver alternativa.
    const next = selectContent(library, "R2", ["r2-antigo", "objetivos", "historia"], () => 0)
      .content;
    expect(next?.id).toBe("informacao");
  });

  it("10/11) a URL é editável pela Biblioteca e 'Conte a sua própria história' usa o link oficial", () => {
    expect(library.find((c) => c.id === "historia")?.url).toBe(
      "https://www.instagram.com/p/DcJbxCqhOHu/",
    );
    const editado = library.map((c) =>
      c.id === "historia" ? { ...c, url: "https://www.instagram.com/p/NOVO/" } : c,
    );
    expect(selectContent(editado, "R2", ["r2-antigo", "objetivos", "informacao"], () => 0).content
      ?.url).toBe("https://www.instagram.com/p/NOVO/");
  });
});
