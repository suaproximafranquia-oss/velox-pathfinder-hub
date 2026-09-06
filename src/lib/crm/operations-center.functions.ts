/**
 * CENTRAL DE OPERAÇÕES — ponte cliente ↔ servidor. SOMENTE LEITURA.
 *
 * O ESCOPO É DECIDIDO AQUI, NO SERVIDOR, pela identidade autenticada:
 *   colaborador → apenas a própria produção;
 *   gestão      → sempre a equipe, sem linha própria;
 *   admin       → equipe ou própria operação, conforme a seleção.
 * O navegador nunca informa qual executivo será consultado, e datas
 * futuras são recusadas aqui, não apenas no calendário.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { operationalDate } from "@/lib/crm/daily-actions";

export type OperationsScopeMode = "equipe" | "propria";

type Input = { from: string; to: string; scope?: OperationsScopeMode };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const relatorioOperacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input?.from || !input?.to) throw new Error("Período obrigatório.");
    if (!DAY.test(input.from) || !DAY.test(input.to)) {
      throw new Error("Período inválido.");
    }
    if (input.from > input.to) throw new Error("Período invertido.");
    return {
      from: input.from,
      to: input.to,
      scope: input.scope === "propria" ? ("propria" as const) : ("equipe" as const),
    };
  })
  .handler(async ({ data, context }) => {
    const { assertWorkspaceAccess } = await import(
      "@/server/workspace-authorization.server"
    );
    const identity = await assertWorkspaceAccess(context as never, "central_operacoes");

    /** DATA FUTURA BLOQUEADA NO SERVIDOR — fuso operacional único. */
    const today = operationalDate();
    const from = data.from > today ? today : data.from;
    const to = data.to > today ? today : data.to;

    /** ESCOPO EFETIVO — a seleção do navegador só vale para o admin. */
    const scope: OperationsScopeMode =
      identity.role === "super_admin"
        ? data.scope
        : identity.role === "diretora"
          ? "equipe"
          : "propria";

    const mod = await import("@/server/crm/operations-center.server");
    const report = await mod.buildProductionReport({
      from,
      to,
      scope,
      executiveId: identity.executiveId,
    });

    return {
      ...report,
      viewer: {
        role: identity.role,
        executiveId: scope === "propria" ? identity.executiveId : null,
        canSwitchScope: identity.role === "super_admin",
      },
    };
  });
