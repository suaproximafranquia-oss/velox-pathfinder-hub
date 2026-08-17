/**
 * COMANDO 4E §24/§25/§45 — IDENTIFICAÇÃO CADASTRAL (sem validação real).
 *
 * A validação real por WhatsApp foi REMOVIDA da plataforma: não existe
 * OTP, código, template de confirmação, envio automático, chamada à Meta
 * nem resposta "CONFIRMAR / NÃO CONFIRMAR". O Gateway apenas identifica
 * o investidor pelos dados cadastrais (nome, e-mail e WhatsApp).
 *
 * Este módulo registra apenas o número informado, para que a jornada
 * possa ser reencontrada no futuro. Nenhuma mensagem é enviada.
 */
import { logAudit } from "@/lib/audit-log";
import { updateLead } from "@/lib/leads";
import { notifySync } from "@/lib/sync-bus";

const KEY = "velox:portal:phone-registry:v1";

export type PhoneRegistryRecord = {
  investorId: string;
  phone: string;
  /** Momento em que o número foi informado/atualizado pelo investidor. */
  registeredAt: string;
  /** Quantas vezes o investidor revisou o número. */
  updates: number;
};

type Store = Record<string, PhoneRegistryRecord>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* armazenamento indisponível */
  }
  notifySync("commercial");
}

export function getPhoneRegistry(investorId: string): PhoneRegistryRecord | null {
  return read()[investorId] ?? null;
}

/**
 * §28 — "Usar este número" ou "Salvar número": atualiza o cadastro
 * existente. Nunca cria outro registro, nunca envia mensagem.
 */
export function registerPortalPhone(input: {
  investorId: string;
  investorName: string;
  phone: string;
}): PhoneRegistryRecord {
  const store = read();
  const previous = store[input.investorId];
  const phone = input.phone.replace(/\D/g, "");
  const record: PhoneRegistryRecord = {
    investorId: input.investorId,
    phone,
    registeredAt: new Date().toISOString(),
    updates: (previous?.updates ?? 0) + 1,
  };
  store[input.investorId] = record;
  write(store);

  if (!previous || previous.phone !== phone) {
    updateLead(input.investorId, { whatsapp: phone });
    logAudit({
      actorId: input.investorId,
      actorName: input.investorName,
      actorRole: "Investidor identificado",
      module: "investidores",
      action: previous
        ? "Número de WhatsApp atualizado no cadastro da jornada"
        : "Número de WhatsApp informado no cadastro da jornada",
      target: input.investorName,
      details:
        "Identificação cadastral. Nenhuma mensagem foi enviada e nenhuma validação técnica foi realizada.",
      severity: "info",
    });
  }
  return record;
}

/**
 * §30 — a identificação cadastral é suficiente: todos os módulos do
 * Portal ficam disponíveis. Nenhuma barreira artificial permanece.
 */
export function isPortalUnlocked(investorId: string | null | undefined): boolean {
  return Boolean(investorId);
}

/** Compatibilidade: o cadastro acompanha a promoção do registro. */
export function transferVerification(fromId: string, toId: string): void {
  const store = read();
  const record = store[fromId];
  if (!record || fromId === toId) return;
  delete store[fromId];
  store[toId] = { ...record, investorId: toId };
  write(store);
}

/**
 * Compatibilidade com a sincronização servidor→navegador. Não existe
 * mais confirmação a espelhar: mantido como no-op explícito para que
 * nenhum caminho antigo reative a validação removida.
 */
export function applyRemoteConfirmation(
  _investorId: string,
  _confirmedAt?: string | null,
  _phone?: string,
): void {
  /* validação real removida — COMANDO 4E §24 */
}
