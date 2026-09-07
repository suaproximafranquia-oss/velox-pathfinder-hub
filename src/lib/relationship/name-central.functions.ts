/**
 * Ponte cliente ↔ servidor da CENTRAL DOS NOMES.
 *
 * Todo acesso é exclusivo do Administrador: a mesma autorização única do
 * Corporate Workspace decide aqui (`central_nomes`), como no menu e na
 * rota. Nenhuma regra é reimplementada na interface.
 *
 * A entrega de conteúdo (colagem ou Word) apenas REGISTRA um trabalho e
 * volta imediatamente. Quem digere é a fila no servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(context: unknown): Promise<string> {
  const { assertWorkspaceAccess } = await import("@/server/workspace-authorization.server");
  await assertWorkspaceAccess(context as never, "central_nomes");
  const claims = (context as { claims?: Record<string, unknown> }).claims ?? null;
  return String((claims as Record<string, unknown> | null)?.["email"] ?? "Administrador");
}

export const listarNomesCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { search?: string; offset?: number; limit?: number }) => input ?? {})
  .handler(async ({ data, context }) => {
    await guard(context);
    const { listCentralNames } = await import("@/server/relationship/name-central.server");
    return listCentralNames(data);
  });

export const totalNomesCentral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { countCentralNames } = await import("@/server/relationship/name-central.server");
    return { total: await countCentralNames() };
  });

/** Estado da importação: em andamento, concluída ou com erro. */
export const situacaoImportacaoNomes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { getActiveImport, getLatestImport } = await import(
      "@/server/relationship/name-central-import.server"
    );
    const { countCentralNames } = await import("@/server/relationship/name-central.server");
    const active = await getActiveImport();
    const job = active ?? (await getLatestImport());
    return { job, total: await countCentralNames() };
  });

export const enviarNomesCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) => {
    if (!input?.text?.trim()) throw new Error("Cole ao menos um nome.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const actor = await guard(context);
    const { enqueueNameImport } = await import(
      "@/server/relationship/name-central-import.server"
    );
    return enqueueNameImport({ text: data.text, source: "colagem", actor });
  });

/** Upload Word: o servidor extrai o texto e usa o MESMO pipeline da colagem. */
export const enviarWordCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filename: string; base64: string }) => {
    if (!input?.base64) throw new Error("Selecione um arquivo .docx.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const actor = await guard(context);
    const { enqueueNameImport, extractDocxText } = await import(
      "@/server/relationship/name-central-import.server"
    );
    const binary = atob(data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const text = await extractDocxText(bytes);
    return enqueueNameImport({
      text,
      source: "word",
      filename: data.filename,
      actor,
    });
  });

export const excluirNomeCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Nome não informado.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await guard(context);
    const { removeCentralName } = await import("@/server/relationship/name-central.server");
    await removeCentralName(data.id);
    return { ok: true };
  });
