/**
 * Rasterização e download das peças da IA Criativa (browser only).
 *
 * Mantida fora do template para que o layout permaneça puramente
 * declarativo e reaproveitável por futuras categorias.
 */

let logoCache: string | null | undefined;

/** Converte o logotipo oficial em data URI para embutir na arte. */
export async function officialLogoHref(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const mod = await import("@/assets/editorial/velox-logo.png.asset.json");
    const src = (mod.default as { url: string }).url;
    const res = await fetch(src);
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("logo"));
      reader.readAsDataURL(blob);
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/** Converte a arte vetorial em PNG (base64 sem prefixo) na resolução oficial. */
export async function svgToPngBase64(
  svg: string,
  width = 1080,
  height = 1350,
): Promise<string> {
  const url = svgToDataUrl(svg);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível rasterizar a arte."));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

export function downloadBase64(base64: string, filename: string, mime = "image/png") {
  const link = document.createElement("a");
  link.href = `data:${mime};base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Abre a arte em nova aba. Navegadores bloqueiam navegação de topo para
 * `data:` URIs — por isso convertemos em Blob antes de abrir.
 */
export function openBase64InNewTab(base64: string, mime = "image/png") {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const win = window.open(url, "_blank", "noopener");
  if (!win) {
    // Popup bloqueado: cai para download, garantindo acesso à peça.
    downloadBase64(base64, "velox-arte.png", mime);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function slugify(value: string): string {
  return (value || "peca")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}