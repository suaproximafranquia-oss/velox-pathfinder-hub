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

type SearchResult = { query?: { search?: { title?: string }[] } };
type PageResult = {
  query?: { pages?: Record<string, { original?: { source?: string } }> };
};

/** Termos por ordem de prioridade institucional. */
function candidates(city: string, state: string): string[] {
  const uf = state ? ` (${state})` : "";
  return [
    `${city}${uf}`,
    `${city} vista aérea`,
    `${city} centro`,
    `Igreja Matriz de ${city}`,
    `Praça central de ${city}`,
  ];
}

async function pageImage(title: string): Promise<string | null> {
  const url = new URL("https://pt.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "original");
  url.searchParams.set("titles", title);
  url.searchParams.set("origin", "*");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as PageResult;
  const pages = Object.values(json.query?.pages ?? {});
  return pages[0]?.original?.source ?? null;
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
): Promise<{ dataUrl: string | null; credit: string | null }> {
  const name = (city || "").trim();
  if (!name) return { dataUrl: null, credit: null };
  for (const term of candidates(name, (state || "").trim().toUpperCase())) {
    try {
      const title = (await pageImage(term)) ? term : await firstTitle(term);
      if (!title) continue;
      const source = await pageImage(title);
      if (!source) continue;
      const dataUrl = await toDataUrl(source);
      if (dataUrl) return { dataUrl, credit: title };
    } catch {
      /* segue para o próximo termo */
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
): Promise<{ dataUrl: string | null; credit: string | null }> {
  const real = await findCityPhoto(city, state).catch(() => ({
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
