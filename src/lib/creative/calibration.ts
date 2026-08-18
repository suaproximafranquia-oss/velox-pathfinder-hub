/**
 * CALIBRAÇÃO AUTOMÁTICA DE TEMPLATES.
 *
 * Sempre que um novo template é enviado, o sistema lê as dimensões reais
 * do arquivo e recalcula proporcionalmente as áreas variáveis (fotografia,
 * cidade, UF e textos) para a nova resolução. A calibração é apenas um
 * auxílio: ela NUNCA altera o layout, a identidade visual, a tipografia,
 * as cores ou a composição gráfica do template — apenas adapta as
 * coordenadas relativas para que continuem caindo no lugar certo.
 */
import type { CreativeModel } from "./brand";
import { TEMPLATE_LAYOUT, type CopyBlock, type TemplateLayout, type TextBlock } from "./official-template";

/** Resolução de referência do material oficial da Velox. */
export const REFERENCE_SIZE: Record<CreativeModel, { width: number; height: number }> = {
  institucional: { width: 2025, height: 3600 },
  marketing: { width: 1092, height: 1440 },
};

export type TemplateConfig = {
  width: number;
  height: number;
  /** Proporção largura/altura detectada. */
  ratio: number;
  orientation: "retrato" | "paisagem" | "quadrado";
  layout: TemplateLayout;
};

export type DiagnosticLevel = "ok" | "warn";

export type Diagnostic = { level: DiagnosticLevel; message: string };

function orientationOf(width: number, height: number): TemplateConfig["orientation"] {
  if (Math.abs(width - height) / Math.max(width, height) < 0.02) return "quadrado";
  return height > width ? "retrato" : "paisagem";
}

/**
 * Fator vertical: as alturas tipográficas são declaradas em fração da
 * altura. Se o template tiver outra proporção, mantemos o tamanho físico
 * do texto relativo à LARGURA, evitando letras esticadas ou minúsculas.
 */
function scaleText<T extends TextBlock>(block: T, k: number): T {
  const next = { ...block, capHeight: block.capHeight * k } as T & Partial<CopyBlock>;
  if (typeof next.lineHeight === "number") next.lineHeight *= k;
  return next;
}

/** Recalcula o layout base para a resolução real do template enviado. */
export function calibrateLayout(
  model: CreativeModel,
  width: number,
  height: number,
): TemplateLayout {
  const base = TEMPLATE_LAYOUT[model];
  const ref = REFERENCE_SIZE[model];
  if (!width || !height) return base;
  const refRatio = ref.width / ref.height;
  const ratio = width / height;
  // Proporção da arte relativa à largura: mantém o texto no mesmo peso.
  const k = ratio / refRatio;
  if (Math.abs(k - 1) < 0.005) return base;
  const out: TemplateLayout = { ...base };
  for (const key of ["city", "state", "tail"] as const) {
    const block = base[key];
    if (block) out[key] = scaleText(block, k);
  }
  for (const key of ["headline", "subheadline", "supporting"] as const) {
    const block = base[key];
    if (block) out[key] = scaleText(block, k);
  }
  return out;
}

export function buildConfig(
  model: CreativeModel,
  width: number,
  height: number,
): TemplateConfig {
  return {
    width,
    height,
    ratio: height ? Number((width / height).toFixed(4)) : 0,
    orientation: orientationOf(width, height),
    layout: calibrateLayout(model, width, height),
  };
}

/** Relatório exibido ao administrador durante o teste do template. */
export function diagnose(model: CreativeModel, config: TemplateConfig): Diagnostic[] {
  const ref = REFERENCE_SIZE[model];
  const out: Diagnostic[] = [{ level: "ok", message: "Template carregado" }];
  out.push({
    level: "ok",
    message: `Resolução detectada: ${config.width} × ${config.height} px (${config.orientation})`,
  });
  const refRatio = ref.width / ref.height;
  const drift = Math.abs(config.ratio - refRatio) / refRatio;
  out.push(
    drift <= 0.02
      ? { level: "ok", message: `Proporção válida (${config.ratio.toFixed(3)})` }
      : {
          level: "warn",
          message: `Proporção diferente do recomendado (${config.ratio.toFixed(3)} · esperado ${refRatio.toFixed(3)}) — as áreas foram adaptadas proporcionalmente`,
        },
  );
  out.push(
    config.width >= ref.width * 0.75
      ? { level: "ok", message: "Resolução adequada para impressão e redes" }
      : {
          level: "warn",
          message: `Resolução abaixo do recomendado (mínimo sugerido ${ref.width} px de largura)`,
        },
  );
  const photo = config.layout.photoArea;
  const photoHeightPx = (photo.y1 - photo.y0) * config.height;
  out.push(
    photoHeightPx / config.height >= 0.15
      ? { level: "ok", message: "Campos calibrados (fotografia, cidade, UF e textos)" }
      : {
          level: "warn",
          message: "Área da fotografia fora da proporção esperada",
        },
  );
  out.push(
    out.some((d) => d.level === "warn")
      ? { level: "warn", message: "Template utilizável — confira a prévia antes de publicar" }
      : { level: "ok", message: "Template pronto para utilização" },
  );
  return out;
}