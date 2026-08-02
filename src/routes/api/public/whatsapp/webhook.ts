/**
 * DEF 3.0.2 §5 — Webhook oficial da Meta.
 *
 * Recebe a resposta do investidor (CONFIRMAR / NÃO CONFIRMAR) e informa
 * o CRM. O Portal jamais fala com o WhatsApp: apenas aguarda o resultado
 * registrado aqui.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      // Verificação de assinatura do Webhook exigida pela Meta.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const expected = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const { parseWebhookReply, recordReply } = await import("@/server/whatsapp.server");
        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }
        const reply = parseWebhookReply(payload);
        if (!reply) return new Response("ok");
        await recordReply({ phone: reply.phone, status: reply.status, raw: payload });
        return new Response("ok");
      },
    },
  },
});