/**
 * MODELO A — EDITOR AUTOMATIZADO DO MODELO OFICIAL (browser only).
 *
 * Aqui não existe IA generativa: o arquivo oficial é aberto, os campos
 * variáveis mapeados pelo administrador são substituídos e a imagem é
 * exportada na resolução original. Duas execuções com a mesma cidade
 * produzem exatamente o mesmo arquivo.
 */
import type { OfficialLayout, Rect, TextField } from "./layout";
import { isRect } from "./layout";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = src;
  });
}

function px(rect: Rect, w: number, h: number) {
  return { x: rect.x * w, y: rect.y * h, w: rect.w * w, h: rect.h * h };
}

/** Recorte "cover": preenche a área sem distorcer a fotografia. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  area: { x: number; y: number; w: number; h: number },
) {
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

type Area = { x: number; y: number; w: number; h: number };

/**
 * PELÍCULA AZUL DO TEMPLATE.
 *
 * A área da fotografia do Template Oficial é um degradê institucional: no
 * topo quase claro, descendo até fundir-se com o azul da peça. Em vez de
 * inventar cores, lemos o próprio degradê do template linha a linha e o
 * reaplicamos sobre a fotografia com opacidade crescente. Assim não existe
 * linha de corte: a base da fotografia é exatamente o azul do template.
 */
function readArea(base: HTMLImageElement, area: Area): ImageData {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(area.w));
  c.height = Math.max(1, Math.round(area.h));
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(
    base,
    area.x,
    area.y,
    area.w,
    area.h,
    0,
    0,
    c.width,
    c.height,
  );
  return cx.getImageData(0, 0, c.width, c.height);
}

/** Cor de fundo do template em cada linha (média das bordas laterais). */
function rowBackgrounds(data: ImageData): [number, number, number][] {
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

/**
 * Camada de elementos gráficos do template dentro da área da fotografia
 * (selo "Vem Aí — Nova Unidade", marcador, réguas). Tudo que difere do
 * degradê de fundo é preservado e redesenhado sobre a fotografia.
 */
function extractOverlay(
  data: ImageData,
  rows: [number, number, number][],
): HTMLCanvasElement {
  const { width, height } = data;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const cx = out.getContext("2d")!;
  const img = cx.createImageData(width, height);
  // Suavização das bordas do recorte: evita qualquer moldura visível.
  const fx = Math.max(1, width * 0.06);
  const fy = Math.max(1, height * 0.06);
  for (let y = 0; y < height; y += 1) {
    const [br, bg, bb] = rows[y]!;
    const fadeY = Math.min(1, Math.min(y, height - 1 - y) / fy);
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data.data[i]!;
      const g = data.data[i + 1]!;
      const b = data.data[i + 2]!;
      const diff = Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb));
      // Suaviza a borda dos elementos gráficos preservados.
      const raw = diff <= 18 ? 0 : diff >= 52 ? 1 : (diff - 18) / 34;
      const fade = Math.min(fadeY, Math.min(x, width - 1 - x) / fx);
      const alpha = raw * fade;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(alpha * 255);
    }
  }
  cx.putImageData(img, 0, 0);
  return out;
}

/** Fotografia + película azul do template, sem linha de corte. */
function paintPhotoArea(
  ctx: CanvasRenderingContext2D,
  base: HTMLImageElement,
  photo: HTMLImageElement,
  area: Area,
  badge: Area | null,
) {
  const data = readArea(base, area);
  const rows = rowBackgrounds(data);

  drawCover(ctx, photo, area);

  // Película: cor real do template em cada linha, opacidade crescente.
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  const step = area.h / rows.length;
  for (let y = 0; y < rows.length; y += 1) {
    const t = rows.length > 1 ? y / (rows.length - 1) : 1;
    // A película fecha 100% um pouco antes da borda inferior: a base da
    // fotografia funde-se totalmente ao azul institucional, sem corte.
    const k = Math.min(1, t / 0.88);
    const alpha = Math.min(1, 0.06 + 0.94 * Math.pow(k, 1.7));
    const [r, g, b] = rows[y]!;
    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
    ctx.fillRect(area.x, area.y + y * step, area.w, step + 1);
  }
  ctx.restore();

  // Selo oficial do template ("Vem Aí — Nova Unidade") volta por cima,
  // recortado do próprio arquivo e sem o fundo. Marcações auxiliares do
  // template (moldura da foto, réguas) não são preservadas.
  if (badge) {
    const badgeData = readArea(base, badge);
    const overlay = extractOverlay(badgeData, rowBackgrounds(badgeData));
    ctx.drawImage(overlay, badge.x, badge.y, badge.w, badge.h);
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  field: TextField,
  text: string,
  w: number,
  h: number,
) {
  const area = px(field.rect, w, h);
  if (field.cover) {
    ctx.fillStyle = field.cover;
    ctx.fillRect(area.x, area.y, area.w, area.h);
  }
  const value = field.uppercase ? text.toLocaleUpperCase("pt-BR") : text;
  if (!value.trim()) return;

  const tracking = field.tracking * area.h;
  const setFont = (size: number) => {
    ctx.font = `${field.weight} ${size}px ${field.font}`;
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${tracking}px`;
    }
  };

  // Ajuste determinístico: maior corpo inteiro que cabe no bloco mapeado.
  let size = Math.floor(area.h);
  while (size > 4) {
    setFont(size);
    if (ctx.measureText(value).width <= area.w) break;
    size -= 1;
  }
  setFont(size);

  ctx.fillStyle = field.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = field.align;
  const x =
    field.align === "left" ? area.x : field.align === "right" ? area.x + area.w : area.x + area.w / 2;
  ctx.fillText(value, x, area.y + area.h / 2);
}

/**
 * Edita o Modelo Oficial: substitui apenas cidade, UF e fotografia.
 * Devolve PNG em base64 (sem prefixo), na resolução do arquivo original.
 */
export async function composeInstitutionalArt(input: {
  officialDataUrl: string;
  layout: OfficialLayout;
  city: string;
  state: string;
  photoDataUrl?: string | null;
}): Promise<string> {
  const base = await loadImage(input.officialDataUrl);
  const w = base.naturalWidth;
  const h = base.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  // 1) O arquivo oficial é reproduzido integralmente, pixel a pixel.
  ctx.drawImage(base, 0, 0, w, h);

  // 2) Fotografia principal — único elemento visual substituído.
  if (isRect(input.layout.photo) && input.photoDataUrl) {
    try {
      const photo = await loadImage(input.photoDataUrl);
      paintPhotoArea(
        ctx,
        base,
        photo,
        px(input.layout.photo, w, h),
        isRect(input.layout.badge) ? px(input.layout.badge, w, h) : null,
      );
    } catch {
      /* sem foto disponível, o enquadramento original permanece */
    }
  }

  // 3) Campos textuais variáveis — cidade e UF aparecem duas vezes.
  if (input.layout.city) drawText(ctx, input.layout.city, input.city, w, h);
  if (input.layout.city2) drawText(ctx, input.layout.city2, input.city, w, h);
  if (input.layout.state) drawText(ctx, input.layout.state, input.state, w, h);
  if (input.layout.state2) drawText(ctx, input.layout.state2, input.state, w, h);

  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}
