/**
 * PRIMEIRO CONTATO DO LEAD NOVO — registro interno obrigatório.
 *
 * A entrega externa pelo WhatsApp/Meta pode estar temporariamente
 * indisponível. Isso NUNCA interrompe a lógica interna: a regra é
 * acionada, o texto oficial é resolvido com as variáveis do lead, a
 * mensagem é registrada no CRM e o evento aparece no histórico. Quando o
 * canal oficial existir, a MESMA lógica passa a entregar de fato.
 *
 * A operação é idempotente: um lead recebe primeiro contato uma única vez.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildWelcomeMessage, loadSettings } from "@/server/crm/automation.server";
import { sendWhatsappText } from "@/server/crm/messaging.server";
import { cadenceEligibility } from "@/lib/crm/cutover";
import { SIMULATION_LABEL } from "@/server/relationship/execution-mode.server";
import { isE0NightWindow, nightDeferralReason } from "@/lib/crm/e0-window";

export type FirstContactInput = {
  leadId: string;
  name: string;
  phone: string;
  origin: string;
  ownerId: string | null;
  executiveName?: string | null;
  executiveSlug?: string | null;
  /** Entrada REAL do lead na origem — decide histórico x novo. */
  entryAt?: string | null;
  /** Entrada REAL na coluna NOVOS do quadro. */
  enteredEntryStageAt?: string | null;
  /** Recadastro/reativação (etiqueta REMARKETING na origem). */
  reactivation?: boolean;
  /**
   * Teste end-to-end: a lógica roda inteira até o ponto imediatamente
   * anterior à entrega real. A Meta nunca é chamada.
   */
  simulated?: boolean;
  /**
   * Origem oficial da entrada (4F-B). Decide a abertura: PORTAL → E0_V1,
   * demais → E0. Nunca converte uma origem em outra.
   */
  entryOrigin?: import("@/lib/relationship/origin").EntryOrigin;
};

export type FirstContactResult =
  | { registered: false; reason: string }
  | { registered: true; delivered: boolean; simulated: boolean; error?: string };

export async function registerFirstContact(
  input: FirstContactInput,
): Promise<FirstContactResult> {
  const settings = await loadSettings();
  // Lead histórico nunca inicia primeiro contato, mesmo reimportado.
  // A data de ativação é configuração operacional, nunca valor fixo.
  const eligibility = cadenceEligibility(
    {
      enteredEntryStageAt: input.enteredEntryStageAt ?? null,
      lastEntryAt: input.entryAt ?? null,
    },
    settings.cadenceActivationDate,
  );
  if (!eligibility.eligible) return { registered: false, reason: eligibility.reason };
  /**
   * Trava final de horário (§16): nenhuma E0 sai fora da janela
   * operacional (Seg–Sex 07:00–22:30, Sáb 07:00–12:00, Dom sem envio),
   * mesmo que alguém chame esta função diretamente. A etapa fica
   * pendente para a próxima abertura da janela.
   */
  if (isE0NightWindow()) return { registered: false, reason: nightDeferralReason() };
  const messageId = `msg_e0_${input.leadId}`;
  if (!settings.welcomeEnabled) return { registered: false, reason: "boas-vindas desativadas" };

  const message = buildWelcomeMessage(
    settings,
    input.name,
    { name: input.executiveName ?? null, slug: input.executiveSlug ?? null },
    // Recadastro usa a comunicação de reabertura já definida — nenhum
    // texto novo é criado para esta situação.
    { reactivation: Boolean(input.reactivation) },
  );
  const at = new Date().toISOString();

  /**
   * IDEMPOTÊNCIA ATÔMICA (COMANDO 2A §9): a trava é a chave primária
   * determinística da mensagem, não uma leitura anterior. Duas execuções
   * simultâneas não produzem duas E0 — a segunda recebe conflito e para.
   */
  const { error: insertError } = await supabaseAdmin.from("crm_messages").insert({
    id: messageId,
    investor_id: input.leadId,
    direction: "enviada",
    body: input.simulated ? `[${SIMULATION_LABEL}]\n\n${message.body}` : message.body,
    author_id: input.ownerId ?? "sistema",
    author_name: input.simulated ? `Primeiro contato (${SIMULATION_LABEL})` : "Primeiro contato",
    at,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { registered: false, reason: "primeiro contato já registrado" };
    }
    return { registered: false, reason: insertError.message };
  }

  // Em modo de teste a entrega externa NÃO é tentada: nenhuma chamada à
  // Meta, nenhum WhatsApp real. Fora do teste, a entrega é tentada e o
  // resultado registrado — jamais impede o registro interno.
  const delivery = input.simulated
    ? { delivered: false as const, error: undefined as string | undefined }
    : await sendWhatsappText({ phone: input.phone, body: message.body });

  await supabaseAdmin.from("crm_timeline").insert({
    id: `tl_e0_${input.leadId}`,
    investor_id: input.leadId,
    event: "primeiro_contato",
    origin: input.origin,
    reason: input.simulated
      ? `${SIMULATION_LABEL} — E0 executada até o ponto de envio. Mensagem registrada sem entrega real (Meta não acionada).`
      : delivery.delivered
        ? "Primeiro contato enviado pelo canal oficial."
        : `Primeiro contato processado e registrado. Entrega externa pendente: ${delivery.error ?? "canal indisponível"}.`,
    owner_id: input.ownerId,
    actor_id: "sistema",
    at,
  });

  /**
   * ELO QUE FALTAVA: a E0 passa a existir também para o MOTOR DE
   * RELACIONAMENTO. Sem este registro o lead nunca ganhava cadência e
   * nenhuma etapa posterior (E1 em diante) era calculada — a mensagem
   * de entrada acontecia e a sequência morria ali.
   *
   * O motor apenas registra o evento e recalcula: enquanto estiver
   * desligado, nada é enviado. Falha aqui nunca invalida a E0.
   */
  try {
    const { productionEngine } = await import("@/server/relationship/engine.server");
    const engine = productionEngine();
    /**
     * REENTRADA x PRIMEIRA ENTRADA: a etapa de abertura NÃO é fixada
     * aqui. Quem decide é a máquina de estados — reentrada abre em RE0,
     * entrada pelo Portal abre em E0_V1 e a entrada comum abre em E0.
     * Fixar "E0" fazia toda reentrada ser confundida com primeiro contato.
     */
    if (input.reactivation) {
      await engine.handleEvent({
        id: `reentry_${input.leadId}`,
        scope: "production",
        leadId: input.leadId,
        type: "LEAD_CREATED",
        at,
        data: { reentry: true },
      });
    }
    await engine.handleEvent({
      id: `e0_${input.leadId}`,
      scope: "production",
      leadId: input.leadId,
      type: "FIRST_CONTACT_SENT",
      at,
      data: {
        reentry: Boolean(input.reactivation),
        entryOrigin: input.entryOrigin ?? "GREENSALES",
      },
    });
  } catch (error) {
    console.error(
      "[first-contact] motor de relacionamento não registrou a E0:",
      error instanceof Error ? error.message : error,
    );
  }

  return {
    registered: true,
    delivered: delivery.delivered,
    simulated: Boolean(input.simulated),
    error: delivery.error,
  };
}
