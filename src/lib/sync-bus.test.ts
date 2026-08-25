/**
 * INTERVENÇÃO DE ESTABILIDADE — prova do laço de requisições.
 *
 * O barramento avisa a PRÓPRIA aba. Quando o ouvinte reage relendo o
 * servidor e a releitura regrava o cache local, a gravação reavisava o
 * barramento: pull → grava → notifica → pull, indefinidamente. Este
 * teste fixa o contrato que interrompe o ciclo.
 *
 * O ambiente de teste é Node puro (sem jsdom): montamos apenas as peças
 * de navegador que o barramento realmente utiliza.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

type Listener = (event: unknown) => void;

let notifySync: typeof import("@/lib/sync-bus").notifySync;
let onSync: typeof import("@/lib/sync-bus").onSync;
let runSyncMuted: typeof import("@/lib/sync-bus").runSyncMuted;

beforeAll(async () => {
  const listeners = new Map<string, Set<Listener>>();
  const store = new Map<string, string>();
  const win = {
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event: { type: string }) {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return true;
    },
    localStorage: {
      setItem: (k: string, v: string) => void store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
      clear: () => store.clear(),
    },
  };
  // `CustomEvent` só precisa carregar `type` e `detail`.
  class CustomEventStub {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  Object.assign(globalThis, { window: win, CustomEvent: CustomEventStub });

  const mod = await import("@/lib/sync-bus");
  notifySync = mod.notifySync;
  onSync = mod.onSync;
  runSyncMuted = mod.runSyncMuted;
});

describe("barramento de sincronização", () => {
  beforeEach(() => {
    (globalThis as { window: { localStorage: { clear(): void } } }).window.localStorage.clear();
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
