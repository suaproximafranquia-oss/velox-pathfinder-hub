import { createServerFn } from "@tanstack/react-start";

export type AskPassage = { source: string; text: string };
export type AskResult = { answer: string; sources: string[] };

const NO_INFO =
  "Não localizei essa informação na documentação oficial da empresa. Recomendo confirmar essa informação com o Executivo de Expansão ou com a Gestora.";

const CORPORATE_DISCLAIMER =
  "\n\n---\nResposta construída com base na documentação oficial da empresa combinada com conhecimento técnico de caráter educativo. Informações institucionais devem ser confirmadas com o Executivo de Expansão.";

/**
 * IA Corporativa — modelo híbrido (ITEM 02 da auditoria da ETAPA 02.1):
 * a Base Oficial é a ÚNICA fonte para regras, valores e políticas da Velox;
 * o conhecimento geral de mercado é permitido para explicar conceitos
 * (consórcio, capital de giro, seguros, energia solar etc.), sempre
 * sinalizado como contexto educativo e nunca como regra interna.
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
    const passages = data.passages ?? [];

    const context = passages.length
      ? passages
          .map((p, i) => `[Trecho ${i + 1}]\n${p.text}`)
          .join("\n\n---\n\n")
      : "(Nenhum trecho da Base Oficial corresponde a esta pergunta.)";

    const system = `Você é a IA Corporativa da empresa: um especialista interno que conversa de forma natural, profissional e didática, em Português do Brasil.

MODELO HÍBRIDO DE CONHECIMENTO:

1. INFORMAÇÃO INSTITUCIONAL (exclusiva da empresa) — comissões, políticas
   internas, regras comerciais, campanhas, produtos exclusivos, valores,
   taxas, royalties, prazos, processos internos, normas e qualquer conteúdo
   institucional: use EXCLUSIVAMENTE os trechos da documentação oficial
   abaixo. Nunca crie, deduza ou estime esse tipo de informação.
   Se não estiver na documentação oficial, responda de forma natural algo
   equivalente a: "${NO_INFO}"

2. CONHECIMENTO GERAL (permitido e incentivado) — conceitos de mercado,
   boas práticas, explicações educativas: consórcio, financiamento, crédito,
   seguros, energia solar, finanças, processos comerciais, gestão e vendas.
   Explique com seu conhecimento técnico, de forma clara e educativa.

3. Em caso de conflito, a documentação oficial sempre prevalece.

EXPERIÊNCIA DA RESPOSTA (obrigatório):
4. NUNCA cite nomes de documentos, PDFs, arquivos, "fontes", "trechos",
   páginas ou qualquer referência técnica de origem.
5. NUNCA diga que uma frase foi retirada de um documento específico.
6. Fale como um especialista da empresa, em fluxo natural.
7. Quando pertinente, recomende confirmar informações institucionais com o
   Executivo de Expansão.
8. Nunca ofereça aconselhamento financeiro personalizado nem promessa de retorno.

DOCUMENTAÇÃO OFICIAL DA EMPRESA (uso interno, não mencione sua existência como arquivos):
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
    const raw = j.choices?.[0]?.message?.content?.trim() || NO_INFO;
    const answer = raw === NO_INFO ? raw : `${raw}${CORPORATE_DISCLAIMER}`;
    // A experiência não expõe nomes de documentos: fontes não são retornadas.
    return { answer, sources: [] };
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
2. SEMPRE que existirem numeros no SNAPSHOT para o periodo/escopo consultado, use-os obrigatoriamente na resposta.
   Zeros contam como dado valido — nao os trate como "sem dados".
3. Somente informe ausencia de historico quando TODOS os indicadores relevantes do SNAPSHOT estiverem literalmente ausentes
   (nao apenas iguais a zero). Nesse caso indique o filtro adequado.
4. Nunca prometa resultados, nunca fale em nome da empresa e nunca de aconselhamento financeiro pessoal.
5. Responda em Portugues do Brasil, em tom corporativo, direto e didatico.
6. Estruture a resposta com titulos curtos, listas e comparativos numericos claros sempre que fizer sentido.
7. Ao comparar periodos ou executivos, mostre valores absolutos E variacao percentual sempre que possivel.
8. Encerre com uma secao "Recomendacoes" objetiva sempre que houver base numerica suficiente no snapshot.

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