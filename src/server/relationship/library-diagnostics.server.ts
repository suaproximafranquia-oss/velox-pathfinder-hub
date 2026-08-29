/**
 * DIAGNÓSTICO DA BIBLIOTECA — SERVER ONLY, SOMENTE LEITURA.
 *
 * Torna VISÍVEL o que antes só aparecia como falha em produção:
 *  • etapa ativa no motor que exige conteúdo e não tem nenhum vínculo;
 *  • conteúdo cadastrado que não está vinculado a nenhuma etapa;
 *  • etapa ativa sem texto oficial na Biblioteca.
 *
 * Nada é corrigido automaticamente: o diagnóstico apenas informa, com
 * motivo legível, para que a operação decida.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STEPS } from "@/lib/relationship/config";
import { loadStepContentMap } from "./step-media.server";

export type LibraryDiagnostics = {
  stepsWithoutContent: { stepKey: string; contentGroup: string }[];
  stepsWithoutText: string[];
  contentsWithoutStep: { id: string; name: string }[];
};

export async function diagnoseLibrary(): Promise<LibraryDiagnostics> {
  const bindings = await loadStepContentMap();

  const { data: library } = await supabaseAdmin
    .from("relationship_message_library")
    .select("step_key,body,active")
    .eq("scope", "production")
    .eq("active", true);
  const withText = new Set(
    ((library ?? []) as any[])
      .filter((r) => String(r.body ?? "").trim().length > 0)
      .map((r) => String(r.step_key)),
  );

  const stepsWithoutContent: { stepKey: string; contentGroup: string }[] = [];
  const stepsWithoutText: string[] = [];
  for (const [stepKey, definition] of Object.entries(STEPS)) {
    if (!withText.has(stepKey)) stepsWithoutText.push(stepKey);
    const group = definition.contentGroup;
    if (!group) continue;
    if ((bindings[stepKey] ?? []).length === 0) {
      stepsWithoutContent.push({ stepKey, contentGroup: group });
    }
  }

  const boundContentIds = new Set(Object.values(bindings).flat());
  const { data: contents } = await supabaseAdmin
    .from("relationship_contents")
    .select("id,name,active")
    .eq("active", true);
  const contentsWithoutStep = ((contents ?? []) as any[])
    .filter((c) => !boundContentIds.has(String(c.id)))
    .map((c) => ({ id: String(c.id), name: String(c.name ?? "Sem nome") }));

  return { stepsWithoutContent, stepsWithoutText, contentsWithoutStep };
}
