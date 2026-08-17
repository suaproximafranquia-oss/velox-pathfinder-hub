/**
 * COMANDO 3G §18 — testes de isolamento e autorização (positivos e negativos).
 */
import { describe, expect, it } from "vitest";
import { canReadHomologation, canReadRelationship } from "./authorization";
import { isHomologationLeadId } from "./recipient";

const exec = { isAdmin: false, isManager: false };

describe("produção — escopo por executivo responsável", () => {
  it("Executivo A lê o próprio lead", () => {
    expect(canReadRelationship({ scope: "production", ...exec, ownsLead: true })).toBe(true);
  });
  it("Executivo A NÃO lê lead do Executivo B", () => {
    expect(canReadRelationship({ scope: "production", ...exec, ownsLead: false })).toBe(false);
  });
  it("Executivo B NÃO lê lead do Executivo A", () => {
    expect(canReadRelationship({ scope: "production", ...exec, ownsLead: false })).toBe(false);
  });
  it("Administrador lê dados administrativos", () => {
    expect(
      canReadRelationship({ scope: "production", isAdmin: true, isManager: false, ownsLead: false }),
    ).toBe(true);
  });
});

describe("homologação — isolada da produção", () => {
  it("Executivo comum não lê homologação", () => {
    expect(canReadRelationship({ scope: "homologation", ...exec, ownsLead: true })).toBe(false);
    expect(canReadHomologation(exec)).toBe(false);
  });
  it("Gestão lê homologação", () => {
    expect(
      canReadRelationship({
        scope: "homologation",
        isAdmin: false,
        isManager: true,
        ownsLead: false,
      }),
    ).toBe(true);
  });
  it("rodada A não se mistura com rodada B", () => {
    const base = { scope: "homologation" as const, isAdmin: true, isManager: false, ownsLead: false };
    expect(canReadRelationship({ ...base, requestedRunId: "RUN-A", recordRunId: "RUN-A" })).toBe(
      true,
    );
    expect(canReadRelationship({ ...base, requestedRunId: "RUN-A", recordRunId: "RUN-B" })).toBe(
      false,
    );
  });
});

describe("classificação de destinatário", () => {
  it("TEST-* pertence apenas à homologação", () => {
    expect(isHomologationLeadId("TEST-0001")).toBe(true);
    expect(isHomologationLeadId("gs_9931")).toBe(false);
  });
});