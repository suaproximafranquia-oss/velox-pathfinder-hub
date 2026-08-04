import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Base Oficial ÚNICA (Bloco 3).
 *
 * A Central de Conhecimento deixou de viver no navegador de cada executivo:
 * os documentos passam a ser gravados no backend e lidos por toda a equipe.
 * Assim, o que o Administrador publica alimenta imediatamente a IA
 * Corporativa de qualquer usuário, em qualquer dispositivo.
 */
export type CloudKnowledgeDocument = {
  id: string;
  workspaceId: string;
  name: string;
  type: "pdf" | "docx" | "txt";
  visibility: "publico" | "restrito";
  description?: string;
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  updatedAt: string;
  status: "processando" | "ativo" | "erro";
  chunks: string[];
};

/** Perfis autorizados a publicar/remover na Base Oficial. */
const CURATORS = new Set(["usr_thiago", "usr_larissa"]);

type Row = {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  visibility: string;
  description: string | null;
  size_bytes: number;
  uploaded_by_user_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
  updated_at: string;
  status: string;
  chunks: unknown;
};

function toDoc(row: Row): CloudKnowledgeDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    type: (row.type as CloudKnowledgeDocument["type"]) ?? "txt",
    visibility: (row.visibility as CloudKnowledgeDocument["visibility"]) ?? "publico",
    description: row.description ?? undefined,
    sizeBytes: Number(row.size_bytes ?? 0),
    uploadedByUserId: row.uploaded_by_user_id,
    uploadedByName: row.uploaded_by_name,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
    status: (row.status as CloudKnowledgeDocument["status"]) ?? "ativo",
    chunks: Array.isArray(row.chunks) ? (row.chunks as string[]) : [],
  };
}

export const listOfficialDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("knowledge_documents")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("uploaded_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { documents: ((rows ?? []) as Row[]).map(toDoc) };
  });

export const saveOfficialDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; document: CloudKnowledgeDocument }) => data)
  .handler(async ({ data }) => {
    if (!CURATORS.has(data.actorId)) {
      return { ok: false as const, reason: "sem-permissao" };
    }
    const d = data.document;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("knowledge_documents").upsert({
      id: d.id,
      workspace_id: d.workspaceId,
      name: d.name,
      type: d.type,
      visibility: d.visibility,
      description: d.description ?? null,
      size_bytes: d.sizeBytes,
      uploaded_by_user_id: d.uploadedByUserId,
      uploaded_by_name: d.uploadedByName,
      uploaded_at: d.uploadedAt,
      updated_at: new Date().toISOString(),
      status: d.status,
      chunks: d.chunks,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteOfficialDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; id: string }) => data)
  .handler(async ({ data }) => {
    if (!CURATORS.has(data.actorId)) {
      return { ok: false as const, reason: "sem-permissao" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("knowledge_documents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const resetOfficialBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { actorId: string; workspaceId: string }) => data)
  .handler(async ({ data }) => {
    if (!CURATORS.has(data.actorId)) {
      return { ok: false as const, reason: "sem-permissao" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("knowledge_documents")
      .delete()
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
