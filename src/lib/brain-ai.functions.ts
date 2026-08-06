import { createServerFn } from "@tanstack/react-start";

/**
 * IA EXECUTIVA DO BRAIN ANALYTICS.
 *
 * Interpreta EXCLUSIVAMENTE os indicadores internos entregues no payload
 * (Brain Analytics + KPI Manager). Não consulta a internet, não usa
 * conhecimento público de mercado e não inventa números: apenas organiza,
 * compara e interpreta os dados recebidos.
 */
export type BrainReportSection = {
  title: string;
  paragraphs: string[];
  bullets: string[];
};

export type BrainReport = {
  title: string;
  subtitle: string;
  summary: string;
  sections: BrainReportSection[];
  recommendations: string[];
};

const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(asText).filter(Boolean).slice(0, 8) : [];

function normalize(raw: unknown, fallbackTitle: string): BrainReport {
  const o = (raw ?? {}) as Record<string, unknown>;
  const sections = Array.isArray(o.sections)
    ? (o.sections as Record<string, unknown>[]).slice(0, 6).map((s) => ({
        title: asText(s.title) || "Análise",
        paragraphs: asList(s.paragraphs),
        bullets: asList(s.bullets),
      }))
    : [];
  return {
    title: asText(o.title) || fallbackTitle,
    subtitle: asText(o.subtitle) || "Relatório Inteligente · Brain Analytics",
    summary: asText(o.summary),
    sections,
    recommendations: asList(o.recommendations),
  };
}

export const generateBrainReport = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) => data as { request: string; dataset: string },
  )
  .handler(async ({ data }): Promise<BrainReport> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Serviço de IA indisponível no momento.");

    const request = (data.request || "").trim() || "Resumo executivo do período";
    const dataset = (data.dataset || "").trim();

    const system = `Você é a IA Executiva do Brain Analytics, uma analista sênior de performance comercial que escreve em Português do Brasil, com tom corporativo, objetivo e pronto para reunião de diretoria.

REGRAS ABSOLUTAS:
1. Use EXCLUSIVAMENTE os indicadores internos fornecidos no bloco DADOS INTERNOS.
2. Nunca use internet, benchmarks de mercado, médias do setor ou conhecimento público.
3. Nunca invente números. Todo número citado deve existir nos DADOS INTERNOS.
4. Se algo não estiver nos dados, diga que o indicador não está disponível no período.
5. Nunca cite nomes de arquivos, tabelas, sistemas ou fontes técnicas.
6. Interprete: explique causa provável, impacto e prioridade — não apenas repita números.

FORMATO DE SAÍDA: responda SOMENTE com um JSON válido, sem markdown, no formato:
{"title":"...","subtitle":"...","summary":"...","sections":[{"title":"...","paragraphs":["..."],"bullets":["..."]}],"recommendations":["..."]}

Regras do conteúdo:
- "summary": 3 a 5 frases de leitura executiva.
- "sections": 3 a 5 blocos temáticos coerentes com o pedido do usuário.
- "paragraphs": 1 a 3 parágrafos curtos por bloco (máx. 60 palavras cada).
- "bullets": 2 a 5 pontos objetivos por bloco, cada um com um número dos dados.
- "recommendations": 3 a 5 ações práticas priorizadas.
- Nada de markdown, asteriscos ou títulos com "#".

DADOS INTERNOS (única fonte permitida):
${dataset}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Pedido do executivo: ${request}` },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Falha ao gerar o relatório [${res.status}]: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const cleaned = content
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    let parsed: unknown = null;
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
    if (!parsed) {
      return normalize(
        { summary: cleaned || "Não foi possível interpretar os dados do período." },
        request,
      );
    }
    return normalize(parsed, request);
  });
