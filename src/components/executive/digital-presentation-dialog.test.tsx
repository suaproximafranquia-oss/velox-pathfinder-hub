import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PresentationVideo, presentationVideoSource } from "./digital-presentation-dialog";

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

  it("renderiza o placeholder sem iframe ou tentativa de vídeo vazio", () => {
    const html = renderToStaticMarkup(<PresentationVideo videoUrl={null} title="Apresentação" />);
    expect(html).toContain("digital-presentation-placeholder");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<video");
  });

  it("renderiza uma futura URL própria no player nativo", () => {
    const html = renderToStaticMarkup(
      <PresentationVideo videoUrl="https://cdn.velox.test/apresentacao.mp4" title="Apresentação" />,
    );
    expect(html).toContain("<video");
    expect(html).toContain("https://cdn.velox.test/apresentacao.mp4");
    expect(html).not.toContain("<iframe");
  });

  it("usa o mesmo componente no menu interno e no cartão da Workspace", () => {
    const route = readFileSync("src/routes/f.executivo.apresentacao-digital.tsx", "utf8");
    const home = readFileSync("src/routes/f.executivo.home.tsx", "utf8");
    expect(route).toContain("<DigitalPresentationDialog");
    expect(home).toContain("<DigitalPresentationDialog");
    expect(home).not.toContain('to: "/manual"');
  });
});