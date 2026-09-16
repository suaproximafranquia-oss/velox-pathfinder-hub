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
    expect(html).not.toContain(">Legenda<");
    expect(html).not.toContain("mux-player");
    expect(html).not.toContain("iframe");
  });

  it("trata Playback ID com somente espaços como vídeo ausente e mantém a legenda", () => {
    const html = renderToStaticMarkup(
      <PublicDigitalPresentation
        presentation={{ muxPlaybackId: "   ", introText: "Linha 1\nLinha 2" }}
      />,
    );
    expect(html).toContain("digital-presentation-placeholder");
    expect(html).toContain("Linha 1\nLinha 2");
    expect(html).not.toContain("mux-player");
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

  it("não renderiza bloco de legenda quando o texto está ausente", () => {
    const html = renderToStaticMarkup(
      <PublicDigitalPresentation presentation={{ muxPlaybackId: TEST_PLAYBACK_ID, introText: null }} />,
    );
    expect(html).toContain("mux-player");
    expect(html).not.toContain("whitespace-pre-line");
    expect(html).not.toContain(">Legenda<");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("usa a sede como fundo e oferece continuação direta para o Portal", () => {
    const html = renderToStaticMarkup(
      <PublicDigitalPresentation
        presentation={{ muxPlaybackId: TEST_PLAYBACK_ID, introText: "Linha extensa da legenda" }}
      />,
    );
    expect(html).toContain("velox-financeira-sede.png");
    expect(html).toContain('href="https://portalvelox.com.br/f"');
    expect(html).toContain("Continuar no Portal do Investidor");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("break-words");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).not.toContain(">Legenda<");
    expect(html).not.toContain("bg-navy/80");
    expect(html).not.toContain("backdrop-blur-md");
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
    expect(dialog).toContain("Legenda da apresentação");
    expect(dialog).not.toContain("Texto de contexto da apresentação");
    expect(dialog).toContain("Ambiente");
    expect(dialog).toContain("Financeira");
    expect(dialog).not.toContain("Solar");
    expect(dialog).not.toContain("Seguradora");
    expect(dialog).not.toContain("<MuxPlayer");
    expect(dialog).toContain("conviteVigenteParaPrevisualizacao");
    expect(dialog).toContain("window.open(result.linkUrl");
  });
});