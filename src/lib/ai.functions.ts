import { createServerFn } from "@tanstack/react-start";

export type AskPassage = { source: string; text: string };
export type AskResult = { answer: string; sources: string[] };

const NO_INFO =
  "Não encontrei essa informação na Base Oficial de Conhecimento do Workspace.";

/**
 * IA Corporativa — responde exclusivamente a partir dos trechos fornecidos
 * pela Base Oficial. Nunca usa conhecimento externo, nunca supõe. Se a
 * resposta não estiver clara nos trechos, retorna a mensagem padrão.
 */
export const askKnowledge = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) =>
      data as { question: string; passages: AskPassage[] },
  )
  .handler(async ({ data }): Promise<AskResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente no servidor.");

    const question = (data.question || "").trim();
    if (!question) return { answer: NO_INFO, sources: [] };
    if (!data.passages || data.passages.length === 0) {
      return { answer: NO_INFO, sources: [] };
    }

    const context = data.passages
      .map(
        (p, i) =>
          `[Fonte ${i + 1} — ${p.source}]\n${p.text}`,
      )
      .join("\n\n---\n\n");

    const system = `Você é a IA Corporativa da Atlas Platform.
Regras invioláveis, aplicadas a TODA resposta:
1. Utilize EXCLUSIVAMENTE os trechos da Base Oficial abaixo.
2. Nunca utilize conhecimento externo. Nunca faça suposições. Nunca invente conteúdo.
3. Se a resposta não estiver claramente contida nos trechos, responda EXATAMENTE: "${NO_INFO}"
4. Nunca ofereça opiniões, previsões, promessas de retorno ou aconselhamento financeiro pessoal.
5. Ao final, cite as fontes utilizadas no formato:
   "Fonte: <nome do documento>"
   Quando útil, informe também capítulo/página se estiver explícito no trecho.
6. Tom corporativo, direto e didático. Português do Brasil.

BASE OFICIAL:
${context}`;

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: question },
          ],
          temperature: 0.1,
        }),
      },
    );

    if (res.status === 402) {
      return {
        answer:
          "Créditos da IA Corporativa esgotados para este workspace. Contate o administrador.",
        sources: [],
      };
    }
    if (res.status === 429) {
      return {
        answer:
          "Limite de requisições da IA atingido. Aguarde alguns instantes e tente novamente.",
        sources: [],
      };
    }
    if (!res.ok) {
      return {
        answer:
          "Não foi possível consultar a IA Corporativa agora. Tente novamente em instantes.",
        sources: [],
      };
    }

    const j = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = j.choices?.[0]?.message?.content?.trim() || NO_INFO;
    const uniqueSources = Array.from(new Set(data.passages.map((p) => p.source)));
    return { answer, sources: uniqueSources };
  });

/* ================================================================== */
/* IA Gerencial — analise de KPIs a partir do snapshot oficial          */
/* ================================================================== */

export type KpiInsightResult = { answer: string };

const KPI_NO_INFO =
  "Nao foi possivel responder essa solicitacao apenas com os indicadores disponiveis no snapshot atual. Ajuste o periodo ou o escopo e tente novamente.";

/**
 * IA Gerencial — analisa exclusivamente o snapshot oficial de KPIs
 * fornecido pelo cliente. Nunca inventa numeros nem inclui conteudo
 * externo. Responde em Portugues do Brasil, em tom executivo.
 */
export const askKpiInsights = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) =>
      data as { question: string; snapshot: string; monthLabel: string },
  )
  .handler(async ({ data }): Promise<KpiInsightResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente no servidor.");

    const question = (data.question || "").trim();
    if (!question) return { answer: KPI_NO_INFO };
    if (!data.snapshot) return { answer: KPI_NO_INFO };

    const system = `Voce e a IA Gerencial da Atlas Platform, especializada em analise executiva de indicadores comerciais.

REGRAS INVIOLAVEIS:
1. Utilize EXCLUSIVAMENTE os dados do SNAPSHOT abaixo. Nao invente numeros, tendencias, executivos, meses ou metricas.
2. Se a informacao solicitada nao existir no SNAPSHOT, responda claramente que a base atual nao contem esse dado e sugira o filtro adequado.
3. Nunca prometa resultados, nunca fale em nome da empresa e nunca de aconselhamento financeiro pessoal.
4. Responda em Portugues do Brasil, em tom corporativo, direto e didatico.
5. Sempre que fizer sentido, estruture a resposta com titulos curtos, listas e comparativos numericos claros.
6. Ao comparar periodos ou executivos, mostre valores absolutos e variacao percentual sempre que possivel.
7. Encerre com uma secao curta "Recomendacoes" apenas quando houver base numerica no snapshot para sustenta-la.

COMPETENCIA DE REFERENCIA: ${data.monthLabel}

SNAPSHOT OFICIAL (fonte unica de verdade):
${data.snapshot}`;

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: question },
          ],
          temperature: 0.2,
        }),
      },
    );

    if (res.status === 402) {
      return {
        answer:
          "Creditos da IA Gerencial esgotados para este workspace. Contate o administrador.",
      };
    }
    if (res.status === 429) {
      return {
        answer:
          "Limite de requisicoes da IA atingido. Aguarde alguns instantes e tente novamente.",
      };
    }
    if (!res.ok) {
      return {
        answer:
          "Nao foi possivel consultar a IA Gerencial agora. Tente novamente em instantes.",
      };
    }

    const j = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = j.choices?.[0]?.message?.content?.trim() || KPI_NO_INFO;
    return { answer };
  });