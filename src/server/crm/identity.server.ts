/**
 * IDENTIDADE CANÔNICA — RESOLUÇÃO ÚNICA (BLOCO 2). SERVER ONLY.
 *
 * Esta é a ÚNICA função de resolução/criação de identidade canônica.
 * Ela é um VÍNCULO e nada mais:
 *
 *   • NÃO troca o id do card;
 *   • NÃO funde cards;
 *   • NÃO apaga card;
 *   • NÃO desativa card;
 *   • NÃO move histórico de um card para outro.
 *
 * O card continua sendo a unidade OPERACIONAL. A identidade canônica
 * passa a ser a unidade de AGRUPAMENTO da pessoa.
 *
 * Falha aqui nunca interrompe a entrada de um lead: a operação segue,
 * a limitação fica registrada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decideIdentityKey, namesCompatible } from "@/lib/crm/identity";

export type IdentitySource = "greensales" | "portal" | "tiktok" | "meta" | "manual";

export type IdentityResolution = {
  investorId: string | null;
  created: boolean;
  /** Mesmo identificador forte com nomes incompatíveis — sem fusão. */
  conflict: boolean;
  reason: string;
};

type InvestorRow = {
  id: string;
  name: string;
  identity_key: string | null;
  phones: string[] | null;
  emails: string[] | null;
  merged_into_id: string | null;
};

const COLUMNS = "id,name,identity_key,phones,emails,merged_into_id";

/** Segue a cadeia de fusão manual, quando houver. */
async function resolveMerged(row: InvestorRow): Promise<InvestorRow> {
  if (!row.merged_into_id) return row;
  const { data } = await supabaseAdmin
    .from("investors")
    .select(COLUMNS)
    .eq("id", row.merged_into_id)
    .maybeSingle();
  return (data as InvestorRow | null) ?? row;
}

async function logIdentityNote(action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await supabaseAdmin.from("relationship_engine_log").insert({
      scope: "production",
      action,
      details: details as never,
    } as never);
  } catch {
    /* auditoria é acessória — nunca interrompe a operação */
  }
}

/** Acrescenta telefone/e-mail à identidade sem remover nada do que existe. */
async function appendContacts(
  investor: InvestorRow,
  phone: string | null,
  email: string | null,
): Promise<void> {
  const phones = new Set((investor.phones ?? []).filter(Boolean));
  const emails = new Set((investor.emails ?? []).filter(Boolean));
  const before = phones.size + emails.size;
  if (phone) phones.add(phone);
  if (email) emails.add(email);
  if (phones.size + emails.size === before) return;
  await supabaseAdmin
    .from("investors")
    .update({ phones: [...phones], emails: [...emails] } as never)
    .eq("id", investor.id);
}

export async function resolveOrCreateInvestor(input: {
  source: IdentitySource;
  externalId: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<IdentityResolution> {
  try {
    const decision = decideIdentityKey({
      name: input.name,
      phone: input.phone,
      email: input.email,
    });
    const phone = decision.phoneKey ? decision.phoneKey.slice(2) : null;
    const email = decision.emailKey ? decision.emailKey.slice(2) : null;
    const name = String(input.name ?? "").trim() || "Sem nome";

    /** 1. Identificador da origem já vinculado — vínculo estável. */
    const { data: identifier } = await supabaseAdmin
      .from("investor_identifiers")
      .select("investor_id")
      .eq("source", input.source)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (identifier?.investor_id) {
      const { data } = await supabaseAdmin
        .from("investors")
        .select(COLUMNS)
        .eq("id", identifier.investor_id)
        .maybeSingle();
      if (data) {
        const investor = await resolveMerged(data as InvestorRow);
        await appendContacts(investor, phone, email);
        return {
          investorId: investor.id,
          created: false,
          conflict: false,
          reason: "Identidade já vinculada a este identificador de origem.",
        };
      }
    }

    /** 2. Chave forte: telefone e, na ausência dele, e-mail. */
    let investor: InvestorRow | null = null;
    let conflict = false;
    let reason = decision.reason;

    if (decision.key) {
      const { data } = await supabaseAdmin
        .from("investors")
        .select(COLUMNS)
        .eq("identity_key", decision.key)
        .maybeSingle();
      if (data) {
        const candidate = await resolveMerged(data as InvestorRow);
        if (namesCompatible(candidate.name, name)) {
          investor = candidate;
        } else {
          /**
           * CONFLITO: mesmo identificador forte, nomes claramente
           * incompatíveis. NÃO se funde e NÃO se bloqueia o lead — a
           * pessoa ganha identidade própria (sem chave) e a situação
           * fica registrada para revisão humana.
           */
          conflict = true;
          reason = `Conflito de identidade: ${decision.key} já pertence a "${candidate.name}". Sem fusão automática.`;
          await logIdentityNote("identidade_conflito", {
            key: decision.key,
            existingInvestorId: candidate.id,
            existingName: candidate.name,
            incomingName: name,
            source: input.source,
            externalId: input.externalId,
          });
        }
      }
    }

    /** 3. Criação — sem chave quando não há evidência segura. */
    let created = false;
    if (!investor) {
      const { data, error } = await supabaseAdmin
        .from("investors")
        .insert({
          name,
          identity_key: conflict ? null : decision.key,
          phones: phone ? [phone] : [],
          emails: email ? [email] : [],
        } as never)
        .select(COLUMNS)
        .maybeSingle();
      if (error || !data) {
        return {
          investorId: null,
          created: false,
          conflict,
          reason: `Identidade não resolvida: ${error?.message ?? "sem retorno"}.`,
        };
      }
      investor = data as InvestorRow;
      created = true;
    } else {
      await appendContacts(investor, phone, email);
    }

    /** 4. Vínculo do identificador de origem (idempotente). */
    await supabaseAdmin
      .from("investor_identifiers")
      .upsert(
        { investor_id: investor.id, source: input.source, external_id: input.externalId } as never,
        { onConflict: "source,external_id" },
      );

    return { investorId: investor.id, created, conflict, reason };
  } catch (error) {
    return {
      investorId: null,
      created: false,
      conflict: false,
      reason: `Identidade não resolvida: ${error instanceof Error ? error.message : "falha desconhecida"}.`,
    };
  }
}

/**
 * Grava o vínculo nos registros operacionais. Só preenche quando está
 * vazio: nenhuma referência histórica é sobrescrita.
 */
export async function linkCanonicalInvestor(input: {
  investorId: string | null;
  cardId?: string | null;
  crmLeadId?: string | null;
}): Promise<void> {
  if (!input.investorId) return;
  try {
    if (input.crmLeadId) {
      await supabaseAdmin
        .from("crm_leads")
        .update({ canonical_investor_id: input.investorId } as never)
        .eq("id", input.crmLeadId)
        .is("canonical_investor_id", null);
    }
    if (input.cardId) {
      await supabaseAdmin
        .from("portal_leads")
        .update({ canonical_investor_id: input.investorId } as never)
        .eq("id", input.cardId)
        .is("canonical_investor_id", null);
    }
  } catch {
    /* vínculo é acessório — nunca interrompe a operação */
  }
}
