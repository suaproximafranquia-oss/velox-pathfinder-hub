/**
 * TESTE DE TEMPLATE — prévia de validação (browser only).
 *
 * Serve apenas para conferir alinhamentos, proporções, tipografia,
 * posição da fotografia, película azul e cortes de um template recém
 * enviado. Nunca gera arte definitiva nem registra histórico.
 */
import type { CreativeModel } from "./brand";
import { composeFromTemplate } from "./compose";
import { diagnose, type Diagnostic } from "./calibration";
import { getTemplate } from "./template-store";

export const TEST_CITY = "Ribeirão Preto";
export const TEST_STATE = "SP";

const TEST_COPY = {
  headline: "Sua nova unidade Velox",
  subheadline: "Crédito, seguros, consórcios e energia solar",
  supporting: "Fale com um executivo e conheça o modelo de franquia.",
};

/** Fotografia padrão de teste, desenhada localmente (sem rede). */
function testPhoto(): string {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 900;
  const ctx = c.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, 900);
  sky.addColorStop(0, "#8FB6D9");
  sky.addColorStop(1, "#E7EEF5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1200, 900);
  ctx.fillStyle = "#B9C6D3";
  for (let i = 0; i < 14; i += 1) {
    const w = 60 + ((i * 37) % 70);
    const h = 200 + ((i * 91) % 380);
    ctx.fillRect(i * 88, 900 - h, w, h);
    ctx.fillStyle = i % 2 ? "#9FB0C2" : "#C7D2DD";
  }
  ctx.fillStyle = "#6E8296";
  ctx.fillRect(0, 820, 1200, 80);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FOTOGRAFIA DE TESTE", 600, 470);
  return c.toDataURL("image/png");
}

export type TemplateTestResult = {
  /** PNG base64 (sem prefixo) da prévia. */
  preview: string;
  report: Diagnostic[];
};

export async function testTemplate(
  model: CreativeModel,
  options: { guide?: boolean } = {},
): Promise<TemplateTestResult> {
  const template = await getTemplate(model);
  if (!template) {
    throw new Error("Envie um template para este modelo antes de testar.");
  }
  const report: Diagnostic[] = template.config
    ? diagnose(model, template.config)
    : [{ level: "warn", message: "Não foi possível ler as dimensões do template" }];
  const preview = await composeFromTemplate({
    model,
    city: TEST_CITY,
    state: TEST_STATE,
    photoDataUrl: testPhoto(),
    // Guia tracejado de calibração: existe apenas na prévia.
    guide: options.guide ?? true,
    ...(model === "marketing" ? { copy: TEST_COPY } : {}),
  });
  return { preview, report };
}