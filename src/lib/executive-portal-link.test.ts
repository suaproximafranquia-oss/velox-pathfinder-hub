import { readFileSync } from "node:fs";
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

  it("resolve o alias no servidor e preserva a entrada oficial no Manual", () => {
    const route = readFileSync(new URL("../routes/f.$slug.tsx", import.meta.url), "utf8");
    expect(route).toContain("resolveExecutivePortalAlias");
    expect(route).toContain('m: "manual"');
    expect(route).toContain("executive.slug");
    expect(route).not.toMatch(/E0|relationship_queue|GreenSales|createLead/);
  });

  it("liga a cópia à identidade autenticada, sem slug recebido do navegador", () => {
    const source = readFileSync(new URL("./executive-portal-link.functions.ts", import.meta.url), "utf8");
    expect(source).toContain("requireSupabaseAuth");
    expect(source).toContain("resolveServerIdentity(context.userId)");
    expect(source).not.toContain("data.slug").toBe(false);
  });
});