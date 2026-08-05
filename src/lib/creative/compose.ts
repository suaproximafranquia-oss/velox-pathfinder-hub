/**
 * MOTOR DE COMPOSIÇÃO DETERMINÍSTICA (browser only).
 *
 * Um único motor atende os dois modelos. Ele abre o template gráfico do
 * modelo, reproduz o arquivo pixel a pixel e substitui apenas os campos
 * variáveis declarados no layout: fotografia da cidade, nome da cidade,
 * UF, o complemento "AGORA EM <CIDADE> - <UF>" e — no Modelo B — os
 * textos publicitários produzidos pela IA. Nenhum elemento gráfico é
 * recriado, reposicionado ou reinventado.
 */
import type { CreativeModel } from "./brand";
import {
  TEMPLATE_FONT,
  TEMPLATE_LAYOUT,
  type CopyBlock,
  type TemplateLayout,
  type TextBlock,
  stateName,
} from "./official-template";
import { getTemplate } from "./template-store";

type Area = { x: number; y: number; w: number; h: number };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = src;
  });
}

/** Recorte "cover": preenche a área sem distorcer nem deixar borda. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, area: Area) {
  const scale = Math.max(area.w / img.naturalWidth, area.h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  ctx.drawImage(img, area.x + (area.w - dw) / 2, area.y + (area.h - dh) / 2, dw, dh);
  ctx.restore();
}

function readArea(base: HTMLImageElement, area: Area): ImageData {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(area.w));
  c.height = Math.max(1, Math.round(area.h));
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(base, area.x, area.y, area.w, area.h, 0, 0, c.width, c.height);
  return cx.getImageData(0, 0, c.width, c.height);
}

/** Cor do template em cada linha — é ela que define a película azul. */
function rowColors(data: ImageData): [number, number, number][] {
  const { width, height } = data;
  const edge = Math.max(1, Math.round(width * 0.04));
  const rows: [number, number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let x = 0; x < width; x += 1) {
      if (x >= edge && x < width - edge) continue;
      const i = (y * width + x) * 4;
      r += data.data[i]!;
      g += data.data[i + 1]!;
      b += data.data[i + 2]!;
      n += 1;
    }
    rows.push([r / n, g / n, b / n]);
  }
  return rows;
}

/** Recorta um elemento gráfico do template descartando o fundo. */
function extractOverlay(data: ImageData, rows: [number, number, number][]): HTMLCanvasElement {
  const { width, height } = data;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const cx = out.getContext("2d")!;
  const img = cx.createImageData(width, height);
  const fx = Math.max(1, width * 0.05);
  const fy = Math.max(1, height * 0.05);
  for (let y = 0; y < height; y += 1) {
    const [br, bg, bb] = rows[y]!;
    const fadeY = Math.min(1, Math.min(y, height - 1 - y) / fy);
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data.data[i]!;
      const g = data.data[i + 1]!;
      const b = data.data[i + 2]!;
      const diff = Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb));
      const raw = diff <= 16 ? 0 : diff >= 48 ? 1 : (diff - 16) / 32;
      const fade = Math.min(fadeY, Math.min(x, width - 1 - x) / fx);
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(raw * fade * 255);
    }
  }
  cx.putImageData(img, 0, 0);
  return out;
}

/**
 * Película azul: a cor de cada linha vem do próprio template e a
 * opacidade cresce continuamente até fundir-se com o azul institucional.
 * Não existe linha de corte entre fotografia e fundo.
 */
function applyFilm(
  ctx: CanvasRenderingContext2D,
  rows: [number, number, number][],
  area: Area,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  const step = area.h / rows.length;
  for (let y = 0; y < rows.length; y += 1) {
    const t = rows.length > 1 ? y / (rows.length - 1) : 1;
    const k = Math.min(1, t / 0.82);
    const alpha = Math.min(1, Math.pow(k, 1.6));
    const [r, g, b] = rows[y]!;
    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
    ctx.fillRect(area.x, area.y + y * step, area.w, step + 1);
  }
  ctx.restore();
}

