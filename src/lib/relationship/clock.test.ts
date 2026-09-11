import { describe, expect, it } from "vitest";
import { createVirtualClock } from "./clock";

describe("relógio da validação temporal controlada", () => {
  it("converte cinco minutos reais em um dia lógico com fator 288", () => {
    const clock = createVirtualClock(
      {
        startedAtReal: "2026-09-10T12:00:00.000Z",
        startedAtVirtual: "2026-09-10T12:00:00.000Z",
        factor: 288,
      },
      () => new Date("2026-09-10T12:05:00.000Z"),
    );
    expect(clock.nowIso()).toBe("2026-09-11T12:00:00.000Z");
  });

  it("congela no instante lógico de encerramento", () => {
    const clock = createVirtualClock(
      {
        startedAtReal: "2026-09-10T12:00:00.000Z",
        startedAtVirtual: "2026-09-10T12:00:00.000Z",
        frozenAtVirtual: "2026-09-12T15:30:00.000Z",
        factor: 288,
      },
      () => new Date("2026-09-20T12:00:00.000Z"),
    );
    expect(clock.nowIso()).toBe("2026-09-12T15:30:00.000Z");
  });

  it("retoma em 720x sem contabilizar o tempo real transcorrido durante a pausa", () => {
    const frozenAtVirtual = "2026-09-12T15:30:00.000Z";
    const resumed = createVirtualClock(
      {
        startedAtReal: "2026-09-20T12:00:00.000Z",
        startedAtVirtual: frozenAtVirtual,
        frozenAtVirtual: null,
        factor: 720,
      },
      () => new Date("2026-09-20T12:02:00.000Z"),
    );
    expect(resumed.nowIso()).toBe("2026-09-13T15:30:00.000Z");
  });
});