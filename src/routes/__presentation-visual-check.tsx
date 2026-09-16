import { createFileRoute } from "@tanstack/react-router";
import { PublicDigitalPresentation } from "@/components/portal/public-digital-presentation";

export const Route = createFileRoute("/__presentation-visual-check")({
  component: PresentationVisualCheck,
});

function PresentationVisualCheck() {
  return (
    <PublicDigitalPresentation
      presentation={{
        muxPlaybackId: "T8aSLNEb9jVG00jFtxp7kDFmbB5g01tBI7s1ZH99FBRIU",
        introText:
          "A Velox Financeira nasceu com um propósito claro: transformar oportunidades em crescimento.\n\nEsta apresentação reúne nossa visão institucional e os próximos passos para o investidor.\n\nhttps://portalvelox.com.br/uma-url-muito-longa-para-validar-quebra-sem-overflow-horizontal",
      }}
    />
  );
}