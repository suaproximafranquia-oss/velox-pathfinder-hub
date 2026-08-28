/**
 * ENTRADA DE UM LEAD NO SISTEMA — CAMINHO ÚNICO.
 *
 * Este arquivo NÃO cria comportamento novo: ele é a extração literal do
 * trecho que a sincronização já executava para cada lead recebido da
 * origem. A razão da extração é uma só — o ambiente de teste em tempo
 * real precisa percorrer EXATAMENTE o mesmo caminho de um lead real
 * (espelho → card do Workspace → E0 → motor de relacionamento), sem
 * nenhuma trilha paralela.
 *
 * Leads reais continuam entrando por aqui com o mesmo resultado de
 * antes. A única diferença possível é a MARCAÇÃO TÉCNICA de teste
 * (`isTest` / `testBatchId`), que jamais é aplicada a um lead real.
 */
import { cadenceEligibility } from "@/lib/crm/cutover";
import { executionMode } from "@/server/relationship/execution-mode.server";
import { isE0NightWindow } from "@/lib/crm/e0-window";
import { normalizeGreenSalesLead } from "@/lib/greensales/normalize";
import { resolveEntryFlow } from "@/lib/relationship/entry";
import { deferFirstContact } from "@/server/crm/first-contact-queue.server";
import { loadSettings, processWelcome } from "@/server/crm/automation.server";
import {
  getLeadEntryState,
  isNewCommercialEntry,
  recordEvent,
  upsertLead,
} from "@/server/crm/lead-service.server";
import { ensureWorkspaceCard } from "@/server/crm/workspace-card.server";
import { resolveBoardStage, type PipelineMap } from "@/server/crm/pipeline-service.server";

export type IntakeSettings = Awaited<ReturnType<typeof loadSettings>>;

export type IntakeContext = {
  pipeline: PipelineMap;
  settings: IntakeSettings;
  /** Marcação técnica de TESTE. Ausente = lead real. */
  test?: { batchId: string } | null;
  /**
   * Origem oficial da entrada. Ausente = GreenSales (comportamento
   * histórico e único caminho dos leads reais da sincronização).
   */
  entryOrigin?: import("@/lib/relationship/origin").EntryOrigin;
};

export type IntakeOutcome = {
  externalId: string;
  leadId: string | null;
  cardId: string | null;
  created: boolean;
  changed: boolean;
  /** Entrada ignorada pela segunda trava de deduplicação (telefone). */
  deduplicated: boolean;
  welcomeSent: number;
  welcomeFailed: number;
  failed: boolean;
  error?: string;
  /** O que aconteceu com o primeiro contato nesta entrada. */
  e0: "simulada" | "enviada" | "adiada" | "ignorada" | "nao_aplicavel";
  e0Reason?: string;
};

