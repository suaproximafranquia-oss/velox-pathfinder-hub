/**
 * Central de Templates — leitura visual das telas da Meta e cadastro.
 *
 * O Portal NÃO cria, submete nem aprova templates na Meta: apenas lê as
 * capturas de tela do Gerenciador do WhatsApp e transforma o que está
 * visível em um registro organizado para o CRM.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  MetaTemplateReading,
  MetaTemplateRecord,
  MetaTemplatePurpose,
} from "@/lib/crm/meta-templates";

async function assertManager(context: { supabase: unknown; userId: string }) {
  const { getExecutiveRoleForUser } = await import("@/server/executive-auth.server");
  const role = await getExecutiveRoleForUser(context.userId);
  if (role !== "super_admin" && role !== "diretora") {
    throw new Error("Acesso restrito à gestão do CRM.");
  }
}

const clean = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^(n[ãa]o identificado|desconhecido|null|n\/a|-|—)$/i.test(text)) return null;
  return text;
};

function toRecord(row: Record<string, unknown>): MetaTemplateRecord {
  return {
    id: String(row.id),
    name: clean(row.meta_name),
    metaId: clean(row.meta_id),
    language: clean(row.language),
    category: clean(row.category),
    status: clean(row.status),
    metaUpdatedAt: clean(row.meta_updated_at),
    header: clean(row.header),
    body: clean(row.body),
    footer: clean(row.footer),
    variables: Array.isArray(row.variables) ? (row.variables as MetaTemplateRecord["variables"]) : [],
    buttons: Array.isArray(row.buttons) ? (row.buttons as MetaTemplateRecord["buttons"]) : [],
    purpose: (String(row.purpose ?? "outro") as MetaTemplatePurpose) ?? "outro",
    notes: clean(row.notes),
    createdByName: String(row.created_by_name ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/* ------------------------------------------------------ Interpretação */

const READING_SCHEMA = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    metaId: { type: ["string", "null"] },
    language: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    status: { type: ["string", "null"] },
    metaUpdatedAt: { type: ["string", "null"] },
    header: { type: ["string", "null"] },
    body: { type: ["string", "null"] },
    footer: { type: ["string", "null"] },
    variables: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          sample: { type: ["string", "null"] },
        },
        required: ["name", "sample"],
        additionalProperties: false,
      },
    },
    buttons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: ["string", "null"] },
          text: { type: ["string", "null"] },
          url: { type: ["string", "null"] },
          urlType: { type: ["string", "null"] },
        },
        required: ["type", "text", "url", "urlType"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "name",
    "metaId",
    "language",
    "category",
    "status",
    "metaUpdatedAt",
    "header",
    "body",
    "footer",
    "variables",
    "buttons",
  ],
  additionalProperties: false,
} as const;

const EMPTY_READING: MetaTemplateReading = {
  name: null,
  metaId: null,
  language: null,
  category: null,
  status: null,
  metaUpdatedAt: null,
  header: null,
  body: null,
  footer: null,
  variables: [],
  buttons: [],
};

