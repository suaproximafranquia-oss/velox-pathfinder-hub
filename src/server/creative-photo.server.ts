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
