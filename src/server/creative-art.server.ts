/**
 * IA Criativa — geração das artes oficiais a partir do MODELO OFICIAL.
 * SERVER ONLY.
 *
 * Modelo A (Institucional): reprodução fiel do modelo enviado pelo
 * administrador — apenas cidade, UF e a fotografia principal mudam.
 * Modelo B (Marketing): releitura criativa inspirada no mesmo material,
 * preservando a identidade visual da Velox.
 */
import { findCityPhoto } from "./creative-photo.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";
const MODEL = "google/gemini-3-pro-image";

export type GeneratedArt = { model: "institucional" | "marketing"; base64: string };

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
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Falha ao gerar a arte (${res.status}). ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("A IA não devolveu imagem para esta peça.");
  return b64;
}

function institutionalPrompt(city: string, state: string, hasPhoto: boolean): string {
  return `Você recebeu a ARTE OFICIAL da franquia Velox (primeira imagem).
Reproduza esta arte de forma PRATICAMENTE IDÊNTICA, em alta resolução, mantendo exatamente:
composição, posição de todos os elementos, tipografia, cores, títulos, subtítulos,
textos institucionais, logotipos, molduras, estrutura gráfica e estilo do layout.

ALTERE SOMENTE:
1. Todos os locais onde aparece o nome da cidade → "${city}".
2. Todos os locais onde aparece o estado/UF → "${state}".
${hasPhoto
      ? `3. A fotografia principal → utilize a segunda imagem fornecida (fotografia real da cidade de ${city}/${state}), aplicada no mesmo enquadramento, mesmo recorte e mesmo tratamento visual da foto original.`
      : `3. A fotografia principal → substitua por uma imagem representativa e realista da cidade de ${city}/${state} (cartão-postal, monumento, igreja, praça, lago, paisagem ou skyline), no mesmo enquadramento e tratamento visual da foto original.`}

NÃO altere mais nada. Nenhum outro texto, cor, fonte ou elemento pode mudar.
O resultado final deve parecer o mesmo arquivo oficial, apenas com a cidade, a UF e a foto atualizadas.
Saída: apenas a imagem final, sem bordas extras nem marcas d'água.`;
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

export async function buildOfficialArts(input: {
  city: string;
  state: string;
  officialDataUrl: string;
}): Promise<{ arts: GeneratedArt[]; photoCredit: string | null }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("IA indisponível: chave de acesso não configurada.");

  const city = input.city.trim();
  const state = input.state.trim().toUpperCase();

  const photo = await findCityPhoto(city, state).catch(() => ({
    dataUrl: null,
    credit: null,
  }));
  const hasPhoto = Boolean(photo.dataUrl);

  const withImages = (text: string): ContentPart[] => {
    const parts: ContentPart[] = [
      { type: "text", text },
      { type: "image_url", image_url: { url: input.officialDataUrl } },
    ];
    if (photo.dataUrl) parts.push({ type: "image_url", image_url: { url: photo.dataUrl } });
    return parts;
  };

  const [institucional, marketing] = await Promise.all([
    generate(withImages(institutionalPrompt(city, state, hasPhoto)), key),
    generate(withImages(marketingPrompt(city, state, hasPhoto)), key),
  ]);

  return {
    arts: [
      { model: "institucional", base64: institucional },
      { model: "marketing", base64: marketing },
    ],
    photoCredit: photo.credit ?? null,
  };
}
