import { describe, expect, it } from "vitest";
import {
  CRM_TEMPLATES,
  CRM_OPENING_TEMPLATES,
  getCrmTemplate,
  isRetiredCrmTemplate,
  pickOpeningTemplate,
  renderCrmTemplate,
} from "./templates";

describe("Central de Templates — estrutura operacional", () => {
  it("expõe somente quatro templates manuais na ordem oficial", () => {
    expect(CRM_TEMPLATES.map((t) => t.id)).toEqual([
      "primeiro_contato",
      "abertura_conversa_1",
      "abertura_conversa_2",
      "abertura_conversa_3",
    ]);
  });

  it("não oferece as etapas do motor como template manual", () => {
    for (const id of ["segundo_contato", "terceiro_contato", "quarto_contato", "quinto_contato_encerramento"]) {
      expect(getCrmTemplate(id)).toBeNull();
      expect(isRetiredCrmTemplate(id)).toBe(true);
    }
  });

  it("primeiro contato assina como Executivo de Expansão e resolve variáveis", () => {
    const body = renderCrmTemplate(CRM_TEMPLATES[0]!, {
      executiveName: "Thiago",
      portalLink: "https://exemplo/f/thiago",
    });
    expect(body).toContain("Executivo de Expansão");
    expect(body).not.toContain("Administrador Geral");
    expect(body).toContain("https://exemplo/f/thiago");
    expect(body).not.toMatch(/\{\{/);
  });

  it("aberturas são neutras, sem conteúdo comercial", () => {
    for (const t of CRM_OPENING_TEMPLATES) {
      const text = t.body.toLowerCase();
      expect(text).not.toMatch(/franquia|invest|http|oportunidade|material|proposta/);
      expect(t.body.length).toBeLessThan(140);
    }
  });

  it("alterna aberturas sem repetir enquanto houver alternativa", () => {
    expect(pickOpeningTemplate([]).id).toBe("abertura_conversa_1");
    expect(pickOpeningTemplate(["abertura_conversa_1"]).id).toBe("abertura_conversa_2");
    expect(
      pickOpeningTemplate(["abertura_conversa_1", "abertura_conversa_2", "abertura_conversa_3"]).id,
    ).toBe("abertura_conversa_1");
  });
});
