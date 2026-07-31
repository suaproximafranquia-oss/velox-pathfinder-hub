/** IA Criativa — geração dos textos oficiais. SERVER ONLY. */
import type { CreativeCopyInput, CreativeCopyPair } from "@/lib/creative.functions";

function fallback(input: CreativeCopyInput): CreativeCopyPair {
  const local = [input.city, input.state].filter(Boolean).join(" — ");
  return {
    institucional: {
      headline: `Velox amplia sua presença em ${input.city || "nova praça"}`,
      subheadline: `Nova unidade oficial em ${local}.`,
      supporting:
        "Soluções financeiras completas com atendimento consultivo, respaldo institucional e padrão Velox de operação.",
    },
    marketing: {
      headline: `Chegou a Velox em ${input.city || "sua cidade"}`,
      subheadline: "Crédito, seguros, consórcios e energia solar em um só lugar.",
      supporting: "Atendimento próximo, condições reais e um time preparado para orientar você.",
    },
  };
}

/**
 * Produz os textos das duas versões oficiais. Nunca cria identidade
 * visual — apenas conteúdo textual dentro do tom institucional Velox.
 */
export async function buildCreativeCopy(
  input: CreativeCopyInput,
): Promise<CreativeCopyPair> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return fallback(input);

  const system = `Você é a IA Criativa da Velox, responsável por textos de peças oficiais.
REGRAS:
1. Tom profissional, humano, transparente e seguro. Português do Brasil.
2. Nunca prometa enriquecimento, retorno financeiro ou ganho garantido.
3. Nunca invente dados que não estejam no briefing.
4. Textos curtos e diretos — serão aplicados em arte com espaço limitado.
5. Produza DUAS versões: "institucional" (corporativa, sóbria, credibilidade)
   e "marketing" (impacto, divulgação comercial, convite).
6. Responda SOMENTE com JSON válido no formato:
{"institucional":{"headline":"","subheadline":"","supporting":""},
 "marketing":{"headline":"","subheadline":"","supporting":""}}
Limites: headline até 48 caracteres, subheadline até 90, supporting até 150.`;

  const brief = [
    `Unidade: ${input.unit}`,
    `Cidade/UF: ${input.city} / ${input.state}`,
    input.address ? `Endereço: ${input.address}` : "",
    input.openingDate ? `Inauguração: ${input.openingDate}` : "",
    input.phone ? `Contato: ${input.phone}` : "",
    input.notes ? `Observações: ${input.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: brief },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallback(input);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as Partial<CreativeCopyPair>;
    const base = fallback(input);
    return {
      institucional: { ...base.institucional, ...(parsed.institucional ?? {}) },
      marketing: { ...base.marketing, ...(parsed.marketing ?? {}) },
    };
  } catch {
    return fallback(input);
  }
}