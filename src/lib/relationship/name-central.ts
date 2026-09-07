/**
 * CENTRAL DOS NOMES — camada pura de normalização (única no projeto).
 *
 * Aqui NÃO existe banco, rede, IA, IBGE ou aprendizado. São apenas duas
 * operações determinísticas:
 *   • extrair o PRIMEIRO NOME de um texto qualquer;
 *   • gerar a CHAVE DE COMPARAÇÃO (sem acento, sem pontuação, sem
 *     diferença de caixa) usada para reconhecer e para deduplicar.
 *
 * REGRA FUNDAMENTAL: normalizar nunca cria nome. A chave só serve para
 * PROCURAR correspondência exata na Central; sem correspondência, o
 * motor recebe "sem nome".
 */

/** Remove acentos preservando a letra base. */
function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * CHAVE DE COMPARAÇÃO. "JOÃO", "joao", "Jo Ão" e "J.O.Ã.O" chegam todos
 * a "JOAO". Dígitos e qualquer pontuação são descartados como ruído.
 */
export function nameCentralKey(raw: string | null | undefined): string {
  return stripAccents(String(raw ?? ""))
    .replace(/[^A-Za-z]+/g, "")
    .toUpperCase();
}

/** Forma de exibição: primeira letra maiúscula, resto minúsculo. */
export function nameCentralDisplay(raw: string | null | undefined): string {
  const clean = String(raw ?? "")
    .replace(/[^\p{L}]+/gu, "")
    .trim();
  if (!clean) return "";
  return (
    clean.charAt(0).toLocaleUpperCase("pt-BR") +
    clean.slice(1).toLocaleLowerCase("pt-BR")
  );
}

/**
 * Primeiro nome bruto de um texto: apenas o primeiro bloco separado por
 * espaço. "João Pedro Rodrigues" → "João". Nada de nome composto.
 */
export function firstToken(raw: string | null | undefined): string {
  const value = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";
  return value.split(" ")[0] ?? "";
}

export type ParsedName = {
  /** Chave de comparação — vazia quando não sobrou letra alguma. */
  key: string;
  /** Forma sugerida de exibição, derivada do próprio texto recebido. */
  display: string;
};

/** Interpreta uma linha colada pelo Admin em um candidato a nome. */
export function parseNameEntry(raw: string | null | undefined): ParsedName | null {
  const token = firstToken(raw);
  const key = nameCentralKey(token);
  if (key.length < 2) return null;
  const display = nameCentralDisplay(token);
  if (!display) return null;
  return { key, display };
}

/**
 * Quebra o texto colado em candidatos. Aceita quebras de linha, vírgula,
 * ponto-e-vírgula e tabulação como separadores entre pessoas.
 */
export function parsePastedNames(text: string): ParsedName[] {
  const out: ParsedName[] = [];
  for (const line of String(text ?? "").split(/[\r\n;,\t]+/)) {
    const parsed = parseNameEntry(line);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Faixas de exibição — organização visual, nunca do dado armazenado. */
export type NameLengthBand = "ate6" | "de7a10" | "de11a15" | "acima15";

export const NAME_BAND_LABEL: Record<NameLengthBand, string> = {
  ate6: "Até 6 caracteres",
  de7a10: "7 a 10 caracteres",
  de11a15: "11 a 15 caracteres",
  acima15: "Acima de 15 caracteres",
};

export const NAME_BANDS: NameLengthBand[] = ["ate6", "de7a10", "de11a15", "acima15"];

export function nameBand(name: string): NameLengthBand {
  const size = name.length;
  if (size <= 6) return "ate6";
  if (size <= 10) return "de7a10";
  if (size <= 15) return "de11a15";
  return "acima15";
}
