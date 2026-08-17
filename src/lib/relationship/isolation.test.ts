/**
 * COMANDO 3B §4 — testes de isolamento entre homologação e produção.
 * Cenários A a E do comando, mais a consistência de tipos da Biblioteca.
 */
import { describe, expect, it } from "vitest";
import { resolveChannelMode } from "./channel";
import { evaluateRecipient, isHomologationLeadId } from "./recipient";
import { CONTENT_GROUPS, CONTENT_KINDS, selectContent, type ValueContent } from "./content";

const content = (over: Partial<ValueContent>): ValueContent => ({
  id: "c1",
  group: "E1",
  name: "Conteúdo",
  kind: "pdf",
  url: "https://exemplo/1.pdf",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  usageCount: 0,
  ...over,
});

describe("canal — o ambiente decide antes das credenciais", () => {
  it("CENÁRIO A: homologação sem credenciais simula", () => {
    expect(resolveChannelMode({ production: false, hasCredentials: false })).toBe("simulator");
  });
  it("CENÁRIO B: homologação COM credenciais reais continua simulando", () => {
    expect(resolveChannelMode({ production: false, hasCredentials: true })).toBe(
      "simulator",
    );
  });
  it("produção sem credenciais fica indisponível (nunca simula entrega)", () => {
    expect(resolveChannelMode({ production: true, hasCredentials: false })).toBe("unavailable");
  });
  it("produção com credenciais usa o canal oficial", () => {
    expect(resolveChannelMode({ production: true, hasCredentials: true })).toBe("meta");
  });
});

describe("destinatário — escopos não se misturam", () => {
  it("CENÁRIO C: lead TEST-* em homologação é permitido", () => {
    expect(evaluateRecipient("homologation", "TEST-0047", true).ok).toBe(true);
  });
  it("CENÁRIO D: lead real em homologação é bloqueado", () => {
    const v = evaluateRecipient("homologation", "lead-real-123", true);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/homologação/i);
  });
  it("CENÁRIO E: lead TEST-* em produção é bloqueado", () => {
    const v = evaluateRecipient("production", "TEST-0047", true);
    expect(v.ok).toBe(false);
  });
  it("lead inexistente no escopo é bloqueado (fail-closed)", () => {
    expect(evaluateRecipient("homologation", "TEST-1", false).ok).toBe(false);
    expect(evaluateRecipient("production", "lead-x", false).ok).toBe(false);
  });
  it("reconhece o prefixo fictício em qualquer caixa", () => {
    expect(isHomologationLeadId("test-0001")).toBe(true);
    expect(isHomologationLeadId("0001")).toBe(false);
  });
});

describe("Biblioteca de Conteúdos", () => {
  const library = [
    content({ id: "e1-a", group: "E1", name: "E1 A" }),
    content({ id: "e1-b", group: "E1", name: "E1 B" }),
    content({ id: "e3-a", group: "E3", name: "E3 A", kind: "video" }),
    content({ id: "r1-a", group: "R1", name: "R1 A", kind: "documento" }),
    content({ id: "r2-a", group: "R2", name: "R2 A", kind: "apresentacao" }),
  ];

  it("E1 consulta somente E1", () => {
    const sel = selectContent(library, "E1", []);
    expect(sel.content?.group).toBe("E1");
  });
  it("E3 consulta somente E3 e nunca reaproveita o conteúdo de E1", () => {
    const sel = selectContent(library, "E3", ["e1-a"]);
    expect(sel.content?.id).toBe("e3-a");
  });
  it("R1 consulta somente R1 e R2 somente R2", () => {
    expect(selectContent(library, "R1", []).content?.group).toBe("R1");
    expect(selectContent(library, "R2", []).content?.group).toBe("R2");
  });
  it("evita repetir enquanto existir outra opção válida no grupo", () => {
    const sel = selectContent(library, "E1", ["e1-a"]);
    expect(sel.content?.id).toBe("e1-b");
  });
  it("com uma única opção, reutiliza sem impedir o envio", () => {
    const sel = selectContent(library, "E3", ["e3-a"]);
    expect(sel.content?.id).toBe("e3-a");
  });
  it("etapa sem grupo não consulta a biblioteca", () => {
    expect(selectContent(library, null, []).content).toBeNull();
  });
  it("grupo sem conteúdo ativo não inventa conteúdo", () => {
    expect(selectContent(library, "V3", []).content).toBeNull();
  });
  it("todos os tipos suportados são aceitos pela seleção", () => {
    for (const kind of CONTENT_KINDS) {
      const sel = selectContent([content({ id: kind, group: "E1", kind })], "E1", []);
      expect(sel.content?.kind).toBe(kind);
    }
  });
  it("os grupos permanentes cobrem as finalidades do comando", () => {
    expect([...CONTENT_GROUPS]).toEqual(["E1", "E3", "R1", "R2", "V3", "V4"]);
  });
});
