import { describe, expect, it } from "vitest";
import { pickRecipient } from "@/lib/portal/redistribution";
import { canOperateCentralUnica, canViewCentralUnica, workspaceScopesFor } from "@/lib/portal-workspace";

describe("COMANDO 4G — Central Única e redistribuição manual", () => {
  it("§2 somente a Gestora opera a Central Única", () => {
    expect(canOperateCentralUnica("usr_larissa", "diretora")).toBe(true);
    expect(canOperateCentralUnica("usr_thiago", "super_admin")).toBe(false);
    expect(canOperateCentralUnica("usr_paulo", "colaborador")).toBe(false);
  });

  it("§3 o Administrador enxerga a Central Única (auditoria)", () => {
    expect(canViewCentralUnica("usr_thiago", "super_admin")).toBe(true);
    expect(canViewCentralUnica("usr_paulo", "colaborador")).toBe(false);
  });

  it("§2 o perfil híbrido não possui Central Única", () => {
    expect(workspaceScopesFor("usr_thiago", "colaborador")).not.toContain("central_unica");
    expect(workspaceScopesFor("usr_larissa", "diretora")).toContain("central_unica");
  });

  it("§11 pula o próprio proprietário sem consumir o turno", () => {
    const pick = pickRecipient({ queue: ["a", "b", "c"], pointer: 1, currentOwnerId: "b" });
    expect(pick.recipientId).toBe("c");
    expect(pick.skipped).toEqual(["b"]);
    expect(pick.nextPointer).toBe(0);
  });
});
