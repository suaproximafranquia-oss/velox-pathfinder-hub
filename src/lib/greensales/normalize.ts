/**
 * Normalização dos dados brutos do GreenSales.
 *
 * A API entrega o telefone de duas formas: no campo principal `phone`
 * (quando o formulário coleta telefone nativo) ou dentro dos "campos
 * adicionais" — a coleção `metas` (`meta_key` / `meta_value`), que é onde
 * a interface mostra itens como "celular_(whatsapp)". Por isso o cabeçalho
 * pode dizer "Sem telefone" mesmo existindo número no lead.
 *
 * Nenhuma suposição sobre nomes exatos: procuramos por semântica
 * (telefone / celular / whatsapp / fone / mobile) e só aceitamos valores
 * que realmente pareçam um número brasileiro válido.
 */
export type GreenSalesMeta = { meta_key?: string | null; meta_value?: string | null };

export type GreenSalesRaw = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  origin?: string | null;
  metas?: GreenSalesMeta[] | null;
  [key: string]: unknown;
};

const PHONE_HINTS = ["whatsapp", "whats", "celular", "telefone", "fone", "mobile", "phone", "contato"];
const EMAIL_HINTS = ["email", "e-mail", "e_mail", "mail"];
const NAME_HINTS = ["nome", "name", "full_name", "nome_completo"];
const CITY_HINTS = ["cidade", "city", "municipio", "município"];
const CAMPAIGN_HINTS = ["campanha", "campaign"];

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function metaEntries(raw: GreenSalesRaw): { key: string; value: string }[] {
  return (raw.metas ?? [])
    .map((m) => ({ key: slug(String(m?.meta_key ?? "")), value: String(m?.meta_value ?? "").trim() }))
    .filter((m) => m.key.length > 0 && m.value.length > 0);
}

function matches(key: string, hints: string[]): boolean {
  return hints.some((h) => key.includes(h));
}

/** Número plausível: 10 a 13 dígitos (fixo/celular, com ou sem DDI 55). */
export function normalizePhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (digits.length < 10 || digits.length > 13) return "";
  return digits.startsWith("55") && digits.length >= 12 ? `+${digits}` : digits;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export type NormalizedGreenSalesLead = {
  name: string;
  email: string;
  whatsapp: string;
  city: string;
  campaign: string | null;
  material: string;
};

export function normalizeGreenSalesLead(raw: GreenSalesRaw): NormalizedGreenSalesLead {
  const metas = metaEntries(raw);

  // 1. campo principal; 2. campos adicionais equivalentes.
  let whatsapp = normalizePhone(raw.phone);
  if (!whatsapp) {
    for (const meta of metas) {
      if (!matches(meta.key, PHONE_HINTS)) continue;
      const candidate = normalizePhone(meta.value);
      if (candidate) {
        whatsapp = candidate;
        break;
      }
    }
  }

  let email = String(raw.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) {
    email = "";
    for (const meta of metas) {
      const value = meta.value.toLowerCase();
      if (matches(meta.key, EMAIL_HINTS) && isEmail(value)) {
        email = value;
        break;
      }
    }
  }

  let name = String(raw.name ?? "").trim();
  if (!name) {
    const found = metas.find((m) => matches(m.key, NAME_HINTS));
    name = found?.value ?? "";
  }

  const city = metas.find((m) => matches(m.key, CITY_HINTS))?.value ?? "";
  const campaign = metas.find((m) => matches(m.key, CAMPAIGN_HINTS))?.value || null;

  return {
    name: name || "Sem nome",
    email,
    whatsapp,
    city,
    campaign,
    material: String(raw.origin ?? "").trim(),
  };
}