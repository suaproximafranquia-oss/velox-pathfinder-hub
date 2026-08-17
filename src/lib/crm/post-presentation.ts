/**
 * AÇÃO MANUAL — PÓS-APRESENTAÇÃO (COMANDO 3D §17–§25).
 *
 * Não pertence à cadência automática: o Executivo aciona depois de ter
 * efetivamente realizado a apresentação. O sistema apenas monta a
 * mensagem e abre o editor. Nada é enviado sem revisão humana.
 *
 * O vídeo do fundador é INDIVIDUAL por executivo: nunca há fallback
 * para o link de outro executivo.
 */

export type PostPresentationContext = {
  investorName: string;
  executiveName: string;
  /** Link individual do vídeo do Mário Sérgio (por executivo). */
  videoUrl?: string | null;
  /** Portal do Investidor do executivo responsável. */
  portalLink?: string | null;
  /** Manual do Investidor — deriva do Portal do executivo quando ausente. */
  manualLink?: string | null;
};

export const POST_PRESENTATION_VARIABLES = [
  "{{nome_investidor}}",
  "{{nome_executivo}}",
  "{{link_video_pos_apresentacao}}",
  "{{link_manual_investidor}}",
  "{{link_portal}}",
] as const;

export const POST_PRESENTATION_TEMPLATE = `Olá, {{nome_investidor}}, tudo bem?

Conforme conversamos pelo telefone, gostaria de compartilhar primeiro uma mensagem especial para você.

O fundador da Velox, Mário Sérgio, gravou essa mensagem especialmente para investidores que já avançaram nessa etapa de conhecimento da oportunidade.

▶ Assistir à mensagem do Mário Sérgio: {{link_video_pos_apresentacao}}

Também quero te indicar o Manual do Investidor, que apresenta, de forma resumida e organizada, os principais pontos da franquia para você continuar sua análise com mais calma.

📘 Acessar o Manual do Investidor: {{link_manual_investidor}}

Posteriormente, quando tiver mais tempo, recomendo que você avance pelo conteúdo completo disponível no Portal do Investidor. Ele traz um aprofundamento maior sobre o modelo, a estrutura e a oportunidade da Velox.

{{link_portal}}

Depois dessa análise, me fale quais pontos você gostaria de aprofundar e seguimos a partir daí.

{{nome_executivo}}
Executivo de Expansão — Velox`;

/** Manual do Investidor do executivo responsável (nunca de outro). */
export function manualLinkFor(portalLink?: string | null): string {
  const base = (portalLink ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}/manual` : "";
}

export type PostPresentationDraft = {
  /** Mensagem pronta para revisão — vazia quando bloqueada. */
  body: string;
  /** Impedimentos: nunca enviar botão quebrado nem URL vazia (§22). */
  blockers: string[];
  blocked: boolean;
};

/**
 * Monta o rascunho. Se o executivo não possuir vídeo configurado, a
 * ação é bloqueada com aviso explícito — sem fallback de outro executivo.
 */
export function buildPostPresentationDraft(ctx: PostPresentationContext): PostPresentationDraft {
  const video = (ctx.videoUrl ?? "").trim();
  const portal = (ctx.portalLink ?? "").trim();
  const manual = (ctx.manualLink ?? "").trim() || manualLinkFor(portal);
  const blockers: string[] = [];
  if (!video) blockers.push("Vídeo de pós-apresentação não configurado para este executivo.");
  if (!portal) blockers.push("Portal do Investidor não configurado para este executivo.");
  if (blockers.length > 0) return { body: "", blockers, blocked: true };
  const body = POST_PRESENTATION_TEMPLATE.replace(/\{\{nome_investidor\}\}/g, ctx.investorName.trim())
    .replace(/\{\{nome_executivo\}\}/g, ctx.executiveName.trim())
    .replace(/\{\{link_video_pos_apresentacao\}\}/g, video)
    .replace(/\{\{link_manual_investidor\}\}/g, manual)
    .replace(/\{\{link_portal\}\}/g, portal);
  return { body, blockers: [], blocked: false };
}