/**
 * COMANDO 3 §8 — LINKS OFICIAIS DE CANAL.
 *
 *   https://portalvelox.com.br/origem/tiktok
 *   https://portalvelox.com.br/origem/meta
 *
 * Estes links são a porta de entrada das campanhas oficiais do TikTok e
 * da Meta. O visitante nunca vê esta rota: ela apenas grava o contexto
 * de canal e redireciona para a Home do Portal, onde o Gateway oficial
 * identifica o investidor e a jornada começa pelo Manual.
 *
 * Regras:
 *  - canal inválido cai na Home institucional sem contexto de canal;
 *  - o canal decide a CARTEIRA do Workspace (escopo "tiktok"/"meta") na
 *    fonte central de propriedade — ver `src/lib/portal/ownership.ts`;
 *  - leads de canal NUNCA entram no escopo Green Sales (que é exclusivo
 *    dos links personalizados de executivos).
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

const CHANNEL_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  meta: "Meta",
};

export const Route = createFileRoute("/origem/$channel")({
  beforeLoad: ({ params }) => {
    const channel = params.channel.toLowerCase();
    const label = CHANNEL_LABEL[channel];
    if (!label) {
      // Canal desconhecido: Home institucional, sem contexto de canal.
      throw redirect({ to: "/f", replace: true, search: {} });
    }
    throw redirect({
      to: "/f",
      replace: true,
      search: { m: "manual", o: label, ch: channel },
    });
  },
  component: () => null,
});
