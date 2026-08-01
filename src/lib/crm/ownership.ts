/**
 * CRM de Relacionamento — responsabilidade oficial do investidor.
 *
 * Base ÚNICA: todos os registros vivem na mesma estrutura do ecossistema.
 * O que muda entre usuários é exclusivamente a camada de permissões.
 *
 * Regra do primeiro relacionamento: o primeiro Executivo vinculado a um
 * investidor (inclusive por distribuição manual) permanece como o
 * responsável oficial. Sincronizações posteriores — GreenSales, Portal
 * ou importações — NUNCA reatribuem automaticamente o relacionamento.
 */
import type { Investor } from "@/lib/executive-data";

export type CrmOwnershipRecord = {
  /** Identificador do investidor na base oficial (Portal do Executivo). */
  investorId: string;
  /** Executivo responsável oficial — imutável por sincronização. */
  ownerId: string;
  /** Chaves normalizadas usadas na verificação de duplicidade. */
  phoneKey: string;
  emailKey: string;
  /** Origem que originou o vínculo oficial. */
  origin: string;
  /** Momento do vínculo oficial (ISO). */
  claimedAt: string;
};

const STORAGE_KEY = "crm.ownership.v1";

/** Normalização de telefone: apenas dígitos, comparando os 11 finais. */
export function phoneKeyOf(phone: string): string {
  const digits = (phone ?? "").replace(/\D+/g, "");
  return digits.length > 11 ? digits.slice(-11) : digits;
}

export function emailKeyOf(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

function readAll(): CrmOwnershipRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CrmOwnershipRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: CrmOwnershipRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* armazenamento indisponível — o vínculo é recalculado na próxima leitura */
  }
}

export function listOwnership(): CrmOwnershipRecord[] {
  return readAll();
}

/**
 * Garante o vínculo oficial de um investidor.
 *
 * Se já existir registro para o investidor, ele é PRESERVADO — a
 * sincronização posterior jamais troca o responsável. Devolve o registro
 * vigente e se ele foi criado agora.
 */
export function ensureOwnership(investor: Investor): {
  record: CrmOwnershipRecord;
  created: boolean;
} {
  const all = readAll();
  const existing = all.find((r) => r.investorId === investor.id);
  if (existing) return { record: existing, created: false };

  const record: CrmOwnershipRecord = {
    investorId: investor.id,
    ownerId: investor.assignedToUserId,
    phoneKey: phoneKeyOf(investor.phone),
    emailKey: emailKeyOf(investor.email),
    origin: investor.origin ?? "portal",
    claimedAt: investor.lastActivity ?? new Date().toISOString(),
  };
  writeAll([...all, record]);
  return { record, created: true };
}

/** Responsável oficial vigente (registro do CRM tem precedência). */
export function officialOwnerId(investor: Investor): string {
  const record = readAll().find((r) => r.investorId === investor.id);
  return record?.ownerId ?? investor.assignedToUserId;
}

export type CrmDuplicate = {
  /** Investidor que já possui relacionamento ativo. */
  investorId: string;
  ownerId: string;
  matchedBy: "telefone" | "e-mail" | "telefone e e-mail";
};

/**
 * Verificação automática de duplicidade por telefone e/ou e-mail contra a
 * base oficial. Devolve o relacionamento ativo já existente, quando houver.
 */
export function findDuplicate(
  candidate: Pick<Investor, "id" | "phone" | "email">,
  base: Investor[],
): CrmDuplicate | null {
  const phone = phoneKeyOf(candidate.phone);
  const email = emailKeyOf(candidate.email);
  for (const other of base) {
    if (other.id === candidate.id) continue;
    const samePhone = phone.length >= 8 && phoneKeyOf(other.phone) === phone;
    const sameEmail = email.length > 3 && emailKeyOf(other.email) === email;
    if (!samePhone && !sameEmail) continue;
    return {
      investorId: other.id,
      ownerId: officialOwnerId(other),
      matchedBy:
        samePhone && sameEmail ? "telefone e e-mail" : samePhone ? "telefone" : "e-mail",
    };
  }
  return null;
}
