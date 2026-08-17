/**
 * COMANDO 3B §12 — testes de permissão individual de CRM/Portal dos Leads.
 */
import { describe, expect, it } from "vitest";
import {
  canViewConversationBackupOf,
  defaultModuleAccess,
  resolveConversationBackupAccess,
  resolveModuleAccess,
  type WorkspacePermissionMap,
} from "./workspace-permissions";

const A = "usr_a";
const B = "usr_b";
const HYBRID = "usr_thiago";

describe("CRM — ON/OFF individual", () => {
  it("A) CRM ON → usuário vê CRM", () => {
    expect(resolveModuleAccess({ [A]: { crm: true } }, A, "executivo", "crm")).toBe(true);
    // padrão também é ON
    expect(resolveModuleAccess({}, A, "executivo", "crm")).toBe(true);
  });
  it("B/C) CRM OFF → módulo e rota negados", () => {
    const map: WorkspacePermissionMap = { [A]: { crm: false } };
    expect(resolveModuleAccess(map, A, "executivo", "crm")).toBe(false);
  });
  it("D) CRM OFF → Backup de Conversas indisponível", () => {
    expect(resolveConversationBackupAccess({ [A]: { crm: false } }, A, "executivo")).toBe(false);
  });
  it("E) CRM ON → Backup de Conversas disponível", () => {
    expect(resolveConversationBackupAccess({ [A]: { crm: true } }, A, "executivo")).toBe(true);
  });
});

describe("Portal dos Leads — ON/OFF individual", () => {
  it("F) Portal ON → usuário vê Portal", () => {
    expect(resolveModuleAccess({ [A]: { portal_leads: true } }, A, "executivo", "portal_leads")).toBe(
      true,
    );
  });
  it("G/H) Portal OFF → módulo e rota negados", () => {
    expect(
      resolveModuleAccess({ [A]: { portal_leads: false } }, A, "executivo", "portal_leads"),
    ).toBe(false);
    // padrão do Colaborador continua sem Portal
    expect(resolveModuleAccess({}, A, "executivo", "portal_leads")).toBe(false);
  });
});

describe("Escopo do Backup de Conversas", () => {
  it("I) Colaborador vê somente o próprio", () => {
    expect(
      canViewConversationBackupOf({ actorRole: "executivo", actorId: A, ownerId: A }),
    ).toBe(true);
    expect(
      canViewConversationBackupOf({ actorRole: "executivo", actorId: A, ownerId: B }),
    ).toBe(false);
  });
  it("J) Gestora vê somente o próprio, salvo autorização temporária", () => {
    expect(canViewConversationBackupOf({ actorRole: "diretora", actorId: A, ownerId: B })).toBe(
      false,
    );
    expect(
      canViewConversationBackupOf({
        actorRole: "diretora",
        actorId: A,
        ownerId: B,
        temporaryGrant: true,
      }),
    ).toBe(true);
  });
  it("K) Administrador vê todos", () => {
    expect(canViewConversationBackupOf({ actorRole: "super_admin", actorId: A, ownerId: B })).toBe(
      true,
    );
  });
});

describe("Isolamento e preservação", () => {
  it("L) alterar A não altera B", () => {
    const map: WorkspacePermissionMap = { [A]: { crm: false } };
    expect(resolveModuleAccess(map, B, "executivo", "crm")).toBe(true);
  });
  it("M) híbrido preserva permissões especiais por padrão", () => {
    expect(defaultModuleAccess(HYBRID, "executivo", "portal_leads")).toBe(true);
    expect(resolveModuleAccess({}, HYBRID, "executivo", "portal_leads")).toBe(true);
  });
  it("N) troca de perfil não apaga a configuração individual", () => {
    const map: WorkspacePermissionMap = { [A]: { crm: false, portal_leads: true } };
    expect(resolveModuleAccess(map, A, "executivo", "crm")).toBe(false);
    expect(resolveModuleAccess(map, A, "diretora", "crm")).toBe(false);
    expect(resolveModuleAccess(map, A, "super_admin", "crm")).toBe(false);
    expect(resolveModuleAccess(map, A, "super_admin", "portal_leads")).toBe(true);
  });
});
