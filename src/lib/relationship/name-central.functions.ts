/**
 * Ponte cliente ↔ servidor da CENTRAL DOS NOMES.
 *
 * Todo acesso é exclusivo do Administrador: a mesma autorização única do
 * Corporate Workspace decide aqui (`central_nomes`), como no menu e na
 * rota. Nenhuma regra é reimplementada na interface.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(context: unknown): Promise<string> {
  const { assertWorkspaceAccess } = await import("@/server/workspace-authorization.server");
  await assertWorkspaceAccess(context as never, "central_nomes");
  const claims = (context as { claims?: Record<string, unknown> }).claims ?? null;
  return String((claims as Record<string, unknown> | null)?.["email"] ?? "Administrador");
}

export const listarNomesCentral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context);
    const { listCentralNames } = await import("@/server/relationship/name-central.server");
    return listCentralNames();
  });

export const adicionarNomesCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) => {
    if (!input?.text?.trim()) throw new Error("Cole ao menos um nome.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const actor = await guard(context);
    const { addCentralNames } = await import("@/server/relationship/name-central.server");
    return addCentralNames(data.text, actor);
  });

export const excluirNomeCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Nome não informado.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await guard(context);
    const { removeCentralName, listCentralNames } = await import(
      "@/server/relationship/name-central.server"
    );
    await removeCentralName(data.id);
    return listCentralNames();
  });
