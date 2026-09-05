/**
 * DIRETÓRIO OFICIAL DOS EXECUTIVOS — VERDADE NO SERVIDOR (COMANDO FINAL 1).
 *
 * Até aqui o cadastro vivia no navegador (`atlas:users:v3`) com o seed do
 * código por cima. A partir deste módulo a autoridade é o banco:
 *
 *   executive_profiles     → identidade, slug, WhatsApp, cargo, datas…
 *   executive_user_status  → situação ativo/inativo
 *   user_roles             → permissão administrativa
 *
 * O seed permanece apenas como BOOTSTRAP: preenche o que ainda não existe
 * no banco e nunca sobrescreve um valor gravado. Se houver dado no
 * servidor, ele vence código e navegador — sem exceção.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExecutiveDirectoryEntry = {
  executiveId: string;
  name: string | null;
  email: string | null;
  slug: string | null;
  whatsapp: string | null;
  title: string | null;
  phone: string | null;
  admissionDate: string | null;
  birthDate: string | null;
  photoUrl: string | null;
  postPresentationVideoUrl: string | null;
  gestorId: string | null;
  /**
   * BLOCO 3 — vínculo com o vendedor da origem GreenSales. É o único
   * caminho pelo qual a origem consegue apontar o responsável interno.
   */
  greensalesVendorId: string | null;
  /** "ativo" | "inativo" — ausência de linha é tratada como ativo. */
  status: "ativo" | "inativo";
};

type ProfileRow = Record<string, unknown>;

function text(row: ProfileRow, key: string): string | null {
  const value = row[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const PROFILE_COLUMNS =
  "executive_id,name,email,slug,whatsapp,title,role_title,phone,admission_date,birth_date,photo_url,post_presentation_video_url,gestor_id,greensales_vendor_id";

/**
 * Leitura do diretório. Qualquer membro autenticado do Workspace lê —
 * a interface precisa do nome, do cargo e da situação para desenhar as
 * telas. Senha NUNCA trafega por aqui.
 */
export const listarDiretorioExecutivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExecutiveDirectoryEntry[]> => {
    const [{ data: profiles, error }, { data: statuses }] = await Promise.all([
      context.supabase.from("executive_profiles").select(PROFILE_COLUMNS),
      context.supabase.from("executive_user_status").select("executive_id,status"),
    ]);
    if (error) throw new Error(error.message);

    const statusById = new Map<string, string>();
    for (const row of (statuses ?? []) as ProfileRow[]) {
      const id = text(row, "executive_id");
      const status = text(row, "status");
      if (id) statusById.set(id, status ?? "ativo");
    }

    return ((profiles ?? []) as ProfileRow[])
      .map((row) => {
        const executiveId = text(row, "executive_id");
        if (!executiveId) return null;
        return {
          executiveId,
          name: text(row, "name"),
          email: text(row, "email"),
          slug: text(row, "slug"),
          whatsapp: text(row, "whatsapp"),
          title: text(row, "title") ?? text(row, "role_title"),
          phone: text(row, "phone"),
          admissionDate: text(row, "admission_date"),
          birthDate: text(row, "birth_date"),
          photoUrl: text(row, "photo_url"),
          postPresentationVideoUrl: text(row, "post_presentation_video_url"),
          gestorId: text(row, "gestor_id"),
          greensalesVendorId: text(row, "greensales_vendor_id"),
          status: statusById.get(executiveId) === "inativo" ? "inativo" : "ativo",
        } satisfies ExecutiveDirectoryEntry;
      })
      .filter((entry): entry is ExecutiveDirectoryEntry => entry !== null);
  });

const patchSchema = z.object({
  executiveId: z.string().min(1).max(120),
  name: z.string().max(160).optional(),
  email: z.string().max(200).optional(),
  slug: z.string().max(120).optional(),
  whatsapp: z.string().max(40).optional(),
  title: z.string().max(160).optional(),
  phone: z.string().max(40).optional(),
  admissionDate: z.string().max(20).optional(),
  birthDate: z.string().max(20).optional(),
  photoUrl: z.string().max(2_000_000).optional(),
  postPresentationVideoUrl: z.string().max(2000).optional(),
  gestorId: z.string().max(120).optional(),
  greensalesVendorId: z.string().max(60).optional(),
});

function nullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Gravação da ficha oficial.
 *
 * Autorização real no servidor: Administrador mantém qualquer ficha; o
 * próprio usuário mantém a sua. A RLS da tabela repete a mesma regra —
 * a interface não é barreira de segurança em nenhum momento.
 */
export const salvarPerfilExecutivo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => patchSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { data: own } = await context.supabase
      .from("executive_profiles")
      .select("executive_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const ownId = (own as ProfileRow | null)?.["executive_id"] ?? null;

    if (isAdmin !== true && ownId !== data.executiveId) {
      throw new Error("Sem permissão para alterar a ficha deste executivo.");
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const map: Record<string, string> = {
      name: "name",
      email: "email",
      slug: "slug",
      whatsapp: "whatsapp",
      title: "title",
      phone: "phone",
      admissionDate: "admission_date",
      birthDate: "birth_date",
      photoUrl: "photo_url",
      postPresentationVideoUrl: "post_presentation_video_url",
      gestorId: "gestor_id",
      greensalesVendorId: "greensales_vendor_id",
    };
    for (const [input, column] of Object.entries(map)) {
      const value = nullable((data as Record<string, string | undefined>)[input]);
      if (value !== undefined) patch[column] = value;
    }

    const { error } = await context.supabase
      .from("executive_profiles")
      .update(patch as never)
      .eq("executive_id", data.executiveId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * REVALIDAÇÃO DA SESSÃO VIVA (§2 do Comando Final 1).
 *
 * Não basta recusar o próximo login: enquanto o usuário navega, o
 * servidor é consultado e, se o Administrador desligou o acesso, a
 * sessão é revogada na hora. Devolve apenas ativo/inativo — nenhum dado
 * pessoal — para poder ser consultada sem sessão do Supabase, cobrindo
 * inclusive o instante em que o token expirou mas a aba continua aberta.
 */
export const situacaoOperacional = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ executiveId: z.string().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ active: boolean; known: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("executive_user_status")
      .select("status")
      .eq("executive_id", data.executiveId)
      .maybeSingle();
    if (error) {
      // Falha de leitura NUNCA desloga ninguém — apenas não confirma nada.
      return { active: true, known: false };
    }
    const status = (row as ProfileRow | null)?.["status"];
    return { active: status !== "inativo", known: row !== null };
  });
