import { createServerFn } from "@tanstack/react-start";

/**
 * Importador Inteligente de Leads (DF 2.4.5).
 *
 * Recebe um print de tela (ex.: GreenSales) e extrai EXCLUSIVAMENTE os
 * campos operacionais necessários para criar o relacionamento. Qualquer
 * outro conteúdo da imagem é ignorado. A extração nunca bloqueia a
 * criação do Lead: campos ausentes retornam vazios e viram "—".
 */
export type ImportedLeadFields = {
  name: string;
  whatsapp: string;
  email: string;
  city: string;
  executive: string;
};

export const extractLeadFromImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as { imageDataUrl: string })
  .handler(async ({ data }): Promise<ImportedLeadFields> => {
    const EMPTY: ImportedLeadFields = {
      name: "",
      whatsapp: "",
      email: "",
      city: "",
      executive: "",
    };
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Serviço de leitura indisponível no momento.");
    const image = (data?.imageDataUrl || "").trim();
    if (!image.startsWith("data:image/")) return EMPTY;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Você lê prints de telas de CRM e extrai apenas dados cadastrais do investidor. " +
              "Nunca invente informação. Se um campo não estiver visível, devolva string vazia. " +
              "Ignore métricas, status, botões, menus e qualquer outro conteúdo da imagem.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Extraia deste print apenas: nome do investidor, WhatsApp/telefone, e-mail, cidade e executivo responsável. " +
                  "Use a função extrair_lead.",
              },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_lead",
              description: "Campos cadastrais identificados no print.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  whatsapp: { type: "string" },
                  email: { type: "string" },
                  city: { type: "string" },
                  executive: { type: "string" },
                },
                required: ["name", "whatsapp", "email", "city", "executive"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extrair_lead" } },
      }),
    });

    if (res.status === 429) throw new Error("Muitas leituras seguidas. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (!res.ok) throw new Error("Não foi possível ler a imagem enviada.");

    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const raw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!raw) return EMPTY;
    try {
      const parsed = JSON.parse(raw) as Partial<ImportedLeadFields>;
      return {
        name: String(parsed.name ?? "").trim(),
        whatsapp: String(parsed.whatsapp ?? "").trim(),
        email: String(parsed.email ?? "").trim(),
        city: String(parsed.city ?? "").trim(),
        executive: String(parsed.executive ?? "").trim(),
      };
    } catch {
      return EMPTY;
    }
  });
