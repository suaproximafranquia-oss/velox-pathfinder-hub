import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  selectedColumns: "",
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      if (table !== "environment_presentations") {
        throw new Error(`Tabela inesperada: ${table}`);
      }
      const query = {
        select(columns: string) {
          database.selectedColumns = columns;
          return query;
        },
        eq(column: string, value: unknown) {
          database.filters.push([column, value]);
          return query;
        },
        maybeSingle: async () => ({ data: database.row, error: null }),
      };
      return query;
    },
  },
}));

describe("apresentação pública da Financeira", () => {
  beforeEach(() => {
    database.row = null;
    database.selectedColumns = "";
    database.filters = [];
  });

  it("transporta Playback ID e legenda da apresentação publicada", async () => {
    database.row = {
      environment: "financeira",
      intro_text: "TESTE DE LEGENDA DA APRESENTAÇÃO DIGITAL",
      video_url: "https://legado.example/video.mp4",
      mux_playback_id: "T8aSLNEb9jVG00jFtxp7kDFmbB5g01tBI7s1ZH99FBRIU",
      is_published: true,
      published_at: "2026-09-16T03:00:00.000Z",
      updated_at: "2026-09-16T03:00:00.000Z",
    };

    const { getPublishedFinancePresentation } = await import(
      "./environment-presentation.server"
    );
    const presentation = await getPublishedFinancePresentation();

    expect(database.filters).toEqual([
      ["environment", "financeira"],
      ["is_published", true],
    ]);
    expect(database.selectedColumns).toContain("mux_playback_id");
    expect(database.selectedColumns).toContain("intro_text");
    expect(presentation).toMatchObject({
      environment: "financeira",
      muxPlaybackId: "T8aSLNEb9jVG00jFtxp7kDFmbB5g01tBI7s1ZH99FBRIU",
      introText: "TESTE DE LEGENDA DA APRESENTAÇÃO DIGITAL",
      isPublished: true,
    });
    expect(presentation).not.toHaveProperty("videoUrl");
  });

  it("não expõe uma apresentação sem linha publicada", async () => {
    const { getPublishedFinancePresentation } = await import(
      "./environment-presentation.server"
    );
    await expect(getPublishedFinancePresentation()).resolves.toBeNull();
  });
});