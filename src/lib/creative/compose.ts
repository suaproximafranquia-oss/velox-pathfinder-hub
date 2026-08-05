/**
 * MODELO A — PREENCHIMENTO DO TEMPLATE OFICIAL (browser only).
 *
 * Não existe IA generativa aqui. O Template Oficial é aberto e apenas
 * três elementos são inseridos: a fotografia da cidade (área superior,
 * sob a película azul do template), o nome da cidade e a UF. Todo o
 * restante — selo, fundo, textos institucionais, lista de produtos e
 * logotipo — permanece pixel a pixel idêntico ao arquivo oficial.
 */
import {
  BADGE_AREA,
  CITY_BLOCK,
  OFFICIAL_TEMPLATE_URL,
  PHOTO_AREA,
  STATE_BLOCK,
  TAIL_TEXT,
  TEMPLATE_FONT,
  stateName,
} from "./official-template";

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
  weight = 900,
) {
  ctx.font = `${weight} ${size}px ${TEMPLATE_FONT}`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${tracking}px`;
  }
}

/** Maior corpo que respeita a altura oficial e a largura disponível. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  ideal: number,
  maxWidth: number,
  trackingRatio: number,
  weight: number,
): number {
  let size = ideal;
  while (size > 6) {
    setFont(ctx, size, size * trackingRatio, weight);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

/**
 * Preenche o Template Oficial com a fotografia, a cidade e a UF.
 * Devolve PNG em base64 (sem prefixo) na resolução original do template.
 */
export async function composeInstitutionalArt(input: {
  city: string;
  state: string;
  photoDataUrl?: string | null;
}): Promise<string> {
  const base = await loadImage(OFFICIAL_TEMPLATE_URL);
  const w = base.naturalWidth;
  const h = base.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  const photoArea: Area = {
    x: 0,
    y: PHOTO_AREA.y0 * h,
    w,
    h: (PHOTO_AREA.y1 - PHOTO_AREA.y0) * h,
  };

  // 1) Template oficial reproduzido integralmente.
  ctx.drawImage(base, 0, 0, w, h);

  // 2) Fotografia da cidade + película azul do próprio template.
  if (input.photoDataUrl) {
    try {
      const photo = await loadImage(input.photoDataUrl);
      const rows = rowColors(readArea(base, photoArea));
      drawCover(ctx, photo, photoArea);
      applyFilm(ctx, rows, photoArea);

      // Selo "Vem Aí — Nova Unidade" volta por cima da fotografia.
      const badge: Area = {
        x: BADGE_AREA.x0 * w,
        y: BADGE_AREA.y0 * h,
        w: (BADGE_AREA.x1 - BADGE_AREA.x0) * w,
        h: (BADGE_AREA.y1 - BADGE_AREA.y0) * h,
      };
      const badgeData = readArea(base, badge);
      ctx.drawImage(
        extractOverlay(badgeData, rowColors(badgeData)),
        badge.x,
        badge.y,
        badge.w,
        badge.h,
      );
    } catch {
      /* sem fotografia disponível, o template permanece como está */
    }
  }

  const city = (input.city || "").trim().toLocaleUpperCase("pt-BR");
  const uf = (input.state || "").trim().toUpperCase();

  ctx.textBaseline = "middle";

  // 3) Cidade — texto principal.
  if (city) {
    ctx.textAlign = "center";
    const size = fitSize(ctx, city, (CITY_BLOCK.capHeight / 0.72) * h, CITY_BLOCK.maxWidth * w, 0, 900);
    setFont(ctx, size, 0, 900);
    ctx.fillStyle = CITY_BLOCK.color;
    ctx.fillText(city, w / 2, CITY_BLOCK.centerY * h);
  }

  // 4) UF por extenso, com o espaçamento oficial.
  const state = stateName(uf).toLocaleUpperCase("pt-BR");
  if (state) {
    ctx.textAlign = "center";
    const size = fitSize(
      ctx,
      state,
      (STATE_BLOCK.capHeight / 0.72) * h,
      STATE_BLOCK.maxWidth * w,
      STATE_BLOCK.tracking,
      700,
    );
    setFont(ctx, size, size * STATE_BLOCK.tracking, 700);
    ctx.fillStyle = STATE_BLOCK.color;
    // A folga do tracking desloca o texto: compensamos meia unidade.
    ctx.fillText(state, w / 2 - (size * STATE_BLOCK.tracking) / 2, STATE_BLOCK.centerY * h);
  }

  // 5) Referência da cidade no texto institucional ("AGORA EM ...").
  if (city) {
    const tail = uf ? `${city} - ${uf}` : city;
    ctx.textAlign = "left";
    const size = fitSize(
      ctx,
      tail,
      (TAIL_TEXT.capHeight / 0.72) * h,
      TAIL_TEXT.maxWidth * w,
      0.02,
      800,
    );
    setFont(ctx, size, size * 0.02, 800);
    ctx.fillStyle = TAIL_TEXT.color;
    ctx.fillText(tail, TAIL_TEXT.x * w, TAIL_TEXT.centerY * h);
  }

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }

  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}
