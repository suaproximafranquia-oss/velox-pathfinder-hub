import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTAL_MODULE_VISIBILITY,
  normalizePortalModuleVisibility,
} from "@/lib/portal-modules";

describe("visibilidade dos módulos do Portal Financeira", () => {
  it("usa os três módulos iniciais ativos e os três institucionais ocultos", () => {
    expect(DEFAULT_PORTAL_MODULE_VISIBILITY).toEqual({
      manual: true,
      universo: true,
      simulador: true,
      estrutura: false,
      revista: false,
      principios: false,
    });
  });

  it("preserva padrões ausentes e estados independentes gravados", () => {
    expect(normalizePortalModuleVisibility({ revista: true, manual: false })).toEqual({
      manual: false,
      universo: true,
      simulador: true,
      estrutura: false,
      revista: true,
      principios: false,
    });
  });
});