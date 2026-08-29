/**
 * Permissão administrativa na interface — MESMA regra do servidor.
 *
 * O menu e as telas nunca decidem por cargo operacional: perguntam ao
 * servidor se o usuário tem PERMISSÃO administrativa (user_roles).
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { permissaoApresentacao } from "@/lib/relationship/presentation.functions";

export function useAdministrativeAccess(): boolean | null {
  const readPermission = useServerFn(permissaoApresentacao);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = (await readPermission({ data: undefined as never })) as {
          allowed: boolean;
        };
        if (active) setAllowed(Boolean(result?.allowed));
      } catch {
        if (active) setAllowed(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [readPermission]);

  return allowed;
}
