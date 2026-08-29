/**
 * Página de entrada do convite E20.
 *
 * O link tem validade própria (7 dias a partir da emissão). Se venceu ou
 * foi substituído por um convite mais novo, a pessoa recebe uma
 * explicação clara — nunca uma tela de erro técnico.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resgatarConviteE20 } from "@/lib/relationship/e20.functions";

export const Route = createFileRoute("/portal/convite/$token")({
  ssr: false,
  component: ConvitePage,
  head: () => ({
    meta: [
      { title: "Convite ao Portal do Investidor | Velox" },
      {
        name: "description",
        content:
          "Acesse o Portal do Investidor Velox com o convite enviado pelo seu executivo responsável.",
      },
      { property: "og:title", content: "Convite ao Portal do Investidor | Velox" },
      {
        property: "og:description",
        content: "Seu acesso pessoal ao conteúdo preparado pelo executivo Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const redeem = useServerFn(resgatarConviteE20);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // O dispositivo do acesso é registrado como fato da auditoria
        // da apresentação — nunca inferido depois.
        const result = await redeem({
          data: { token, userAgent: navigator.userAgent ?? null },
        });
        if (cancelled) return;
        if (result.valid) {
          // Fluxo oficial: o convite entrega o visitante à Home com o
          // contexto do lead — nenhum módulo é aberto por atalho.
          void navigate({
            to: "/f",
            replace: true,
            search: { lead: result.leadId, m: "manual", o: "Convite do executivo" } as never,
          });
          return;
        }
        setMessage(result.reason);
      } catch {
        if (!cancelled) setMessage("Não foi possível validar este convite agora.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, redeem, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050b1a] px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold text-white">Convite ao Portal do Investidor</h1>
        <p className="text-sm text-white/70">{message ?? "Validando seu convite…"}</p>
      </div>
    </main>
  );
}
