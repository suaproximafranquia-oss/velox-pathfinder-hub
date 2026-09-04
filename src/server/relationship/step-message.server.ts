/**
 * MENSAGEM OFICIAL DE UMA ETAPA, PRONTA PARA O EXECUTIVO — SERVER ONLY.
 *
 * Camada de LEITURA. Não envia, não registra snapshot, não altera
 * cadência. Ela apenas resolve — com as MESMAS fontes oficiais usadas
 * pelo despachante — o que o executivo deveria mandar agora:
 *
 *   • texto: versão ATIVA da Biblioteca (`relationship_message_library`);
 *   • assinatura: EXECUTIVO RESPONSÁVEL pelo lead (nunca um padrão);
 *   • link/conteúdo: campo PRÓPRIO da versão ativa da mensagem
 *     (`content_url` / `content_label`) — não existe conteúdo separado;
 *   • nome do investidor: aplicado somente quando o cadastro tem nome
 *     utilizável — sem nome compatível, sai a versão sem personalização.
 *
 * Nenhum texto é inventado aqui: sem versão ativa na Biblioteca, a
 * interface recebe o MOTIVO do bloqueio, não uma mensagem improvisada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderFromLibrary } from "./message-library.server";
import { resolveLeadExecutive } from "./executive-identity.server";
import { investorPortalUrl } from "@/lib/portal-brands";

export type PreparedStepMessage = {
  step: string;
  /** Texto pronto para copiar; null quando a Biblioteca não tem versão ativa. */
  body: string | null;
  /** Motivo legível quando não há texto oficial disponível. */
  blockedReason: string | null;
  libraryVersion: number | null;
  /** Nome usado no tratamento (ou null quando a versão sem nome foi usada). */
  investorNameUsed: string | null;
  executiveName: string | null;
  contentName: string | null;
  contentUrl: string | null;
};

export async function prepareStepMessage(params: {
  leadId: string;
  step: string;
  /** Nome já conhecido pela camada chamadora; evita releitura do cadastro. */
  leadName?: string | null;
}): Promise<PreparedStepMessage> {
  const executive = await resolveLeadExecutive(params.leadId);

  let name = params.leadName ?? null;
  if (name === null) {
    const { data } = await supabaseAdmin
      .from("portal_leads")
      .select("name,responsible_executive_slug")
      .eq("id", params.leadId)
      .maybeSingle();
    name = (data as Record<string, any> | null)?.["name"] ?? null;
  }

  if (!executive.available) {
    return {
      step: params.step,
      body: null,
      blockedReason: executive.reason,
      libraryVersion: null,
      investorNameUsed: null,
      executiveName: null,
      contentName: null,
      contentUrl: null,
    };
  }

  const portalLink = executive.slug ? investorPortalUrl(executive.slug) : "";
  const { result, message } = await renderFromLibrary(params.step, {
    executiveName: executive.name,
    portalLink,
    rawInvestorName: name,
  });

  if (!result.ok) {
    return {
      step: params.step,
      body: null,
      blockedReason: result.reason,
      libraryVersion: message?.version ?? null,
      investorNameUsed: null,
      executiveName: executive.name,
      contentName: message?.contentLabel ?? null,
      contentUrl: message?.contentUrl ?? null,
    };
  }

  const body = result.button ? `${result.body}\n\n${result.button.url}` : result.body;
  return {
    step: params.step,
    body,
    blockedReason: null,
    libraryVersion: message?.version ?? null,
    investorNameUsed: result.treatment ?? null,
    executiveName: executive.name,
    contentName: message?.contentLabel ?? null,
    contentUrl: message?.contentUrl ?? null,
  };
}
