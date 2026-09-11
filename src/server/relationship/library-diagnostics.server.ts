/**
 * DIAGNÓSTICO DA BIBLIOTECA — SERVER ONLY, SOMENTE LEITURA.
 *
 * A mensagem é autossuficiente: o corpo publicado contém todo o texto,
 * inclusive links quando a Gestão decidir incluí-los. O diagnóstico checa
 * somente etapas ativas sem texto oficial na Biblioteca.
 *
 * Nada é corrigido automaticamente: o diagnóstico apenas informa.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STEPS } from "@/lib/relationship/config";

export type LibraryDiagnostics = {
  /** Compatibilidade da interface histórica; links não são mais obrigatórios. */
  stepsWithoutContent: { stepKey: string; contentGroup: string }[];
  stepsWithoutText: string[];
  /** Mantido por compatibilidade da interface — sempre vazio no novo modelo. */
  contentsWithoutStep: { id: string; name: string }[];
};

export async function diagnoseLibrary(): Promise<LibraryDiagnostics> {
  const { data: library } = await supabaseAdmin
    .from("relationship_message_library")
    .select("step_key,body,active")
    .eq("scope", "production")
    .eq("active", true);

  const rows = (library ?? []) as any[];
  const byStep = new Map<string, any>();
  for (const row of rows) byStep.set(String(row.step_key), row);

  const stepsWithoutContent: { stepKey: string; contentGroup: string }[] = [];
  const stepsWithoutText: string[] = [];

  for (const stepKey of Object.keys(STEPS)) {
    const row = byStep.get(stepKey);
    const text = String(row?.body ?? "").trim();
    if (!text) {
      stepsWithoutText.push(stepKey);
      continue;
    }
  }

  return { stepsWithoutContent, stepsWithoutText, contentsWithoutStep: [] };
}
