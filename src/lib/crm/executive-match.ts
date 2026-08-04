/**
 * Correspondência oficial de Executivos (Correção — Importação OCR).
 *
 * O OCR nunca define a propriedade do Lead: ele apenas devolve um texto.
 * A propriedade é sempre resolvida contra a tabela oficial de Usuários.
 *
 * Regra 03 — enquanto todos os primeiros nomes forem únicos, apenas o
 * primeiro nome é considerado. Havendo duplicidade, o critério passa
 * automaticamente a Primeiro Nome + Sobrenome (Regra 05).
 * Regra 04 — o nome gravado é sempre o nome oficial cadastrado.
 * Regra 06/07 — sem confiança suficiente, nada é criado automaticamente.
 */
import { loadUsers } from "@/lib/executive-auth";

export type ExecutiveOption = { id: string; name: string };

export type ExecutiveMatch =
  | { confident: true; executive: ExecutiveOption }
  | { confident: false; reason: string; candidates: ExecutiveOption[] };

function normalize(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Executivos ativos da tabela oficial — única fonte de identificação. */
export function officialExecutives(): ExecutiveOption[] {
  return loadUsers()
    .filter((u) => u.status === "ativo")
    .map((u) => ({ id: u.id, name: u.name }));
}

function firstNameOf(value: string): string {
  return normalize(value).split(" ")[0] ?? "";
}

/**
 * Resolve o Executivo Responsável lido no print. O usuário logado NUNCA
 * é utilizado como fallback.
 */
export function matchExecutive(rawText: string): ExecutiveMatch {
  const users = officialExecutives();
  const text = normalize(rawText);
  if (users.length === 0) {
    return { confident: false, reason: "Nenhum Executivo cadastrado.", candidates: [] };
  }
  if (text.length < 3) {
    return {
      confident: false,
      reason: "O Executivo Responsável não foi identificado no print.",
      candidates: users,
    };
  }

  const tokens = text.split(" ").filter((t) => t.length >= 3);

  // Regra 05 — primeiro nome só é suficiente enquanto for único.
  const firstNames = users.map((u) => firstNameOf(u.name));
  const duplicated = new Set(
    firstNames.filter((n, i) => firstNames.indexOf(n) !== i),
  );

  const matches = users.filter((u) => {
    const first = firstNameOf(u.name);
    if (!first) return false;
    if (duplicated.has(first)) {
      // Primeiro nome + sobrenome precisam aparecer no texto lido.
      const parts = normalize(u.name).split(" ").slice(0, 2);
      return parts.every((p) => tokens.includes(p));
    }
    return tokens.includes(first);
  });

  if (matches.length === 1) {
    return { confident: true, executive: matches[0]! };
  }
  if (matches.length > 1) {
    return {
      confident: false,
      reason: "Mais de um Executivo corresponde ao nome lido no print.",
      candidates: matches,
    };
  }
  return {
    confident: false,
    reason: "O Executivo lido no print não existe na tabela oficial de Usuários.",
    candidates: users,
  };
}
