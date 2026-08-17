/** COMANDO 1A §11 — regras visuais da conversa (lado, avatar, botões). */
import { describe, expect, it } from "vitest";
import type { CrmMessage } from "./messages";
import { buildThreadRows, sanitizeThreadBody, threadInitials } from "./thread-view";

function msg(over: Partial<CrmMessage>): CrmMessage {
  return {
    id: "m1",
    investorId: "TEST-0001",
    direction: "enviada",
    body: "Olá",
    at: "2026-08-17T12:00:00.000Z",
    authorId: "EXECUTIVE",
    ...over,
  };
}

const EXEC = { name: "Thiago Rodrigues", photoUrl: "https://exemplo.invalido/foto.jpg" };
const INVESTOR = { name: "Marina Alves", photoUrl: "https://exemplo.invalido/marina.jpg" };

describe("conversa do CRM — posicionamento e avatar", () => {
  it("A) mensagem do Executivo fica à direita com o avatar do Executivo", () => {
    const [row] = buildThreadRows([msg({})], { self: EXEC, peer: INVESTOR });
    expect(row!.side).toBe("right");
    expect(row!.author).toBe("self");
    expect(row!.avatar?.photoUrl).toBe(EXEC.photoUrl);
    expect(row!.avatar?.name).toBe("Thiago Rodrigues");
  });

  it("B) mensagem do Investidor fica à esquerda com o avatar do Investidor", () => {
    const [row] = buildThreadRows(
      [msg({ direction: "recebida", authorId: "INVESTOR" })],
      { self: EXEC, peer: INVESTOR },
    );
    expect(row!.side).toBe("left");
    expect(row!.author).toBe("peer");
    expect(row!.avatar?.photoUrl).toBe(INVESTOR.photoUrl);
  });

  it("C) sem foto do Executivo, o avatar cai na inicial", () => {
    const [row] = buildThreadRows([msg({})], {
      self: { name: "Thiago Rodrigues" },
      peer: INVESTOR,
    });
    expect(row!.avatar?.photoUrl).toBeUndefined();
    expect(row!.avatar?.initials).toBe("TR");
  });

  it("D) sem foto do Investidor, o avatar cai na inicial", () => {
    const [row] = buildThreadRows(
      [msg({ direction: "recebida", authorId: "INVESTOR" })],
      { self: EXEC, peer: { name: "Marina" } },
    );
    expect(row!.avatar?.photoUrl).toBeUndefined();
    expect(row!.avatar?.initials).toBe("M");
    expect(threadInitials("")).toBe("?");
  });

  it("E) mensagem com botão preserva o botão e não expõe a URL no texto", () => {
    const url = "https://portal.invalido/f/thiago-rodrigues";
    const row = buildThreadRows(
      [
        msg({
          body: `Preparei um espaço para você.\n${url}\nAté já!`,
          button: { label: "Acessar Portal do Investidor", url },
        }),
      ],
      { self: EXEC, peer: INVESTOR },
    )[0]!;
    expect(row.message.button?.url).toBe(url);
    expect(row.body).not.toContain(url);
    expect(row.body).toContain("Preparei um espaço");
    expect(sanitizeThreadBody({ body: "sem link", button: null })).toBe("sem link");
  });

  it("F) homologação: autor define lado e avatar, sem componente paralelo", () => {
    const rows = buildThreadRows(
      [
        msg({ id: "a", authorId: "EXECUTIVE" }),
        msg({ id: "b", direction: "recebida", authorId: "INVESTOR" }),
        msg({ id: "c", authorId: "SYSTEM", body: "Janela encerrada." }),
      ],
      { self: EXEC, peer: { name: "TEST-0047" } },
    );
    expect(rows.map((r) => r.side)).toEqual(["right", "left", "right"]);
    expect(rows[2]!.author).toBe("system");
    expect(rows[2]!.avatar).toBeNull();
    expect(rows[1]!.avatar?.initials).toBe("T");
  });

  it("agrupa mensagens consecutivas e só mostra o avatar no fim do bloco", () => {
    const rows = buildThreadRows(
      [msg({ id: "a" }), msg({ id: "b" }), msg({ id: "c", direction: "recebida", authorId: "INVESTOR" })],
      { self: EXEC, peer: INVESTOR },
    );
    expect(rows.map((r) => r.showAvatar)).toEqual([false, true, true]);
  });

  it("G) mobile: o corpo permanece íntegro e o botão continua disponível", () => {
    const url = "https://www.instagram.com/p/DcJcA7GA9g-/";
    const row = buildThreadRows(
      [
        msg({
          body: `Separei um conteúdo curto sobre como avaliar uma franquia.\n${url}`,
          button: { label: "Assistir conteúdo", url },
        }),
      ],
      { self: EXEC, peer: INVESTOR },
    )[0]!;
    expect(row.body.split("\n").every((l) => !l.includes("http"))).toBe(true);
    expect(row.message.button?.label).toBe("Assistir conteúdo");
  });
});
