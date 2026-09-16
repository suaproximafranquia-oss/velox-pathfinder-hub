/**
 * Página da APRESENTAÇÃO DIGITAL (convite E6/E20).
 *
 * O que o investidor vê é o roteiro CONGELADO na emissão do seu convite
 * — nunca o roteiro administrativo atual. Se o link venceu ou foi
 * encerrado, a pessoa recebe uma explicação clara, nunca um erro
 * técnico.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resgatarConviteE20 } from "@/lib/relationship/e20.functions";
import {
  PublicDigitalPresentation,
  type PublicDigitalPresentationData,
} from "@/components/portal/public-digital-presentation";

export const Route = createFileRoute("/portal/convite/$token")({
  ssr: false,
  component: ConvitePage,
  head: () => ({
    meta: [
      { title: "Apresentação Digital | Velox" },
      {
        name: "description",
        content:
          "Acesse a Apresentação Digital preparada pelo seu executivo responsável no Portal do Investidor Velox.",
      },
      { property: "og:title", content: "Apresentação Digital | Velox" },
      {
        property: "og:description",
        content: "Seu acesso pessoal ao conteúdo preparado pelo executivo Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ConvitePage() {
  const { token } = Route.useParams();
  const redeem = useServerFn(resgatarConviteE20);
  const [message, setMessage] = useState<string | null>(null);
  const [presentation, setPresentation] = useState<PublicDigitalPresentationData | null>(
    token === "visual-check"
      ? {
          muxPlaybackId: "T8aSLNEb9jVG00jFtxp7kDFmbB5g01tBI7s1ZH99FBRIU",
          introText:
            "A Velox Financeira nasceu com um propósito claro: transformar oportunidades em crescimento.\n\nEsta apresentação reúne nossa visão institucional e os próximos passos para o investidor.\n\nhttps://portalvelox.com.br/uma-url-muito-longa-para-validar-quebra-sem-overflow-horizontal",
        }
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    if (token === "visual-check") return () => undefined;
    void (async () => {
      try {
        // O dispositivo do acesso é registrado como fato da auditoria
        // da apresentação — nunca inferido depois.
        const result = await redeem({
          data: { token, userAgent: navigator.userAgent ?? null },
        });
        if (cancelled) return;
        if (!result.valid) {
          setMessage(result.reason);
          return;
        }
        setPresentation(result.presentation);
      } catch {
        if (!cancelled) setMessage("Não foi possível validar este convite agora.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, redeem]);

  if (presentation) return <PublicDigitalPresentation presentation={presentation} />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-deep px-6 text-center text-navy-foreground">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Apresentação Digital</h1>
        <p className="text-sm text-muted-foreground">{message ?? "Validando seu convite…"}</p>
      </div>
    </main>
  );
}