function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  tracking: number,
  weight: number,
) {
  ctx.font = `${weight} ${size}px ${TEMPLATE_FONT}`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${tracking}px`;
  }
}

/**
 * Apaga o texto de exemplo impresso no template reproduzindo, linha a
 * linha, a cor do próprio arquivo (amostrada imediatamente à esquerda da
 * área). Nenhum elemento gráfico é redesenhado.
 */
function clearPlaceholder(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  block: TextBlock,
  w: number,
  h: number,
) {
  const rect = block.clear;
  if (!rect) return;
  const area: Area = {
    x: rect.x0 * w,
    y: rect.y0 * h,
    w: (rect.x1 - rect.x0) * w,
    h: (rect.y1 - rect.y0) * h,
  };
  const sampleW = Math.max(2, Math.round(area.w * 0.02));
  const sample = readArea(base, {
    x: Math.max(0, area.x - sampleW - 1),
    y: area.y,
    w: sampleW,
    h: area.h,
  });
  const step = area.h / sample.height;
  for (let y = 0; y < sample.height; y += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let x = 0; x < sample.width; x += 1) {
      const i = (y * sample.width + x) * 4;
      r += sample.data[i]!;
      g += sample.data[i + 1]!;
      b += sample.data[i + 2]!;
    }
    const n = sample.width;
    ctx.fillStyle = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
    ctx.fillRect(area.x, area.y + y * step, area.w, step + 1);
  }
}

/** Maior corpo que respeita a altura oficial e a largura disponível. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  ideal: number,
  maxWidth: number,
  tracking: number,
  weight: number,
): number {
  let size = ideal;
  while (size > 6) {
    setFont(ctx, size, size * tracking, weight);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

/**
 * Escreve um campo variável respeitando a linha de base do template.
 * A altura das maiúsculas (cap height) é a referência — assim o texto
 * fica exatamente na mesma altura da arte original.
 */
function writeField(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  text: string,
  w: number,
  h: number,
) {
  if (!text) return;
  const tracking = block.tracking ?? 0;
  const size = fitSize(
    ctx,
    text,
    (block.capHeight / 0.72) * h,
    block.maxWidth * w,
    tracking,
    block.weight,
  );
  setFont(ctx, size, size * tracking, block.weight);
  ctx.fillStyle = block.color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = block.align;
  // O tracking acrescenta uma folga após o último caractere: em textos
  // centralizados compensamos meia unidade para manter o eixo da arte.
  const nudge = block.align === "center" ? (size * tracking) / 2 : 0;
  const x = block.align === "center" ? w / 2 - nudge : (block.x ?? 0.06) * w;
  ctx.fillText(text, x, block.baselineY * h);
}

function wrap(text: string, max: number, limit: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
      if (lines.length === limit) return lines;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line && lines.length < limit) lines.push(line);
  return lines;
}

/** Textos publicitários da IA — apenas conteúdo, nunca layout novo. */
function writeCopy(
  ctx: CanvasRenderingContext2D,
  block: CopyBlock,
  text: string,
  w: number,
  h: number,
) {
  const lines = wrap(text, block.chars, block.lines);
  lines.forEach((line, i) => {
    writeField(
      ctx,
      { ...block, baselineY: block.baselineY + i * block.lineHeight },
      line,
      w,
      h,
    );
  });
}

export type ComposeInput = {
  model: CreativeModel;
  city: string;
  state: string;
  photoDataUrl?: string | null;
  /** Somente Modelo B: textos gerados pela IA. */
  copy?: { headline?: string; subheadline?: string; supporting?: string };
};

/**
 * Preenche o template do modelo indicado e devolve o PNG em base64
 * (sem prefixo), na resolução original do arquivo enviado.
 */
export async function composeFromTemplate(input: ComposeInput): Promise<string> {
  const template = await getTemplate(input.model);
  if (!template) {
    throw new Error(
      "Nenhum template enviado para este modelo. Envie o arquivo na área de templates.",
    );
  }
  // Cada template usa a sua própria configuração calibrada; sem ela,
  // vale o layout oficial de referência do modelo.
  const layout: TemplateLayout = template.config?.layout ?? TEMPLATE_LAYOUT[input.model];
  const base = await loadImage(template.dataUrl);
  const w = base.naturalWidth;
  const h = base.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  // Garante a tipografia oficial antes de escrever qualquer campo.
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('600 96px "Poppins"'),
        document.fonts.load('700 96px "Poppins"'),
      ]);
    } catch {
      /* a fonte de sistema assume o lugar */
    }
  }

  // 1) Template reproduzido integralmente.
  ctx.drawImage(base, 0, 0, w, h);

  // 2) Fotografia da cidade + película do próprio template.
  const photoArea: Area = {
    x: (layout.photoArea.x0 ?? 0) * w,
    y: layout.photoArea.y0 * h,
    w: ((layout.photoArea.x1 ?? 1) - (layout.photoArea.x0 ?? 0)) * w,
    h: (layout.photoArea.y1 - layout.photoArea.y0) * h,
  };
  if (input.photoDataUrl) {
    try {
      const photo = await loadImage(input.photoDataUrl);
      const rows = rowColors(readArea(base, photoArea));
      drawCover(ctx, photo, photoArea);
      if (layout.photoArea.film !== false) applyFilm(ctx, rows, photoArea);

      // Elemento gráfico do topo (selo) volta por cima da fotografia.
      if (layout.badgeArea) {
        const badge: Area = {
          x: layout.badgeArea.x0 * w,
          y: layout.badgeArea.y0 * h,
          w: (layout.badgeArea.x1 - layout.badgeArea.x0) * w,
          h: (layout.badgeArea.y1 - layout.badgeArea.y0) * h,
        };
        const badgeData = readArea(base, badge);
        ctx.drawImage(
          extractOverlay(badgeData, rowColors(badgeData)),
          badge.x,
          badge.y,
          badge.w,
          badge.h,
        );
      }
    } catch {
      /* sem fotografia disponível, o template permanece como está */
    }
  }

  const city = (input.city || "").trim().toLocaleUpperCase("pt-BR");
  const uf = (input.state || "").trim().toUpperCase();

  // 3) Campos variáveis de identificação da unidade.
  if (layout.city) writeField(ctx, layout.city, city, w, h);
  if (layout.state) writeField(ctx, layout.state, stateLabel(uf), w, h);
  if (layout.tail && city) {
    const value = uf ? `${city} - ${uf}` : city;
    clearPlaceholder(ctx, base, layout.tail, w, h);
    writeField(ctx, layout.tail, `${layout.tail.prefix ?? ""}${value}`, w, h);
  }
  if (layout.footer && city) {
    clearPlaceholder(ctx, base, layout.footer, w, h);
    writeField(ctx, layout.footer, uf ? `${city} - ${uf}` : city, w, h);
  }

  // 4) Textos publicitários (Modelo B).
  if (layout.headline && input.copy?.headline) {
    clearPlaceholder(ctx, base, layout.headline, w, h);
    writeCopy(ctx, layout.headline, input.copy.headline, w, h);
  }
  if (layout.subheadline && input.copy?.subheadline) {
    clearPlaceholder(ctx, base, layout.subheadline, w, h);
    writeCopy(ctx, layout.subheadline, input.copy.subheadline, w, h);
  }
  if (layout.supporting && input.copy?.supporting) {
    clearPlaceholder(ctx, base, layout.supporting, w, h);
    writeCopy(ctx, layout.supporting, input.copy.supporting, w, h);
  }

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }

  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

/** Compatibilidade: Modelo A continua exposto pelo nome anterior. */
export function composeInstitutionalArt(input: {
  city: string;
  state: string;
  photoDataUrl?: string | null;
}): Promise<string> {
  return composeFromTemplate({ ...input, model: "institucional" });
}

function stateLabel(uf: string): string {
  return stateName(uf).toLocaleUpperCase("pt-BR");
}
