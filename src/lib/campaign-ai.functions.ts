/**
 * Bloco 5 — IA de Campanhas.
 *
 * Gera rascunhos de campanha (nome, objetivo e corpo do Template Meta)
 * a partir de uma intenção escrita pela Gestora. Nada é enviado: o texto
 * volta para edição humana antes de qualquer disparo.
 */
import { createServerFn } from "@tanstack/react-start";

export type CampaignDraft = {
  name: string;
  objective: string;
  templateBody: string;
  notes: string;
};

const FALLBACK: CampaignDraft = {
  name: "",
  objective: "",
  templateBody: "",
  notes: "Não foi possível gerar o rascunho agora. Tente novamente em instantes.",
};

export const generateCampaignDraft = createServerFn({ method: "POST" })
  .inputValidator((data: { intent: string }) => data)
  .handler(async ({ data }): Promise<CampaignDraft> => {
    const key = process.env["LOVABLE_API_KEY"];
    const intent = (data.intent || "").trim();
    if (!key || !intent) return FALLBACK;

    const instructions = `Você é especialista em comunicação institucional de uma franqueadora de soluções financeiras.
Escreva em Português do Brasil, com tom profissional, humano e transparente.
Nunca prometa ganhos, enriquecimento ou resultados garantidos.
O corpo do template deve caber em uma mensagem de WhatsApp aprovada pela Meta:
até 4 linhas, sem links, sem emojis em excesso, usando {{1}} como variável do
primeiro nome do investidor.
Responda json com as chaves: name, objective, templateBody, notes.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          instructions,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Intenção da campanha: ${intent}\n\nGere o rascunho em json.`,
                },
              ],
            },
          ],
          stream: true,
          text: {
            format: {
              type: "json_schema",
              name: "campaign_draft",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  objective: { type: "string" },
                  templateBody: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["name", "objective", "templateBody", "notes"],
              },
            },
          },
        }),
      });

      if (!res.ok || !res.body) return FALLBACK;

      // Streaming obrigatório nesta API: acumulamos os deltas no servidor.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as {
              type?: string;
              delta?: string;
              response?: { output_text?: string };
            };
            if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
            if (evt.type === "response.completed" && evt.response?.output_text) {
              text = evt.response.output_text;
            }
          } catch {
            /* evento parcial ignorado */
          }
        }
      }

      const parsed = JSON.parse(text) as CampaignDraft;
      return {
        name: parsed.name ?? "",
        objective: parsed.objective ?? "",
        templateBody: parsed.templateBody ?? "",
        notes: parsed.notes ?? "",
      };
    } catch {
      return FALLBACK;
    }
  });