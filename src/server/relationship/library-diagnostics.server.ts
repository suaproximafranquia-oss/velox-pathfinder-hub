/**
 * DIAGNÓSTICO DA BIBLIOTECA — SERVER ONLY, SOMENTE LEITURA.
 *
 * NOVO MODELO: a mensagem é autossuficiente. Não existe mais conteúdo
 * separado nem vínculo etapa ↔ conteúdo. O diagnóstico passa a checar:
 *  • etapa ativa sem texto oficial na Biblioteca;
 *  • etapa cuja mensagem EXIGE link e cuja versão ativa está sem link.
 *
 * Nada é corrigido automaticamente: o diagnóstico apenas informa.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STEPS } from "@/lib/relationship/config";

export type LibraryDiagnostics = {
  /** Etapa cuja mensagem ativa pede link de conteúdo e está sem link. */
  stepsWithoutContent: { stepKey: string; contentGroup: string }[];
  stepsWithoutText: string[];
  /** Mantido por compatibilidade da interface — sempre vazio no novo modelo. */
  contentsWithoutStep: { id: string; name: string }[];
};

/** Variável de conteúdo dentro do texto: {{conteudo_e1}}, {{conteudo_r2}}… */
const CONTENT_PLACEHOLDER = /\{\{conteudo_[a-z0-9]+\}\}/;

export async function diagnoseLibrary(): Promise<LibraryDiagnostics> {
  const { data: library } = await supabaseAdmin
    .from("relationship_message_library")
    .select("step_key,body,body_without_name,active,content_url,button_kind")
    .eq("scope", "production")
    .eq("active", true);

  const rows = (library ?? []) as any[];
  const byStep = new Map<string, any>();
  for (const row of rows) byStep.set(String(row.step_key), row);

  const stepsWithoutContent: { stepKey: string; contentGroup: string }[] = [];
  const stepsWithoutText: string[] = [];

  for (const [stepKey, definition] of Object.entries(STEPS)) {
    const row = byStep.get(stepKey);
    const text = String(row?.body ?? "").trim();
    if (!text) {
      stepsWithoutText.push(stepKey);
      continue;
    }
    const requiresLink =
      CONTENT_PLACEHOLDER.test(text) ||
      CONTENT_PLACEHOLDER.test(String(row?.body_without_name ?? "")) ||
      row?.button_kind === "content";
    if (requiresLink && !String(row?.content_url ?? "").trim()) {
      stepsWithoutContent.push({
        stepKey,
        contentGroup: definition.contentGroup ?? "—",
      });
    }
  }

  return { stepsWithoutContent, stepsWithoutText, contentsWithoutStep: [] };
}
