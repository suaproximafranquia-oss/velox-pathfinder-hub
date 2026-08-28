/**
 * PRIMEIRO CONTATO DO LEAD NOVO — PORTA DE ENTRADA ÚNICA.
 *
 * Este módulo continua sendo o ponto de entrada da E0 (elegibilidade,
 * janela operacional e chave de ativação), mas o CONTEÚDO e o ENVIO
 * passaram integralmente para o caminho oficial do motor
 * (`@/server/relationship/e0.server`): Biblioteca oficial, executivo
 * responsável real, destinos dinâmicos e snapshot congelado.
 *
 * A entrega externa pode estar indisponível; isso nunca interrompe a
 * lógica interna. A operação é idempotente: um lead recebe primeiro
 * contato uma única vez.
 */
import { loadSettings } from "@/server/crm/automation.server";
import { cadenceEligibility } from "@/lib/crm/cutover";
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
  if (!settings.welcomeEnabled) return { registered: false, reason: "boas-vindas desativadas" };

  /**
   * CAMINHO ÚNICO: conteúdo, executivo responsável, destinos dinâmicos,
   * template oficial, idempotência e snapshot vivem no motor. Aqui não
   * existe mais texto de mensagem nem chamada direta ao canal.
   */
  const { dispatchFirstContact } = await import("@/server/relationship/e0.server");
  const dispatch = await dispatchFirstContact({
    leadId: input.leadId,
    name: input.name,
    phone: input.phone,
    origin: input.origin,
    ownerId: input.ownerId,
    simulated: Boolean(input.simulated),
  });
  if (!dispatch.registered) return { registered: false, reason: dispatch.reason };
  const at = new Date().toISOString();

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
    delivered: dispatch.delivered,
    simulated: dispatch.simulated,
    ...(dispatch.error ? { error: dispatch.error } : {}),
  };
}
