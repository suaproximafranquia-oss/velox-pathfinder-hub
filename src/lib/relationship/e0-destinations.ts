/**
 * DESTINOS DINÂMICOS DOS BOTÕES DA E0 — REGRA PURA.
 *
 * A infraestrutura da Meta é ÚNICA e compartilhada por todos os
 * executivos: o que muda por lead não é o canal, é o DESTINO.
 *
 *   • botão do Portal   → link personalizado do executivo responsável;
 *   • botão de contato  → WhatsApp do executivo responsável.
 *
 * Nenhum número fixo, nenhum executivo padrão, nenhum administrador:
 * sem destino válido o resultado é BLOQUEIO legível, nunca um link
 * inventado ou quebrado.
 */
import { normalizeWhatsappNumber } from "@/lib/whatsapp-number";

/** Papéis de botão reconhecidos pelo motor. */
export type ButtonRole = "portal" | "contato";

export type ResolvedDestinations = {
  /** Destino do botão do Portal (link personalizado do responsável). */
  portalUrl: string | null;
  /** Destino do botão de contato humano (wa.me do responsável). */
  contactUrl: string | null;
  /** Telefone efetivamente usado no destino de contato (só dígitos). */
  contactPhone: string | null;
  /** Impedimentos legíveis — vazio quando tudo pôde ser resolvido. */
  blockers: string[];
};

export function resolveDestinations(input: {
  portalUrl: string | null | undefined;
  executiveWhatsapp: string | null | undefined;
  /** Quando true, o botão de contato é obrigatório para o envio. */
  contactRequired: boolean;
  /** Quando true, o botão do Portal é obrigatório para o envio. */
  portalRequired: boolean;
}): ResolvedDestinations {
  const blockers: string[] = [];

  const portal = (input.portalUrl ?? "").trim();
  const portalUrl = portal.length > 0 ? portal : null;
  if (!portalUrl && input.portalRequired) {
    blockers.push(
      "Link personalizado do Portal não disponível para o executivo responsável.",
    );
  }

  const number = normalizeWhatsappNumber(input.executiveWhatsapp);
  const contactUrl = number.valid ? number.waLink : null;
  const contactPhone = number.valid ? number.digits : null;
  if (!contactUrl && input.contactRequired) blockers.push(number.valid ? "" : number.reason);

  return {
    portalUrl,
    contactUrl,
    contactPhone,
    blockers: blockers.filter((b) => b.length > 0),
  };
}

/**
 * Sufixo dinâmico de um botão de URL da Meta. O template aprovado tem
 * uma base FIXA; o que viaja no envio é apenas o complemento. Se o
 * destino resolvido não pertencer à base aprovada, o envio é recusado —
 * jamais enviamos um botão apontando para fora do template.
 */
export function buttonUrlSuffix(
  base: string | null | undefined,
  destination: string,
): { ok: true; suffix: string } | { ok: false; reason: string } {
  const cleanBase = (base ?? "").trim();
  if (cleanBase.length === 0) return { ok: true, suffix: destination };
  if (!destination.startsWith(cleanBase)) {
    return {
      ok: false,
      reason:
        "Destino resolvido não corresponde ao endereço aprovado no template oficial da Meta.",
    };
  }
  return { ok: true, suffix: destination.slice(cleanBase.length) };
}
