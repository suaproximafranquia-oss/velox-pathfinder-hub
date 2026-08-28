import { describe, expect, it } from "vitest";
import { buttonUrlSuffix, resolveDestinations } from "./e0-destinations";

describe("destinos dinâmicos da E0", () => {
  it("resolve portal e contato do executivo responsável", () => {
    const result = resolveDestinations({
      portalUrl: "https://portal.velox/investidor/larissa",
      executiveWhatsapp: "(17) 99772-7337",
      portalRequired: true,
      contactRequired: true,
    });
    expect(result.blockers).toEqual([]);
    expect(result.portalUrl).toBe("https://portal.velox/investidor/larissa");
    expect(result.contactPhone).toBe("5517997727337");
    expect(result.contactUrl).toContain("5517997727337");
  });

  it("bloqueia com motivo legível quando o responsável não tem WhatsApp", () => {
    const result = resolveDestinations({
      portalUrl: "https://portal.velox/investidor/larissa",
      executiveWhatsapp: null,
      portalRequired: true,
      contactRequired: true,
    });
    expect(result.contactUrl).toBeNull();
    expect(result.blockers.length).toBe(1);
  });

  it("não exige contato quando o template não tem esse botão", () => {
    const result = resolveDestinations({
      portalUrl: "https://portal.velox/investidor/larissa",
      executiveWhatsapp: null,
      portalRequired: true,
      contactRequired: false,
    });
    expect(result.blockers).toEqual([]);
  });

  it("bloqueia link personalizado ausente", () => {
    const result = resolveDestinations({
      portalUrl: "",
      executiveWhatsapp: "17997727337",
      portalRequired: true,
      contactRequired: false,
    });
    expect(result.portalUrl).toBeNull();
    expect(result.blockers.length).toBe(1);
  });
});

describe("sufixo dinâmico do botão aprovado", () => {
  it("extrai apenas o complemento da base aprovada", () => {
    const result = buttonUrlSuffix("https://portal.velox/investidor/", "https://portal.velox/investidor/larissa");
    expect(result).toEqual({ ok: true, suffix: "larissa" });
  });

  it("recusa destino fora da base aprovada", () => {
    const result = buttonUrlSuffix("https://portal.velox/investidor/", "https://outro.site/x");
    expect(result.ok).toBe(false);
  });
});
