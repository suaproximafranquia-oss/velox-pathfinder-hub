/**
 * TEMPLATE OFICIAL DA E0 — LEITURA DO CADASTRO (SERVER ONLY).
 *
 * O nome técnico do template NUNCA é inventado pelo sistema: ele vem do
 * cadastro oficial (`crm_meta_templates`, finalidade `primeiro_contato`).
 * Sem cadastro aprovado, o envio real é bloqueado com motivo legível —
 * a lógica interna continua rodando e a mensagem fica registrada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ButtonRole } from "@/lib/relationship/e0-destinations";
import { isMetaApproved } from "@/lib/crm/meta-template-status";

export type MetaTemplateButton = {
  index: number;
  role: ButtonRole | null;
  text: string | null;
  /** Base de URL aprovada na Meta (o envio manda apenas o sufixo). */
  urlBase: string | null;
};

export type E0MetaTemplate = {
  name: string;
  language: string;
  buttons: MetaTemplateButton[];
  /** Nomes das variáveis do corpo, na ordem aprovada. */
  bodyVariables: string[];
};

function parseButtons(raw: unknown): MetaTemplateButton[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, position) => {
    const value = (item ?? {}) as Record<string, any>;
    const role = String(value["role"] ?? value["papel"] ?? "").toLowerCase();
    return {
      index: Number.isFinite(Number(value["index"])) ? Number(value["index"]) : position,
      role: role === "portal" || role === "contato" ? (role as ButtonRole) : null,
      text: value["text"] ?? value["texto"] ?? null,
      urlBase: value["url_base"] ?? value["urlBase"] ?? value["url"] ?? null,
    };
  });
}

function parseVariables(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) =>
      typeof item === "string" ? item : String((item as Record<string, any>)?.["name"] ?? ""),
    )
    .filter((name) => name.length > 0);
}

/**
 * Template VIGENTE da E0: finalidade `primeiro_contato`, aprovado na
 * Meta e explicitamente ativo. Um cadastro novo não assume a E0 só por
 * ter `updated_at` mais recente — a vigência é concedida na Central.
 */
export async function loadE0MetaTemplate(): Promise<E0MetaTemplate | null> {
  const { data } = await supabaseAdmin
    .from("crm_meta_templates")
    .select("meta_name,language,status,buttons,variables,purpose,is_active")
    .eq("purpose", "primeiro_contato")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as Record<string, any> | null;
  if (!row) return null;
  const name = String(row["meta_name"] ?? "").trim();
  if (name.length === 0) return null;
  // REGRA ÚNICA de aprovação — a mesma usada pelo Remarketing.
  if (!isMetaApproved(row["status"] as string | null)) return null;
  return {
    name,
    language: String(row["language"] ?? "pt_BR"),
    buttons: parseButtons(row["buttons"]),
    bodyVariables: parseVariables(row["variables"]),
  };
}

export const E0_TEMPLATE_MISSING_REASON =
  "Template oficial da Meta para a E0 não cadastrado — entrega externa pendente.";
