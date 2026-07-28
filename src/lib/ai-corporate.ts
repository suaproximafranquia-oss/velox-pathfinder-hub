/**
 * IA Corporativa Transversal — Etapa 2.
 *
 * Serviço compartilhado. Não é um módulo isolado: qualquer superfície da
 * plataforma (Manual, KPI, Perfil, Reuniões, Base de Conhecimento) pode
 * invocar `answerCorporate` fornecendo o escopo do usuário autenticado.
 *
 * Regras invioláveis:
 *   1. Nunca altera dados. Nunca executa ações. Consultiva por definição.
 *   2. Respeita as capacidades declaradas em `governance.ts`.
 *   3. Fonte primária: Base de Conhecimento visível para o usuário.
 *   4. Origem da resposta é sempre identificada (documento/recurso).
 *
 * Camada de pesquisa é abstraída: hoje usa retrieval por sobreposição de
 * tokens (`retrievePassages`); amanhã pode ser trocada por embeddings ou
 * busca vetorial sem alterar consumidores.
 */
import { askKnowledge, type AskResult } from "@/lib/ai.functions";
import { can } from "@/lib/governance";
import {
  listDocuments,
  retrievePassages,
  visibleDocuments,
  type KnowledgeDocument,
} from "@/lib/knowledge-base";
import { emitEvent } from "@/lib/events/bus";
import type { ExecutiveRole } from "@/lib/executive-auth";

export type CorporateContext = {
  workspaceId: string;
  role: ExecutiveRole;
  userId: string;
  /** Contexto opcional — capítulo, KPI, investidor, reunião. */
  scope?: string;
};

export type CorporateAnswer = AskResult & { blocked?: boolean };

/** Contrato de provedor de pesquisa. Trocar sem impactar consumidores. */
export type SearchProvider = {
  search(
    question: string,
    docs: KnowledgeDocument[],
    topK?: number,
  ): { source: string; text: string }[];
};

export const tokenOverlapSearchProvider: SearchProvider = {
  search(question, docs, topK = 4) {
    return retrievePassages(question, docs, topK).map((p) => ({
      source: p.documentName,
      text: p.text,
    }));
  },
};

let activeProvider: SearchProvider = tokenOverlapSearchProvider;

/** Ponto de extensão para futuros provedores (embeddings, vetorial). */
export function setSearchProvider(provider: SearchProvider) {
  activeProvider = provider;
}

export async function answerCorporate(
  question: string,
  ctx: CorporateContext,
): Promise<CorporateAnswer> {
  if (!can(ctx.role, "ai.corporate.use")) {
    return {
      answer:
        "Você não possui permissão para consultar a IA Corporativa neste workspace.",
      sources: [],
      blocked: true,
    };
  }
  const all = listDocuments(ctx.workspaceId);
  const scoped = visibleDocuments(
    all,
    can(ctx.role, "knowledge.read.restricted") ? "interno" : "publico",
  );
  const passages = activeProvider.search(question, scoped);
  const result = await askKnowledge({ data: { question, passages } });
  emitEvent({
    type: "ai.query.answered",
    actorId: ctx.userId,
    payload: {
      scope: ctx.scope ?? null,
      sources: result.sources,
    },
  });
  return result;
}