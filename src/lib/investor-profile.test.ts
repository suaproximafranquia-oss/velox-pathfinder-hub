/**
 * Histórico da jornada — acontecimentos, nunca regravações de estado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const leads = [
  { id: "L1", createdAt: "2026-08-20T10:00:00.000Z", material: "manual", origin: "portal" },
];

vi.mock("@/lib/leads", () => ({ loadLeads: () => leads }));
vi.mock("@/lib/meetings", () => ({ listMeetings: () => [] }));
vi.mock("@/lib/pendings", () => ({ derivePendings: () => [] }));

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const { buildInvestorProfile } = await import("@/lib/investor-profile");
const { emitEvent, clearEvents } = await import("@/lib/events/bus");

describe("timeline do investidor", () => {
  beforeEach(() => {
    store.clear();
    clearEvents();
  });

  it("colapsa repetições do mesmo estado e mantém mudanças reais", () => {
    // Ruído legado: mesmo destino repetido várias vezes.
    for (let i = 0; i < 4; i += 1) {
      emitEvent({
        type: "lead.status.changed",
        investorId: "L1",
        at: `2026-08-27T23:41:2${i}.000Z`,
        payload: { to: "em_andamento" },
      });
    }
    // Mudança real posterior.
    emitEvent({
      type: "lead.status.changed",
      investorId: "L1",
      at: "2026-08-27T23:50:00.000Z",
      payload: { to: "encerrado" },
    });

    const timeline = buildInvestorProfile("L1").timeline;
    const status = timeline.filter((t) => t.title === "Status do Lead atualizado");
    expect(status).toHaveLength(2);
  });

  it("registra uma única entrada de Contato registrado", () => {
    const entries = buildInvestorProfile("L1").timeline.filter(
      (t) => t.title === "Contato registrado",
    );
    expect(entries).toHaveLength(1);
  });
});
