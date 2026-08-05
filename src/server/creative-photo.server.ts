/**
 * Fotografia institucional da cidade — SERVER ONLY.
 *
 * Busca uma imagem representativa da cidade informada (vista aérea,
 * cartão postal, igreja matriz, avenida, praça, monumento ou paisagem
 * urbana) usando a Wikipédia em português. Nunca devolve imagem
 * genérica: sem foto representativa, devolve `null` e a arte oficial é
 * gerada apenas com a identidade visual da marca.
 */

const UA = "PortalVelox/1.0 (institucional)";

type ImageInfo = {
  url?: string;
  width?: number;
  height?: number;
  mime?: string;
  size?: number;
};
type ImagesResult = {
  query?: {
    pages?: Record<string, { title?: string; imageinfo?: ImageInfo[] }>;
  };
};
type SearchResult = { query?: { search?: { title?: string }[] } };

/**
 * Termos por ordem de prioridade editorial: cartão-postal, ponto
 * turístico, monumento, skyline, vista panorâmica, centro histórico,
 * parque e praça — sempre paisagem urbana diurna.
 */
function candidates(city: string, state: string): string[] {
  const uf = state ? ` (${state})` : "";
  return [
    `${city}${uf}`,
    `${city} cartão postal`,
    `${city} vista panorâmica`,
    `${city} skyline`,
    `${city} monumento`,
    `${city} centro histórico`,
    `${city} parque`,
    `${city} praça`,
    `${city} vista aérea`,
  ];
}

/** Palavras que denunciam material inadequado para a arte oficial. */
const REJECT = [
  "noite",
  "noturn",
  "night",
  "nocturn",
  "madrugada",
  "escur",
  "dark",
  "blur",
  "desfoc",
  "watermark",
  "marca_dagua",
  "logo",
  "mapa",
  "map_",
  "bandeira",
  "flag",
  "brasao",
  "brasão",
  "coat_of_arms",
  "seal",
  "icon",
  "diagram",
  "grafico",
  "planta",
  "retrato",
  "portrait",
  "selfie",
  "interior",
];

/** Prioriza cartões-postais, monumentos, skyline e paisagens urbanas. */
const PREFER = [
  "panoram",
  "skyline",
  "vista",
  "aerea",
  "aérea",
  "cartao",
  "cartão",
  "postal",
  "centro",
  "historic",
  "histór",
  "monument",
  "praca",
  "praça",
  "parque",
  "catedral",
  "igreja",
  "matriz",
  "avenida",
  "paisagem",
  "cidade",
  "city",
];

function score(url: string, info: ImageInfo): number {
  const name = decodeURIComponent(url).toLowerCase();
  if (REJECT.some((w) => name.includes(w))) return -1;
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  // Resolução mínima: evita imagens pequenas e excessivamente comprimidas.
  if (width < 1100 || height < 700) return -1;
  const ratio = width / height;
  // Enquadramentos muito fechados (verticais) ou panorâmicos extremos.
  if (ratio < 1.1 || ratio > 2.6) return -1;
  // Compressão agressiva: menos de ~0,08 byte por pixel indica perda alta.
  const bytes = info.size ?? 0;
  if (bytes && bytes / (width * height) < 0.06) return -1;
  let s = Math.min(6, width / 600);
  if (PREFER.some((w) => name.includes(w))) s += 4;
  if (ratio >= 1.3 && ratio <= 1.9) s += 2;
  return s;
}

/** Todas as imagens de uma página, com metadados de qualidade. */
async function pageImages(title: string): Promise<{ url: string; info: ImageInfo }[]> {
  const url = new URL("https://pt.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "images");
  url.searchParams.set("gimlimit", "40");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|mime");
  url.searchParams.set("titles", title);
  url.searchParams.set("origin", "*");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as ImagesResult;
  const out: { url: string; info: ImageInfo }[] = [];
  for (const page of Object.values(json.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const src = info?.url;
    if (!src || !info) continue;
    const mime = info.mime ?? "";
    if (mime.includes("svg") || !mime.startsWith("image/")) continue;
    out.push({ url: src, info });
  }
  return out;
}

async function firstTitle(term: string): Promise<string | null> {
  const url = new URL("https://pt.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", term);
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("origin", "*");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as SearchResult;
  return json.query?.search?.[0]?.title ?? null;
}

async function toDataUrl(source: string): Promise<string | null> {
  const res = await fetch(source, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") || "image/jpeg";
  if (!type.startsWith("image/") || type.includes("svg")) return null;
  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength > 6_000_000) return null;
  let binary = "";
  for (let i = 0; i < buffer.length; i += 1) binary += String.fromCharCode(buffer[i]!);
  return `data:${type};base64,${btoa(binary)}`;
}

export async function findCityPhoto(
  city: string,
  state: string,
  exclude: string[] = [],
): Promise<{ dataUrl: string | null; credit: string | null }> {
  const name = (city || "").trim();
  if (!name) return { dataUrl: null, credit: null };
  const used = new Set(exclude.map((u) => u.toLowerCase()));
  const pool: { url: string; score: number }[] = [];
  for (const term of candidates(name, (state || "").trim().toUpperCase())) {
    try {
      const title = (await firstTitle(term)) ?? term;
      for (const item of await pageImages(title)) {
        if (used.has(item.url.toLowerCase())) continue;
        if (pool.some((p) => p.url === item.url)) continue;
        const s = score(item.url, item.info);
        if (s > 0) pool.push({ url: item.url, score: s });
      }
      // Amostra suficiente para escolher com critério.
      if (pool.length >= 8) break;
    } catch {
      /* segue para o próximo termo */
    }
  }
  pool.sort((a, b) => b.score - a.score);
  for (const item of pool.slice(0, 6)) {
    try {
      const dataUrl = await toDataUrl(item.url);
      if (dataUrl) return { dataUrl, credit: item.url };
    } catch {
      /* tenta a próxima candidata */
    }
  }
  return { dataUrl: null, credit: null };
}

/**
 * Fotografia da cidade com fallback por IA.
 *
 * É o ÚNICO ponto em que o Modelo A pode usar IA: apenas para obter uma
 * fotografia representativa quando não existe imagem real disponível.
 */
export async function resolveCityPhoto(
  city: string,
  state: string,
  exclude: string[] = [],
): Promise<{ dataUrl: string | null; credit: string | null }> {
  const real = await findCityPhoto(city, state, exclude).catch(() => ({
    dataUrl: null,
    credit: null,
  }));
  if (real.dataUrl) return real;

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { dataUrl: null, credit: null };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image",
        messages: [
          {
            role: "user",
            content: `Fotografia realista e representativa da cidade de ${city} — ${state}, Brasil: cartão-postal, monumento, igreja matriz, praça, centro histórico ou skyline urbano. Luz natural de fim de tarde, sem texto, sem pessoas em primeiro plano, sem marca d'água.`,
          },
        ],
        modalities: ["image", "text"],
        temperature: 0,
        seed: 20240,
      }),
    });
    if (!res.ok) return { dataUrl: null, credit: null };
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return { dataUrl: null, credit: null };
    return { dataUrl: `data:image/png;base64,${b64}`, credit: `${city} — ${state}` };
  } catch {
    return { dataUrl: null, credit: null };
  }
}
