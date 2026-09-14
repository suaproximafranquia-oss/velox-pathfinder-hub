import { describe, expect, it } from "vitest";
import {
  FINANCEIRA_PUBLIC_ORIGIN,
  financeiraPublicOrigin,
  financeiraPublicUrl,
  investorPortalUrl,
} from "./portal-brands";

describe("domínio público oficial da Financeira", () => {
  it("usa o domínio oficial no servidor e para qualquer host de produção", () => {
    expect(financeiraPublicOrigin()).toBe(FINANCEIRA_PUBLIC_ORIGIN);
    expect(financeiraPublicOrigin("https://velox-pathfinder-hub.lovable.app")).toBe(
      FINANCEIRA_PUBLIC_ORIGIN,
    );
    expect(financeiraPublicOrigin("https://outro-dominio-de-producao.example")).toBe(
      FINANCEIRA_PUBLIC_ORIGIN,
    );
  });

  it("preserva a origem local e de homologação", () => {
    expect(financeiraPublicOrigin("http://localhost:8080")).toBe("http://localhost:8080");
    expect(
      financeiraPublicOrigin("https://id-preview--projeto.lovable.app/f/executivo"),
    ).toBe("https://id-preview--projeto.lovable.app");
    expect(financeiraPublicOrigin("https://projeto-dev.lovable.app")).toBe(
      "https://projeto-dev.lovable.app",
    );
  });

  it("mantém caminhos e tokens de todas as URLs públicas", () => {
    expect(investorPortalUrl("ana")).toBe("https://portalvelox.com.br/f/ana");
    expect(financeiraPublicUrl("/portal/convite/token-exato-123")).toBe(
      "https://portalvelox.com.br/portal/convite/token-exato-123",
    );
    expect(financeiraPublicUrl("/manual")).toBe("https://portalvelox.com.br/manual");
    expect(financeiraPublicUrl("/universo")).toBe("https://portalvelox.com.br/universo");
    expect(financeiraPublicUrl("/f?simulador=1")).toBe(
      "https://portalvelox.com.br/f?simulador=1",
    );
  });

  it("mantém o mesmo caminho na homologação", () => {
    expect(
      financeiraPublicUrl("/portal/convite/codigo-sem-alteracao", "http://localhost:8080"),
    ).toBe("http://localhost:8080/portal/convite/codigo-sem-alteracao");
  });
});