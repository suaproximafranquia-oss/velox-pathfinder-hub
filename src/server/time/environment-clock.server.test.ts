import { beforeEach, describe, expect, it, vi } from "vitest";

type ClockRow = {
  id: string;
  status: string;
  started_at: string;
  scenarios: Record<string, unknown>;
};

let row: ClockRow;

const validationRows = ["59034", "59037", "59081", "59279"].map((external_id) => ({ external_id }));

function result(data: unknown) {
  return Promise.resolve({ data, error: null });
}

function from(table: string) {
  if (table === "portal_leads") {
    const query = {
      select: () => query,
      eq: () => query,
      is: () => result(validationRows),
    };
    return query;
  }

  if (table !== "test_batches") throw new Error(`Tabela inesperada: ${table}`);
  return {
    select() {
      const query = {
        eq: () => query,
        maybeSingle: () => result({ ...row, scenarios: { ...row.scenarios } }),
      };
      return query;
    },
    update(payload: Partial<ClockRow>) {
      let expectedStatus: string | null = null;
      const query = {
        eq(column: string, value: string) {
          if (column === "status") expectedStatus = value;
          return query;
        },
        select: () => query,
        maybeSingle: () => {
          if (expectedStatus && row.status !== expectedStatus) return result(null);
          row = {
            ...row,
            ...payload,
            scenarios: payload.scenarios ? { ...payload.scenarios } : row.scenarios,
          } as ClockRow;
          return result({ id: row.id });
        },
      };
      return query;
    },
  };
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
vi.mock("@/server/relationship/controlled-test.server", () => ({
  CONTROLLED_LEADS: validationRows.map(({ external_id }) => ({ leadId: `gs_${external_id}`, name: external_id })),
}));

describe("relógio ambiental /f", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T12:02:00.000Z"));
    row = {
      id: "environment-clock-f",
      status: "ATIVO",
      started_at: "2026-09-11T12:00:00.000Z",
      scenarios: {
        factor: 720,
        startedAtReal: "2026-09-11T12:00:00.000Z",
        startedAtVirtual: "2026-09-11T12:00:00.000Z",
        frozenAtVirtual: null,
      },
    };
  });

  it("pausa, congela e mantém segunda pausa como no-op", async () => {
    const { envNowIso, pauseEnvironmentClock } = await import("./environment-clock.server");
    const paused = await pauseEnvironmentClock();
    expect(paused.mode).toBe("paused");
    expect(paused.frozenAtVirtual).toBe("2026-09-12T12:00:00.000Z");

    vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));
    expect(envNowIso()).toBe("2026-09-12T12:00:00.000Z");
    const repeated = await pauseEnvironmentClock();
    expect(repeated.frozenAtVirtual).toBe(paused.frozenAtVirtual);
  });

  it("continua da âncora congelada sem contabilizar a pausa", async () => {
    const { envNowIso, pauseEnvironmentClock, resumeEnvironmentClock } = await import("./environment-clock.server");
    await pauseEnvironmentClock();
    vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));

    const resumed = await resumeEnvironmentClock();
    expect(resumed.mode).toBe("running");
    expect(resumed.logicalNowIso).toBe("2026-09-12T12:00:00.000Z");

    vi.setSystemTime(new Date("2026-09-20T12:02:00.000Z"));
    expect(envNowIso()).toBe("2026-09-13T12:00:00.000Z");
    const repeated = await resumeEnvironmentClock();
    expect(repeated.startedAtReal).toBe("2026-09-20T12:00:00.000Z");
  });

  it("mantém estado consistente em chamadas concorrentes", async () => {
    const { pauseEnvironmentClock, resumeEnvironmentClock } = await import("./environment-clock.server");
    const pauses = await Promise.all([pauseEnvironmentClock(), pauseEnvironmentClock()]);
    expect(pauses.every((state) => state.mode === "paused")).toBe(true);
    expect(row.status).toBe("PAUSADO");

    const resumes = await Promise.all([resumeEnvironmentClock(), resumeEnvironmentClock()]);
    expect(resumes.every((state) => state.mode === "running")).toBe(true);
    expect(row.status).toBe("ATIVO");
    expect(row.scenarios.frozenAtVirtual).toBeNull();
  });
});