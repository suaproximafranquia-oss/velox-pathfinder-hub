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

/**
 * Recorte "cover": preenche a área sem distorcer nem deixar borda.
 * `focusY` define o ponto de interesse vertical (0 = topo, 1 = base).
 * Fotografias urbanas concentram o assunto acima da linha média, por
 * isso o padrão privilegia o terço superior — o céu e o skyline ficam
 * visíveis e o enquadramento parece natural dentro do template.
 */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, area: Area, focusY = 0.5) {
  const scale = Math.max(area.w / img.naturalWidth, area.h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  const dy = area.y + (area.h - dh) * Math.min(1, Math.max(0, focusY));
  ctx.drawImage(img, area.x + (area.w - dw) / 2, dy, dw, dh);
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

function setFont(ctx: CanvasRenderingContext2D, size: number, tracking: number, weight: number) {
  ctx.font = `${weight} ${size}px ${TEMPLATE_FONT}`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${tracking}px`;
  }
}

/**
 * O template oficial já traz película azul, degradê, transparências,
 * logotipo e selo. Quando a área da fotografia é transparente, o PNG
 * funciona como MÁSCARA (overlay): a fotografia entra atrás e nada é
 * recalculado. Esta função identifica esse caso lendo o canal alfa.
 */
function hasPhotoWindow(base: HTMLImageElement, area: Area): boolean {
  try {
    const data = readArea(base, area);
    const total = data.width * data.height;
    if (!total) return false;
    let transparent = 0;
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i]! < 250) transparent += 1;
    }
    // Qualquer janela real de transparência (>2% da área) já caracteriza
    // um template-máscara: a fotografia entra ATRÁS e o PNG cobre por cima.
    return transparent / total > 0.02;
  } catch {
    return false;
  }
}

/** Guia tracejado de calibração — jamais exportado na arte final. */
/**
 * Janela real do PNG: retângulo que envolve os pixels transparentes.
 * Assim a fotografia ocupa EXATAMENTE a abertura desenhada no arquivo
 * oficial, sem depender de coordenadas declaradas manualmente.
 */
function alphaWindow(base: HTMLImageElement, w: number, h: number): Area | null {
  try {
    const sw = Math.min(240, w);
    const sh = Math.max(1, Math.round((h / w) * sw));
    const data = readArea(base, { x: 0, y: 0, w, h });
    void sw;
    void sh;
    let x0 = data.width;
    let y0 = data.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < data.height; y += 1) {
      for (let x = 0; x < data.width; x += 1) {
        if (data.data[(y * data.width + x) * 4 + 3]! < 250) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0 || y1 < 0) return null;
    const kx = w / data.width;
    const ky = h / data.height;
    return { x: x0 * kx, y: y0 * ky, w: (x1 - x0 + 1) * kx, h: (y1 - y0 + 1) * ky };
  } catch {
    return null;
  }
}

function drawGuide(ctx: CanvasRenderingContext2D, area: Area) {
  ctx.save();
  ctx.strokeStyle = "#F1610C";
  ctx.lineWidth = Math.max(2, area.w * 0.006);
  ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 3]);
  ctx.strokeRect(area.x, area.y, area.w, area.h);
  ctx.restore();
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
  const sampleX =
    rect.sample === "right"
      ? Math.min(w - sampleW, area.x + area.w + 1)
      : Math.max(0, area.x - sampleW - 1);
  const sample = readArea(base, { x: sampleX, y: area.y, w: sampleW, h: area.h });
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
    writeField(ctx, { ...block, baselineY: block.baselineY + i * block.lineHeight }, line, w, h);
  });
}

export type ComposeInput = {
  model: CreativeModel;
  city: string;
  state: string;
  photoDataUrl?: string | null;
  /** Somente Modelo B: textos gerados pela IA. */
  copy?: { headline?: string; subheadline?: string; supporting?: string };
  /**
   * Guia tracejado sobre a área da fotografia. Uso exclusivo de
   * calibração/prévia — nunca é aplicado na arte final exportada.
   */
  guide?: boolean;
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

  const photoArea: Area = {
    x: (layout.photoArea.x0 ?? 0) * w,
    y: layout.photoArea.y0 * h,
    w: ((layout.photoArea.x1 ?? 1) - (layout.photoArea.x0 ?? 0)) * w,
    h: (layout.photoArea.y1 - layout.photoArea.y0) * h,
  };

  /**
   * MAIL MERGE GRÁFICO — sem liberdade criativa.
   *
   * O template é a arte final. A fotografia entra apenas na janela
   * reservada e nenhum efeito é recriado (nada de película, degradê ou
   * reconstrução de selos: o que existir já pertence ao arquivo oficial).
   * Quando o PNG possui área transparente, a foto entra ATRÁS e o
   * template cobre por cima; caso contrário ela apenas preenche a área.
   */
  const overlayMode = hasPhotoWindow(base, photoArea);
  let photo: HTMLImageElement | null = null;
  if (input.photoDataUrl) {
    photo = await loadImage(input.photoDataUrl).catch(() => null);
  }

  if (overlayMode) {
    if (photo) drawCover(ctx, photo, photoArea, 0.38);
    ctx.drawImage(base, 0, 0, w, h);
  } else {
    ctx.drawImage(base, 0, 0, w, h);
    if (photo) drawCover(ctx, photo, photoArea, 0.38);
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

  // 5) Guia visual temporário — apenas em prévias de calibração.
  if (input.guide) drawGuide(ctx, photoArea);

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
