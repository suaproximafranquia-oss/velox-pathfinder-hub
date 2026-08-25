/**
 * @vitest-environment jsdom
 *
 * INTERVENÇÃO DE ESTABILIDADE — prova do laço de requisições.
 *
 * O barramento avisa a PRÓPRIA aba. Quando o ouvinte reage relendo o
 * servidor e a releitura regrava o cache local, a gravação reavisava o
 * barramento: pull → grava → notifica → pull, indefinidamente. Este
 * teste fixa o contrato que interrompe o ciclo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifySync, onSync, runSyncMuted } from "@/lib/sync-bus";

describe("barramento de sincronização", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("entrega a notificação na própria aba (comportamento preservado)", () => {
    const listener = vi.fn();
    const off = onSync(listener, ["leads"]);
    notifySync("leads");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("não emite notificação durante uma escrita silenciada", () => {
    const listener = vi.fn();
    const off = onSync(listener, ["leads"]);
    runSyncMuted(() => notifySync("leads"));
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it("volta a notificar normalmente depois do espelho", () => {
    const listener = vi.fn();
    const off = onSync(listener, ["leads"]);
    runSyncMuted(() => notifySync("leads"));
    notifySync("leads");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("não entra em laço quando o ouvinte regrava o cache como espelho", () => {
    let pulls = 0;
    // Reproduz o ciclo real: onSync → pullLeads → replaceLeads(notifySync).
    const off = onSync(() => {
      pulls += 1;
      if (pulls > 50) throw new Error("laço infinito de requisições");
      runSyncMuted(() => notifySync("leads"));
    }, ["leads"]);

    notifySync("leads"); // uma alteração real de negócio

    expect(pulls).toBe(1); // exatamente uma leitura, sem realimentação
    off();
  });

  it("restaura o silenciamento mesmo se a escrita lançar erro", () => {
    const listener = vi.fn();
    const off = onSync(listener, ["leads"]);
    expect(() =>
      runSyncMuted(() => {
        throw new Error("falha de gravação");
      }),
    ).toThrow("falha de gravação");
    notifySync("leads");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});
