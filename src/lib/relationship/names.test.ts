import { describe, expect, it } from "vitest";
import { looksLikeName, resolveTreatment, suggestNameForConfirmation, NEUTRAL_TREATMENT } from "./names";
import { renderHomologationMessage } from "./messages";
import { INTERNAL_CADENCE_TEMPLATES, getInternalTemplate } from "./internal-templates";

describe("personalização segura de nome", () => {
  it("usa fallback quando o cadastro não é um nome", () => {
    for (const raw of ["Quero informações", "Tenho interesse", "12345", "lead teste"]) {
      expect(looksLikeName(raw)).toBe(false);
      expect(resolveTreatment({ rawName: raw }).treatment).toBe(NEUTRAL_TREATMENT);
    }
  });

  it("reconhece nome pela base e normaliza capitalização", () => {
    expect(resolveTreatment({ rawName: "PATRÍCIA" })).toMatchObject({
      treatment: "Patrícia",
      source: "base_de_nomes",
      personalized: true,
    });
    expect(resolveTreatment({ rawName: "maria clara silva" }).treatment).toBe("Maria Clara");
  });

  it("respeita a prioridade oficial", () => {
    const r = resolveTreatment({
      rawName: "joao",
      executiveProvidedName: "Pedro",
      confirmedName: "Carlos",
    });
    expect(r.source).toBe("confirmado_executivo");
    expect(r.treatment).toBe("Carlos");
  });

  it("negativa do executivo bloqueia personalização automática", () => {
    const r = resolveTreatment({ rawName: "joao", manuallyRejected: true });
    expect(r.treatment).toBe(NEUTRAL_TREATMENT);
    expect(r.personalized).toBe(false);
  });

  it("sugere nome para confirmação manual", () => {
    expect(suggestNameForConfirmation("thiago rodrigues")).toBe("Thiago");
    expect(suggestNameForConfirmation("Quero saber mais")).toBeNull();
  });

  it("primeiro contato nunca usa nome não confirmado", () => {
    const r = renderHomologationMessage("E0", {
      executiveName: "Thiago",
      portalLink: "https://x.test/p",
      rawInvestorName: "Patrícia",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toContain("caro investidor");
      expect(r.usedName).toBe(false);
    }
  });

  it("reengajamento personaliza quando há nome válido", () => {
    const r = renderHomologationMessage("R1", {
      executiveName: "Thiago",
      portalLink: "https://x.test/p",
      confirmedInvestorName: "Patrícia",
      contentName: "Material Velox",
      contentUrl: "https://x.test/c",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toContain("Olá, Patrícia");
      expect(r.body).not.toContain("{{");
      expect(r.usedName).toBe(true);
    }
  });

  it("bloqueia etapa com conteúdo obrigatório ausente", () => {
    const r = renderHomologationMessage("E1", { executiveName: "T", portalLink: "u" });
    expect(r.ok).toBe(false);
  });
});

describe("templates internos", () => {
  it("registra 14 etapas sem ID da Meta", () => {
    expect(INTERNAL_CADENCE_TEMPLATES).toHaveLength(14);
    for (const t of INTERNAL_CADENCE_TEMPLATES) {
      expect(t.status).toBe("NAO_SUBMETIDO_META");
      expect(t.metaTemplateId).toBeNull();
      expect(t.metaTemplateName).toBeNull();
    }
  });
  it("expõe variáveis declaradas", () => {
    expect(getInternalTemplate("E0")?.variables).toEqual(["nome_executivo", "link_portal"]);
  });
});