export async function intakeLead(
  raw: Record<string, unknown>,
  context: IntakeContext,
): Promise<IntakeOutcome> {
  const { pipeline, settings } = context;
  const externalId = String(raw["id"]);
  const isTest = Boolean(context.test);
  const result: IntakeOutcome = {
    externalId,
    leadId: null,
    cardId: null,
    created: false,
    changed: false,
    deduplicated: false,
    welcomeSent: 0,
    welcomeFailed: 0,
    failed: false,
    e0: "nao_aplicavel",
  };

  const normalized = normalizeGreenSalesLead(raw as never);
  // Etiquetas são PRESERVADAS integralmente: nenhuma delas filtra,
  // exclui ou impede a sincronização deste lead.
  const rawTags = Array.isArray(raw["tags"]) ? (raw["tags"] as { id: number | string }[]) : [];
  const tagIds = rawTags.map((t) => String(t.id));
  // Nova entrada comercial: a MESMA pessoa realizou um novo cadastro.
  const lastEntryAt =
    (raw["last_register_at"] as string) ??
    (raw["register"] as string) ??
    (raw["created_at"] as string) ??
    null;
  const known = await getLeadEntryState(externalId);
  const newCommercialEntry = isNewCommercialEntry(known.lastEntryAt, lastEntryAt);
  // A COLUNA/BOARD atual é a fonte da verdade.
  const { stage, remarketing } = resolveBoardStage(pipeline, tagIds);
  const forms = Array.isArray(raw["forms"]) ? (raw["forms"] as { title?: string }[]) : [];

  const outcome = await upsertLead({
    externalId,
    name: normalized.name,
    phone: normalized.whatsapp,
    email: normalized.email,
    origin: (raw["origin"] as string) ?? null,
    captureForm: forms[0]?.title ?? null,
    externalPipelineId: pipeline.externalId,
    pipelineName: pipeline.name,
    stageKey: stage?.key ?? null,
    externalStageId: stage?.externalTag ?? null,
    externalCreatedAt: (raw["created_at"] as string) ?? null,
    lastEntryAt,
    tags: rawTags,
    externalStatus: (raw["status"] as string) ?? null,
    remarketing,
    entryStage: Boolean(stage?.isEntry),
    rawPayload: raw,
    isTest,
    testBatchId: context.test?.batchId ?? null,
  });
  result.leadId = outcome.lead.id;
  result.created = outcome.created;
  result.changed = outcome.changed;
  result.deduplicated = outcome.deduplicated;
  /**
   * Duplicidade por telefone: a entrada foi absorvida pelo lead
   * existente — nenhum card, nenhuma E0, nenhuma cadência nova.
   */
  if (outcome.deduplicated) return result;

  const eligibility = cadenceEligibility(
    {
      enteredEntryStageAt: (outcome.lead as unknown as {
        entered_entry_stage_at?: string | null;
      }).entered_entry_stage_at,
      lastEntryAt,
      externalCreatedAt: (raw["created_at"] as string) ?? null,
    },
    settings.cadenceActivationDate,
  );
  const enteredNow = outcome.created ? Boolean(stage?.isEntry) : outcome.enteredEntryStage;

  if (enteredNow && !eligibility.eligible) {
    await recordEvent(outcome.lead.id, "e0_ignorada", eligibility.reason);
    result.e0 = "ignorada";
    result.e0Reason = eligibility.reason;
    return result;
  }

  /**
   * JANELA OPERACIONAL DA E0 (§16): fora de Seg–Sex 07:00–22:30 e
   * Sáb 07:00–12:00 nada é entregue. A etapa é preservada e executada
   * na próxima abertura da janela.
   */
  if (enteredNow && eligibility.eligible && isE0NightWindow()) {
    await deferFirstContact(outcome.lead.id);
    result.e0 = "adiada";
    return result;
  }

  if (enteredNow && eligibility.eligible) {
    /**
     * MODO DE EXECUÇÃO ÚNICO (COMANDO 2A §10): o caminho de entrada é
     * sempre o mesmo; o que muda é se a entrega sai ou é simulada, e
     * isso quem decide é o ambiente (homologação/lote de teste).
     */
    const mode = executionMode({ isTestLead: isTest });
    /**
     * origem → servidor → Workspace GreenSales → E0 simulada. O card
     * operacional é criado no NOSSO Workspace (carteira `portal_leads`,
     * escopo green_sales) e é nele que a mensagem e a timeline ficam.
     */
    await recordEvent(
      outcome.lead.id,
      "e0_identificada",
      `Lead novo identificado na coluna de entrada. ${eligibility.reason}`,
    );
    const card = await ensureWorkspaceCard({
      externalId,
      name: normalized.name,
      email: normalized.email,
      whatsapp: normalized.whatsapp,
      city: normalized.city,
      material: normalized.material,
      campaign: normalized.campaign,
      externalCreatedAt: (raw["created_at"] as string) ?? null,
      externalUpdatedAt: (raw["updated_at"] as string) ?? null,
      rawPayload: raw,
      isTest,
      testBatchId: context.test?.batchId ?? null,
    });
    result.cardId = card.cardId;
    if (!card.ok) {
      result.failed = true;
      result.error = `card do Workspace — ${card.error}`;
      await recordEvent(outcome.lead.id, "workspace_card_falhou", card.error);
      return result;
    }
    await recordEvent(
      outcome.lead.id,
      "workspace_card_criado",
      card.created
        ? `Card operacional criado no Workspace GreenSales (${card.cardId}).`
        : `Card operacional já existente no Workspace GreenSales (${card.cardId}).`,
    );

    /** Retorno de remarketing para NOVOS — regra oficial já existente. */
    const entry = resolveEntryFlow({
      entryCount: known.entryCount,
      hasPreviousRelationship: known.exists,
      newCommercialEntry,
    });
    const returning = remarketing || entry.reentry;
    if (returning) {
      await recordEvent(
        outcome.lead.id,
        "e0_reentrada",
        `Retorno para NOVOS de lead já conhecido${remarketing ? " (etiqueta REMARKETING preservada)" : ""} — ${entry.reason}`,
        { flow: entry.flow, remarketing, entryCount: known.entryCount },
      );
    }

    const { registerFirstContact } = await import("@/server/crm/first-contact.server");
    const e0 = await registerFirstContact({
      leadId: card.cardId,
      name: normalized.name,
      phone: normalized.whatsapp,
      origin: context.entryOrigin === "PORTAL" ? "Portal do Investidor" : "GreenSales",
      entryOrigin: context.entryOrigin ?? "GREENSALES",
      ownerId: null,
      entryAt: lastEntryAt,
      enteredEntryStageAt: (outcome.lead as unknown as {
        entered_entry_stage_at?: string | null;
      }).entered_entry_stage_at,
      reactivation: returning,
      simulated: mode.simulated,
    });
    if (e0.registered) {
      result.welcomeSent += 1;
      result.e0 = mode.simulated ? "simulada" : "enviada";
      await recordEvent(
        outcome.lead.id,
        mode.simulated ? "e0_simulada" : "e0_enviada",
        mode.simulated
          ? `${mode.reason} — mensagem registrada no card ${card.cardId} sem entrega real.`
          : `E0 executada no card ${card.cardId} pelo canal oficial.`,
      );
    } else {
      result.e0 = "ignorada";
      result.e0Reason = e0.reason;
      await recordEvent(outcome.lead.id, "e0_ignorada", e0.reason);
    }
    return result;
  }

  if (enteredNow && eligibility.eligible) {
    const welcome = await processWelcome(outcome.lead, settings);
    if (welcome === "enviada") {
      result.welcomeSent += 1;
      result.e0 = "enviada";
    }
    if (welcome === "falhou") {
      result.welcomeFailed += 1;
      result.e0 = "ignorada";
    }
  }
  return result;
}
