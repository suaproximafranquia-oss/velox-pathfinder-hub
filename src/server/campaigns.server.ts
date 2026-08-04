/**
 * Bloco 5 — Comunicação. Disparo de Templates Meta em campanha.
 *
 * Reutiliza o mesmo adaptador de canal do CRM (provider interno enquanto
 * não houver credenciais oficiais; Meta quando existirem), garantindo que
 * exista um único caminho de saída de mensagens na plataforma.
 */
import { activeProvider, onlyDigits } from "@/server/whatsapp.server";

export type CampaignRecipient = { phone: string; name: string };

export type CampaignDispatchResult = {
  provider: "interno" | "meta";
  sent: number;
  failed: number;
  errors: string[];
};

export async function dispatchCampaign(input: {
  recipients: CampaignRecipient[];
  campaignId: string;
}): Promise<CampaignDispatchResult> {
  const provider = activeProvider();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of input.recipients) {
    const phone = onlyDigits(r.phone);
    if (phone.length < 10) {
      failed += 1;
      errors.push(`Número inválido: ${r.phone}`);
      continue;
    }
    const res = await provider.send({
      phone,
      investorName: r.name || "investidor",
      journeyId: input.campaignId,
    });
    if (res.delivered) sent += 1;
    else {
      failed += 1;
      if (res.error) errors.push(res.error);
    }
  }

  return { provider: provider.id, sent, failed, errors: errors.slice(0, 5) };
}