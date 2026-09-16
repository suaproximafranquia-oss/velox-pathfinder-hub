import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  normalizeMuxPlaybackId,
  PublicDigitalPresentation,
} from "@/components/portal/public-digital-presentation";

const TEST_PLAYBACK_ID = "rR8P8mSaKDzz02TsftugTUdI00cQPJX00oy";

describe("Apresentação Digital com Mux", () => {
  it("considera a ausência de Playback ID um estado válido", () => {
    expect(normalizeMuxPlaybackId(null)).toBeNull();
    expect(normalizeMuxPlaybackId(undefined)).toBeNull();
    expect(normalizeMuxPlaybackId("   ")).toBeNull();
  });

  it("normaliza o Playback ID de teste sem transformá-lo em URL", () => {
    expect(normalizeMuxPlaybackId(` ${TEST_PLAYBACK_ID} `)).toBe(TEST_PLAYBACK_ID);
  });

  it("renderiza placeholder e contexto sem player ou iframe quando não há ID", () => {
    const html = renderToStaticMarkup(
      <PublicDigitalPresentation presentation={{ muxPlaybackId: null, introText: "Contexto" }} />,
    );
    expect(html).toContain("digital-presentation-placeholder");
    expect(html).toContain("Contexto");
    expect(html).not.toContain("mux-player");
    expect(html).not.toContain("iframe");
  });

  it("renderiza o player Mux com o Playback ID de teste", () => {
    const html = renderToStaticMarkup(
      <PublicDigitalPresentation
        presentation={{ muxPlaybackId: TEST_PLAYBACK_ID, introText: "Contexto" }}
      />,
    );
    expect(html).toContain("mux-player");
    expect(html).not.toContain("iframe");
    expect(normalizeMuxPlaybackId(TEST_PLAYBACK_ID)).toBe(TEST_PLAYBACK_ID);
  });

  it("mantém a Home apontando para a rota administrativa única", () => {
    const home = readFileSync("src/routes/f.executivo.home.tsx", "utf8");
    const modules = readFileSync("src/config/modules.ts", "utf8");
    expect(home).not.toContain("<DigitalPresentationDialog");
    expect(modules).toContain('id: "apresentacao-digital"');
    expect(modules).toContain('unitPath("/executivo/apresentacao-digital")');
  });

  it("remove Manual, capítulos e iframe do fluxo público do convite", () => {
    const route = readFileSync("src/routes/portal.convite.$token.tsx", "utf8");
    expect(route).toContain("<PublicDigitalPresentation");
    expect(route).not.toContain('m: "manual"');
    expect(route).not.toContain('to: "/f"');
    expect(route).not.toContain("<iframe");
    expect(route).not.toContain("Capítulo");
  });

  it("mantém a configuração administrativa sem player", () => {
    const dialog = readFileSync("src/components/executive/digital-presentation-dialog.tsx", "utf8");
    expect(dialog).toContain("Playback ID do vídeo Mux");
    expect(dialog).toContain("Ambiente");
    expect(dialog).toContain("Financeira");
    expect(dialog).not.toContain("Solar");
    expect(dialog).not.toContain("Seguradora");
    expect(dialog).not.toContain("<MuxPlayer");
    expect(dialog).toContain("conviteVigenteParaPrevisualizacao");
    expect(dialog).toContain("window.open(result.linkUrl");
  });
});