import { describe, expect, it, vi } from "vitest";
import { loadMessageForModal } from "./daily-action-message";
import { composeMessageBody, renderMessageSpec } from "@/lib/relationship/messages";

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
    const open = vi.fn();
    const copy = vi.fn(async () => false);
    await expect(loadMessageForModal(load, open, copy)).resolves.toEqual({
      message: official,
      open: true,
      copied: false,
    });
    expect(load).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(official);
    expect(copy).toHaveBeenCalledWith("Mensagem oficial");
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(copy.mock.invocationCallOrder[0]);
  });

  it("abre antes da única cópia automática bem-sucedida", async () => {
    const order: string[] = [];
    const open = vi.fn(() => order.push("open"));
    const copy = vi.fn(async () => {
      order.push("copy");
      return true;
    });

    await expect(loadMessageForModal(async () => official, open, copy)).resolves.toMatchObject({
      open: true,
      copied: true,
    });
    expect(order).toEqual(["open", "copy"]);
    expect(copy).toHaveBeenCalledOnce();
  });

  it("permite uma segunda tentativa manual sem concluir a ação", async () => {
    const copy = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const conclude = vi.fn();

    const state = await loadMessageForModal(async () => official, vi.fn(), copy);
    expect(state.copied).toBe(false);
    await expect(copy(state.message?.body)).resolves.toBe(true);
    expect(copy).toHaveBeenCalledTimes(2);
    expect(conclude).not.toHaveBeenCalled();
  });

  it("não congela a versão: cada abertura consulta novamente a fonte", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(official)
      .mockResolvedValueOnce({ ...official, body: "Mensagem atualizada", libraryVersion: 8 });
    const open = vi.fn();
    const copy = vi.fn(async () => true);
    expect((await loadMessageForModal(load, open, copy)).message?.libraryVersion).toBe(7);
    expect((await loadMessageForModal(load, open, copy)).message?.libraryVersion).toBe(8);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("mantém a composição da URL idempotente", () => {
    const url = "https://portal.velox.test/investidor";
    expect(composeMessageBody(`Leia: ${url}`, { url })).toBe(`Leia: ${url}`);
    expect(composeMessageBody("Leia o material", { url })).toBe(`Leia o material\n\n${url}`);
  });

  it("trata o body publicado como conteúdo completo sem exigir content_url", () => {
    const body = "Olá, João!\n\nhttps://exemplo.com/material";
    const result = renderMessageSpec(
      {
        step: "E1",
        text: body,
        usesInvestorName: false,
        button: "content",
        contentGroup: "E1",
        contentUrl: null,
        contentLabel: null,
        bodyIsSourceOfTruth: true,
      },
      { executiveName: "Executivo", portalLink: "" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe(body);
    expect(result.button).toBeNull();
  });

  it("aceita body sem URL e não injeta metadados antigos", () => {
    const result = renderMessageSpec(
      {
        step: "E1",
        text: "Mensagem somente em texto",
        usesInvestorName: false,
        button: "content",
        contentGroup: "E1",
        contentUrl: "https://legado.example/material",
        contentLabel: "Link legado",
        bodyIsSourceOfTruth: true,
      },
      { executiveName: "Executivo", portalLink: "" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe("Mensagem somente em texto");
    expect(result.button).toBeNull();
  });

  it("não interpreta marcador legado de conteúdo na Biblioteca", () => {
    const body = "Confira o material:\n\n{{conteudo_e1}}";
    const result = renderMessageSpec(
      {
        step: "E1",
        text: body,
        usesInvestorName: false,
        button: "content",
        contentGroup: "E1",
        contentUrl: null,
        bodyIsSourceOfTruth: true,
      },
      { executiveName: "Executivo", portalLink: "" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe(body);
    expect(result.button).toBeNull();
  });
});