export const interpretMetaTemplateCaptures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        captureOne: z.string().min(1),
        captureTwo: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<MetaTemplateReading> => {
    await assertManager(context as never);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Serviço de leitura indisponível no momento.");

    const images = [data.captureOne, data.captureTwo ?? ""].filter((img) =>
      img.startsWith("data:image/"),
    );
    if (!images.length) return EMPTY_READING;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Você lê capturas de tela do Gerenciador do WhatsApp da Meta e extrai a estrutura do modelo de mensagem. " +
              "Regra absoluta: NUNCA invente informação. Se um dado não estiver visível nas imagens, devolva null " +
              "(ou lista vazia). Não complete nome, ID, categoria, idioma, status, URL, botão ou variável por dedução. " +
              "Copie os textos exatamente como aparecem, preservando quebras de linha do corpo.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Estas capturas mostram o mesmo modelo de mensagem na Meta. Extraia, quando visível: nome do modelo, " +
                  "ID do modelo, idioma, categoria, status, data da última atualização, cabeçalho, corpo completo, rodapé, " +
                  "variáveis com o nome exato entre chaves duplas e sua amostra correspondente, e os botões com tipo de ação, " +
                  "texto, tipo de URL e URL. Use a função registrar_template.",
              },
              ...images.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_template",
              description: "Estrutura do modelo identificada nas capturas.",
              parameters: READING_SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_template" } },
      }),
    });

    if (res.status === 429) throw new Error("Muitas leituras seguidas. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (!res.ok) throw new Error("Não foi possível ler as capturas enviadas.");

    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const raw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!raw) return EMPTY_READING;
    try {
      const parsed = JSON.parse(raw) as Partial<MetaTemplateReading>;
      return {
        name: clean(parsed.name),
        metaId: clean(parsed.metaId),
        language: clean(parsed.language),
        category: clean(parsed.category),
        status: clean(parsed.status),
        metaUpdatedAt: clean(parsed.metaUpdatedAt),
        header: clean(parsed.header),
        body: clean(parsed.body),
        footer: clean(parsed.footer),
        variables: (parsed.variables ?? [])
          .map((v) => ({ name: clean(v?.name) ?? "", sample: clean(v?.sample) }))
          .filter((v) => v.name.length > 0),
        buttons: (parsed.buttons ?? [])
          .map((b) => ({
            type: clean(b?.type),
            text: clean(b?.text),
            url: clean(b?.url),
            urlType: clean(b?.urlType),
          }))
          .filter((b) => b.type || b.text || b.url),
      };
    } catch {
      return EMPTY_READING;
    }
  });

/* ------------------------------------------------------------ Cadastro */

export const listMetaTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MetaTemplateRecord[]> => {
    await assertManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crm_meta_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toRecord(row as Record<string, unknown>));
  });

const savePayload = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Nome do template não identificado."),
  metaId: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  metaUpdatedAt: z.string().nullable().optional(),
  header: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  footer: z.string().nullable().optional(),
  variables: z
    .array(z.object({ name: z.string(), sample: z.string().nullable() }))
    .default([]),
  buttons: z
    .array(
      z.object({
        type: z.string().nullable(),
        text: z.string().nullable(),
        url: z.string().nullable(),
        urlType: z.string().nullable(),
      }),
    )
    .default([]),
  purpose: z.string().default("outro"),
  notes: z.string().nullable().optional(),
  createdByName: z.string().default(""),
  /** true = usuário autorizou sobrescrever o cadastro existente. */
  overwrite: z.boolean().default(false),
});

export const saveMetaTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => savePayload.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { ok: true; template: MetaTemplateRecord }
      | { ok: false; reason: "duplicado"; existing: MetaTemplateRecord }
    > => {
      await assertManager(context as never);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: found } = await supabaseAdmin
        .from("crm_meta_templates")
        .select("*")
        .ilike("meta_name", data.name.trim())
        .limit(5);
      const existing = (found ?? [])
        .map((row) => toRecord(row as Record<string, unknown>))
        .find(
          (t) =>
            t.id !== data.id &&
            (t.language ?? "").toLowerCase() === (data.language ?? "").toLowerCase(),
        );

      if (existing && !data.overwrite) {
        return { ok: false as const, reason: "duplicado" as const, existing };
      }

      const row = {
        id: data.id ?? existing?.id ?? undefined,
        meta_name: data.name.trim(),
        meta_id: data.metaId ?? null,
        language: data.language ?? null,
        category: data.category ?? null,
        status: data.status ?? null,
        meta_updated_at: data.metaUpdatedAt ?? null,
        header: data.header ?? null,
        body: data.body ?? null,
        footer: data.footer ?? null,
        variables: data.variables,
        buttons: data.buttons,
        purpose: data.purpose,
        notes: data.notes ?? null,
        created_by: context.userId as string,
        created_by_name: data.createdByName,
        updated_at: new Date().toISOString(),
      };

      const { data: saved, error } = await supabaseAdmin
        .from("crm_meta_templates")
        .upsert(row)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { ok: true as const, template: toRecord(saved as Record<string, unknown>) };
    },
  );

export const deleteMetaTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertManager(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_meta_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });