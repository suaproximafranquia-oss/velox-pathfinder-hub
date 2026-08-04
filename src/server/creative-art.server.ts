/**
 * MODELO B (MARKETING) — releitura criativa por IA. SERVER ONLY.
 *
 * O Modelo A NÃO passa por aqui: ele é uma edição automatizada do arquivo
 * oficial, feita sem IA generativa (ver src/lib/creative/compose.ts).
 */
import { resolveCityPhoto } from "./creative-photo.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";
const MODEL = "google/gemini-3-pro-image";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function generate(parts: ContentPart[], key: string): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: parts }],
      modalities: ["image", "text"],
      temperature: 0,
      seed: 20240,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Falha ao gerar a arte (${res.status}). ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("A IA não devolveu imagem para esta peça.");
  return b64;
}

function marketingPrompt(city: string, state: string, hasPhoto: boolean): string {
  return `Você recebeu a ARTE OFICIAL da franquia Velox (primeira imagem) como REFERÊNCIA DE MARCA.
Crie uma NOVA versão publicitária (Modelo Marketing) da mesma peça, anunciando a nova unidade
Velox em ${city} — ${state}.

Você TEM liberdade criativa para: reorganizar elementos, melhorar a composição,
criar novas chamadas curtas em português do Brasil, destacar benefícios
(crédito, seguros, consórcios e energia solar), modernizar o anúncio e alterar a
disposição visual.

Você DEVE preservar a identidade visual da Velox: logotipo oficial exatamente como no
material de referência, paleta azul-marinho profundo, dourado, branco e cinzas sofisticados,
e o mesmo nível de sofisticação editorial. Deve ficar evidente que a peça foi inspirada no
modelo oficial.

${hasPhoto ? `Use a segunda imagem (fotografia real de ${city}/${state}) como elemento fotográfico principal.` : `Use uma imagem representativa e realista da cidade de ${city}/${state}.`}

Tom: profissional, humano, transparente e seguro. Nunca prometa enriquecimento ou ganho garantido.
Mesma proporção da arte oficial. Saída: apenas a imagem final, sem marcas d'água.`;
}

export async function buildMarketingArt(input: {
  city: string;
  state: string;
  officialDataUrl: string;
}): Promise<{ base64: string; photoCredit: string | null }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("IA indisponível: chave de acesso não configurada.");

  const city = input.city.trim();
  const state = input.state.trim().toUpperCase();

  const photo = await resolveCityPhoto(city, state).catch(() => ({
    dataUrl: null,
    credit: null,
  }));

  const parts: ContentPart[] = [
    { type: "text", text: marketingPrompt(city, state, Boolean(photo.dataUrl)) },
    { type: "image_url", image_url: { url: input.officialDataUrl } },
  ];
  if (photo.dataUrl) parts.push({ type: "image_url", image_url: { url: photo.dataUrl } });

  return { base64: await generate(parts, key), photoCredit: photo.credit ?? null };
}
