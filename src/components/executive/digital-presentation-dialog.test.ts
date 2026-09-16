import { describe, expect, it } from "vitest";
import { presentationVideoSource } from "./digital-presentation-dialog";

describe("Apresentação Digital", () => {
  it("considera a ausência de videoUrl um estado válido", () => {
    expect(presentationVideoSource(null)).toBeNull();
    expect(presentationVideoSource(undefined)).toBeNull();
    expect(presentationVideoSource("   ")).toBeNull();
  });

  it("preserva uma futura URL de arquivo do storage/CDN", () => {
    expect(presentationVideoSource(" https://cdn.velox.test/apresentacao.mp4 ")).toBe(
      "https://cdn.velox.test/apresentacao.mp4",
    );
  });
});