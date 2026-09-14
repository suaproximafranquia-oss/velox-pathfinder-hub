import { describe, expect, it } from "vitest";
import {
  FINANCEIRA_PUBLIC_ORIGIN,
  financeiraPublicOrigin,
  financeiraPublicUrl,
  investorManualUrl,
  investorPortalUrl,
  normalizeFinanceiraPublicUrl,
} from "./portal-brands";

describe("domínio público oficial da Financeira", () => {
  it("usa o domínio oficial independentemente da origem da aplicação", () => {
    expect(financeiraPublicOrigin()).toBe(FINANCEIRA_PUBLIC_ORIGIN);
    expect(investorPortalUrl("ana", "financeira", "http://localhost:8080")).toBe(
      "https://portalvelox.com.br/f/ana?m=manual",
    );
    expect(
      investorPortalUrl(
        "ana",
        "financeira",
        "https://id-preview--projeto.lovable.app/f/executivo",
      ),
    ).toBe("https://portalvelox.com.br/f/ana?m=manual");
  });

  it("mantém caminhos e tokens de todas as URLs públicas", () => {
    expect(investorPortalUrl("ana")).toBe("https://portalvelox.com.br/f/ana?m=manual");
    expect(investorManualUrl("ana")).toBe("https://portalvelox.com.br/f/ana?m=manual");
    expect(financeiraPublicUrl("/portal/convite/token-exato-123")).toBe(
      "https://portalvelox.com.br/portal/convite/token-exato-123",
    );
    expect(financeiraPublicUrl("/manual")).toBe("https://portalvelox.com.br/manual");
    expect(financeiraPublicUrl("/universo")).toBe("https://portalvelox.com.br/universo");
    expect(financeiraPublicUrl("/f?simulador=1")).toBe(
      "https://portalvelox.com.br/f?simulador=1",
    );
  });

  it("mantém caminho e token mesmo quando o gerador é chamado no preview", () => {
    expect(
      financeiraPublicUrl("/portal/convite/codigo-sem-alteracao"),
    ).toBe("https://portalvelox.com.br/portal/convite/codigo-sem-alteracao");
  });

  it("troca apenas a origem de links públicos antigos já persistidos", () => {
    expect(
      normalizeFinanceiraPublicUrl(
        "https://velox-pathfinder-hub.lovable.app/portal/convite/token-original?origem=e5",
      ),
    ).toBe("https://portalvelox.com.br/portal/convite/token-original?origem=e5");
    expect(
      normalizeFinanceiraPublicUrl("https://cdn.exemplo.com/assets/manual-capa.jpg"),
    ).toBe("https://cdn.exemplo.com/assets/manual-capa.jpg");
  });
});