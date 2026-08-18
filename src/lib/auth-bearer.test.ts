// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Autenticação server-first: nenhuma chamada pode sair sem Authorization
 * quando existe sessão de workspace neste navegador.
 */
const getSession = vi.fn();
const ensureCloudSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));
vi.mock("@/lib/executive-auth", () => ({
  ensureCloudSession: () => ensureCloudSession(),
}));

async function freshModule() {
  vi.resetModules();
  return await import("./auth-bearer");
}

describe("token de acesso do Portal", () => {
  beforeEach(() => {
    getSession.mockReset();
    ensureCloudSession.mockReset();
  });

  it("usa o token existente sem reabrir sessão", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } } });
    const { getAccessToken } = await freshModule();
    expect(await getAccessToken()).toBe("tok-1");
    expect(ensureCloudSession).not.toHaveBeenCalled();
  });

  it("reabre a sessão real quando o navegador só tem a sessão do workspace", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({ data: { session: { access_token: "tok-2" } } });
    ensureCloudSession.mockResolvedValue(true);
    const { getAccessToken } = await freshModule();
    expect(await getAccessToken()).toBe("tok-2");
    expect(ensureCloudSession).toHaveBeenCalledTimes(1);
  });

  it("não finge sucesso quando o backend recusa a sessão", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    ensureCloudSession.mockResolvedValue(false);
    const { getAccessToken } = await freshModule();
    expect(await getAccessToken()).toBeNull();
  });

  it("não dispara reaberturas concorrentes", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({ data: { session: { access_token: "tok-3" } } });
    ensureCloudSession.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 5)),
    );
    const { getAccessToken } = await freshModule();
    const [a, b] = await Promise.all([getAccessToken(), getAccessToken()]);
    expect(a).toBe("tok-3");
    expect(b).toBe("tok-3");
    expect(ensureCloudSession).toHaveBeenCalledTimes(1);
  });
});
