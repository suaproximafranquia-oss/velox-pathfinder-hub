import { describe, expect, it, vi } from "vitest";
import { loadMessageForModal } from "./daily-action-message";
import { composeMessageBody } from "@/lib/relationship/messages";

const official = {
  step: "E3",
  body: "Mensagem oficial",
  blockedReason: null,
  libraryVersion: 7,
  investorNameUsed: "Ana",
  executiveName: "Executivo",
  contentName: null,
  contentUrl: null,
};

describe("modal compartilhado de mensagem", () => {
  it("abre com a versão carregada mesmo quando o clipboard falha", async () => {
    const load = vi.fn(async () => official);
    const copy = vi.fn(async () => false);
    await expect(loadMessageForModal(load, copy)).resolves.toEqual({
      message: official,
      open: true,
      copied: false,
    });
    expect(load).toHaveBeenCalledOnce();
    expect(copy).toHaveBeenCalledWith("Mensagem oficial");
  });

  it("não congela a versão: cada abertura consulta novamente a fonte", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(official)
      .mockResolvedValueOnce({ ...official, body: "Mensagem atualizada", libraryVersion: 8 });
    const copy = vi.fn(async () => true);
    expect((await loadMessageForModal(load, copy)).message?.libraryVersion).toBe(7);
    expect((await loadMessageForModal(load, copy)).message?.libraryVersion).toBe(8);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("mantém a composição da URL idempotente", () => {
    const url = "https://portal.velox.test/investidor";
    expect(composeMessageBody(`Leia: ${url}`, { url })).toBe(`Leia: ${url}`);
    expect(composeMessageBody("Leia o material", { url })).toBe(`Leia o material\n\n${url}`);
  });
});