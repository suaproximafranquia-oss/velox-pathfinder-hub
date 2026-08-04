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
      drawCover(ctx, photo, px(input.layout.photo, w, h));
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
