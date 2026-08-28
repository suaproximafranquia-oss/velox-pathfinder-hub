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
        // ISOLAMENTO: se o número pertence ao ambiente de Remarketing, a
        // resposta fica lá e NUNCA entra no CRM de Relacionamento.
        const { parseInboundText, isRemarketingPhone, recordInbound } = await import(
          "@/server/remarketing/conversations.server"
        );
        const inbound = parseInboundText(payload);
        if (inbound && (await isRemarketingPhone(inbound.phone))) {
          await recordInbound({ phone: inbound.phone, body: inbound.body });
          return new Response("ok");
        }

        const reply = parseWebhookReply(payload);
        if (reply) {
          await recordReply({ phone: reply.phone, status: reply.status, raw: payload });
          return new Response("ok");
        }

        /**
         * MENSAGEM COMUM DO INVESTIDOR: entra no Motor de
         * Relacionamento pelo caminho único — identificação do lead,
         * registro idempotente, janela de 24h da Meta e a decisão de
         * resposta automática que já existia (`decideAutoReply`).
         */
        const { parseInboundMessage, handleInboundMessage } = await import(
          "@/server/relationship/inbound.server"
        );
        const inboundMessage = parseInboundMessage(payload);
        if (inboundMessage) await handleInboundMessage(inboundMessage);
        return new Response("ok");
      },
    },
  },
});