import { describe, expect, it } from "vitest";
import { executiveShortPortalUrl } from "./executive-portal-link.functions";

describe("link curto individual do executivo", () => {
  it("gera aliases próprios, estáveis e distintos", () => {
    expect(executiveShortPortalUrl("thiago-rodrigues")).toBe("https://portalvelox.com.br/f/thiago-rodrigues");
    expect(executiveShortPortalUrl("larissa")).toBe("https://portalvelox.com.br/f/larissa");
    expect(executiveShortPortalUrl("thiago-rodrigues")).not.toBe(executiveShortPortalUrl("larissa"));
    expect(executiveShortPortalUrl("Thiago Rodrigues")).toBe(executiveShortPortalUrl("thiago-rodrigues"));
  });

  it("recusa aliases vazios ou reservados", () => {
    expect(executiveShortPortalUrl("")).toBeNull();
    expect(executiveShortPortalUrl("executivo")).toBeNull();
  });
});