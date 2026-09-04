/**
 * ORQUESTRADOR DO MOTOR DE RELACIONAMENTO (COMANDO 2A).
 *
 * Um único motor para todos os cenários: Portal, GreenSales, manual,
 * automático, visualização, resposta e desaparecimento são apenas
 * estados dentro daqui. Produção e homologação usam este mesmo código —
 * muda apenas o repositório, o despachante e o relógio.
 */
import { decideNextAction } from "./decide";
import { RELATIONSHIP_CONFIG, STEPS, type RelationshipConfig } from "./config";
import { applyEvent, blocksAutomation, initialRecord } from "./machine";
import { hasTemplateForPurpose, findBinding } from "./templates";
import { realClock, type EngineClock } from "./clock";
import type { EngineDispatcher, EngineRepository } from "./ports";
import type { CadenceRecord, EngineDecision, EngineEvent, QueueItem } from "./types";

export type Engine = {
  scope: EngineRepository["scope"];
  /** Registra um evento e recalcula o próximo passo permitido. */
  handleEvent: (event: EngineEvent) => Promise<EngineDecision>;
  /** Reavalia um lead (passagem de tempo / execução da fila). */
  tick: (leadId: string) => Promise<EngineDecision>;
  /**
   * CONFIRMAÇÃO MANUAL DE UMA ETAPA JÁ PROGRAMADA.
   *
   * O Executivo copiou e enviou a mensagem pelo WhatsApp dele. Aqui a
   * MESMA tarefa da fila é concluída — não existe fila, relógio nem
   * sequência paralela — e o avanço continua sendo do motor
   * (`scheduleFollowUp`). Nenhuma mensagem sai daqui.
   */
  confirmManualExecution: (input: {
    leadId: string;
    step: string;
    queueItemId?: string | null;
  }) => Promise<EngineDecision>;
};

export type EngineOptions = {
  repository: EngineRepository;
  dispatcher: EngineDispatcher;
  clock?: EngineClock;
  config?: RelationshipConfig;
  /** Sobrescreve o "habilitado" da configuração central (homologação). */
  enabled?: boolean;
  /** Fonte de aleatoriedade controlada da seleção de conteúdo (§6). */
  random?: () => number;
  /**
   * COMANDO 4F-B §27 — HOMOLOGAÇÃO COM TEMPLATE VIRTUAL.
   *
   * Na homologação nenhum template oficial da Meta existe e nenhuma
   * janela real é aberta. O motor então usa um template VIRTUAL: a
   * etapa é executada e registrada normalmente, apenas nunca sai do
   * ambiente. Em produção esta opção é sempre falsa.
   */
  virtualTemplates?: boolean;
  /**
   * CONTEXTO OPERACIONAL DO LEAD (etapa atual na origem).
   *
   * É por aqui que o motor sabe se o lead ainda está em NOVOS — ou
   * seja, se a primeira ação humana ainda não aconteceu — e quando ele
   * saiu dessa coluna. Sem esse contexto o motor mantém o comportamento
   * anterior e não bloqueia nada.
   */
  leadContext?: (leadId: string) => Promise<{
    awaitingFirstHumanAction?: boolean;
    leftEntryStageAt?: string | null;
    stageAtClosing?: string | null;
  } | null>;
};

/** Eventos que invalidam etapas já programadas (§96, §97, §98). */
const CANCELLING_EVENTS: Record<string, string> = {
  MESSAGE_RECEIVED: "Investidor respondeu — etapas pendentes canceladas.",
  SCHEDULE_CREATED: "Agendamento registrado — etapas pendentes canceladas.",
  MANUAL_INTERRUPTION: "Cadência interrompida manualmente — etapas pendentes canceladas.",
  CADENCE_INTERRUPTED: "Cadência interrompida — etapas pendentes canceladas.",
  CADENCE_COMPLETED: "Cadência concluída — etapas pendentes canceladas.",
  CADENCE_CLOSED: "Cadência encerrada — etapas pendentes canceladas.",
};

export function createEngine(options: EngineOptions): Engine {
  const { repository, dispatcher } = options;
  const clock = options.clock ?? realClock;
  const config = options.config ?? RELATIONSHIP_CONFIG;
  const enabled = options.enabled ?? config.enabled;
  const random = options.random ?? Math.random;
  const virtualTemplates = options.virtualTemplates ?? false;
  const leadContext = options.leadContext;

  if (repository.scope !== dispatcher.scope) {
    throw new Error("Repositório e despachante pertencem a escopos diferentes.");
  }

  async function loadOrCreate(leadId: string, at: string): Promise<CadenceRecord> {
    const existing = await repository.loadRecord(leadId);
    if (existing) return existing;
    return initialRecord({
      scope: repository.scope,
      leadId,
      runId: repository.runId,
      at,
    });
  }

  async function log(
    record: CadenceRecord,
    partial: Omit<EngineDecision, "scope" | "runId" | "leadId" | "at" | "flow" | "stateBefore" | "stateAfter"> & {
      stateBefore?: CadenceRecord["state"];
      stateAfter?: CadenceRecord["state"];
    },
  ): Promise<EngineDecision> {
    const decision: EngineDecision = {
      scope: repository.scope,
      runId: repository.runId,
      leadId: record.leadId,
      at: clock.nowIso(),
      flow: record.flow,
      stateBefore: partial.stateBefore ?? record.state,
      stateAfter: partial.stateAfter ?? record.state,
      step: partial.step,
      outcome: partial.outcome,
      reason: partial.reason,
      templateId: partial.templateId ?? null,
      templateVersion: partial.templateVersion ?? null,
      contentId: partial.contentId ?? null,
      error: partial.error ?? null,
    };
    await repository.recordDecision(decision);
    return decision;
  }

  /** Núcleo: decide e, quando permitido, executa uma única ação. */
  async function evaluate(record: CadenceRecord): Promise<EngineDecision> {
    const nowIso = clock.nowIso();
    const templates = await repository.loadTemplates();
    const context = leadContext ? ((await leadContext(record.leadId)) ?? {}) : {};

    const action = decideNextAction(record, {
      nowIso,
      enabled,
      config,
      ...context,
      hasTemplateForPurpose: (purpose) =>
        virtualTemplates || hasTemplateForPurpose(templates, purpose),
    });

    if (action.kind === "none") {
      return log(record, { step: record.currentStep, outcome: "noop", reason: action.reason });
    }

    if (action.kind === "schedule_step") {
      // §4 — a trava do destinatário acontece ANTES de a tarefa entrar
      // na fila, e não apenas no instante do envio.
      const eligible = await dispatcher.assertRecipientAllowed(record.leadId);
      if (!eligible.ok) {
        return log(record, {
          step: action.step,
          outcome: "blocked",
          reason:
            eligible.reason ??
            "Destinatário não pertence a este ambiente — tarefa não foi criada na fila.",
        });
      }
      const queue = await repository.loadQueue(record.leadId);
      const already = queue.find(
        (q) => q.step === action.step && (q.status === "PENDING" || q.status === "PROCESSING"),
      );
      if (already && already.dueAt === action.dueAt) {
        // A etapa ESTÁ programada — o resultado é "scheduled", e não um
        // "nada aconteceu". Reportar noop aqui escondia a fila real.
        return log(record, {
          step: action.step,
          outcome: "scheduled",
          reason: `Etapa ${action.step} já está programada para ${action.dueAt}.`,

        });
      }
      const item: Omit<QueueItem, "id"> & { id?: string } = {
        id: already?.id,
        scope: repository.scope,
        runId: repository.runId,
        leadId: record.leadId,
        flow: action.flow,
        step: action.step,
        dueAt: action.dueAt,
        priority: 5,
        status: "PENDING",
        attempts: already?.attempts ?? 0,
        executedAt: null,
        result: null,
        reason: action.reason,
      };
      await repository.upsertQueueItem(item);
      return log(record, { step: action.step, outcome: "scheduled", reason: action.reason });
    }

    // send_step — última verificação antes de qualquer saída de mensagem.
    const allowed = await dispatcher.assertRecipientAllowed(record.leadId);
    if (!allowed.ok) {
      return log(record, {
        step: action.step,
        outcome: "blocked",
        reason: allowed.reason ?? "Destinatário não pertence a este ambiente — envio bloqueado.",
      });
    }

    const binding = action.requiresTemplate
      ? findBinding(templates, action.templatePurpose)
      : null;
    if (
      action.requiresTemplate &&
      config.requireOfficialTemplate &&
      !binding?.templateId &&
      !virtualTemplates
    ) {
      return log(record, {
        step: action.step,
        outcome: "blocked",
        reason: `Janela fechada e sem template oficial para "${action.templatePurpose}".`,
      });
    }

    /**
     * CONTEÚDO PERTENCE À MENSAGEM. Não existe mais seleção, pool nem
     * rotação de conteúdo separado: o link (quando houver) vive na
     * versão ativa da Biblioteca e é resolvido na renderização.
     */
    const queue = await repository.loadQueue(record.leadId);
    const pending = queue.find(
      (q) => q.step === action.step && (q.status === "PENDING" || q.status === "PROCESSING"),
    );
    if (pending?.status === "PROCESSING") {
      return log(record, {
        step: action.step,
        outcome: "noop",
        reason: `Etapa ${action.step} já está em execução por outro processo.`,
      });
    }
    /**
     * CONTINUIDADE DAS TENTATIVAS. Uma etapa que já esgotou o limite não
     * pode voltar à estaca zero a cada ciclo: sem isto, o mesmo envio
     * falho era tentado indefinidamente e o limite de tentativas nunca
     * se aplicava de fato.
     */
    const failed = queue.find((q) => q.step === action.step && q.status === "FAILED");
    if (failed && failed.attempts >= config.maxAttempts) {
      return log(record, {
        step: action.step,
        outcome: "blocked",
        reason: `Etapa ${action.step} esgotou ${failed.attempts} tentativas e permanece parada para revisão humana. Último erro: ${failed.reason ?? "não registrado"}.`,
      });
    }
    const previousAttempts = pending?.attempts ?? failed?.attempts ?? 0;
    const item = await repository.upsertQueueItem({
      id: pending?.id ?? failed?.id,
      scope: repository.scope,
      runId: repository.runId,
      leadId: record.leadId,
      flow: action.flow,
      step: action.step,
      dueAt: clock.nowIso(),
      priority: 5,
      status: "PENDING",
      attempts: previousAttempts + 1,
      executedAt: null,
      result: null,
      reason: action.reason,
    });


    // Trava atômica: dois processos podem chegar aqui, mas apenas um
    // consegue reservar a tarefa. O outro encerra sem enviar nada.
    const claimed = await repository.claimQueueItem(item.id);
    if (!claimed) {
      return log(record, {
        step: action.step,
        outcome: "noop",
        reason: `Etapa ${action.step} já reservada por outro processo — duplicidade evitada.`,
      });
    }

    const result = await dispatcher.send({
      scope: repository.scope,
      leadId: record.leadId,
      step: action.step,
      useTemplate: action.requiresTemplate,
      templateId: binding?.templateId ?? null,
      contentId: null,
    });

    if (!result.delivered) {
      const exhausted = item.attempts >= config.maxAttempts;
      await repository.updateQueueItem(item.id, {
        status: exhausted ? "FAILED" : "PENDING",
        result: "erro",
        reason: result.error ?? "Falha no envio.",
      });
      return log(record, {
        step: action.step,
        outcome: "failed",
        reason: exhausted
          ? `Etapa ${action.step} marcada como FAILED após ${item.attempts} tentativas — não avança para a próxima.`
          : `Falha no envio de ${action.step}; nova tentativa controlada será feita.`,
        templateId: binding?.templateId ?? null,
        templateVersion: binding?.version ?? null,
        error: result.error ?? null,
      });
    }

    await repository.updateQueueItem(item.id, {
      status: "EXECUTED",
      executedAt: clock.nowIso(),
      result: result.externalId ?? "enviado",
    });

    const stateBefore = record.state;
    const sentEvent: EngineEvent = {
      id: `${repository.scope}:${record.leadId}:${action.step}:sent`,
      scope: repository.scope,
      leadId: record.leadId,
      type: action.step === "E0" ? "FIRST_CONTACT_SENT" : "MESSAGE_SENT",
      at: clock.nowIso(),
      step: action.step,
      templateId: binding?.templateId ?? null,
      contentId: null,
    };
    const fresh = await repository.registerEvent(sentEvent);
    let updated = fresh ? applyEvent(record, sentEvent, config).record : record;

    if (STEPS[action.step].terminal) {
      const closeEvent: EngineEvent = {
        id: `${repository.scope}:${record.leadId}:${action.step}:completed`,
        scope: repository.scope,
        leadId: record.leadId,
        type: "CADENCE_COMPLETED",
        at: clock.nowIso(),
        data: { reason: `Fluxo ${action.flow} concluído na etapa ${action.step}.` },
      };
      if (await repository.registerEvent(closeEvent)) {
        updated = applyEvent(updated, closeEvent, config).record;
        await repository.cancelPendingItems(record.leadId, "Cadência encerrada.");
      }
    }

    await repository.saveRecord(updated);
    /**
     * ENCADEAMENTO: executar uma etapa precisa deixar a PRÓXIMA já
     * programada na fila. Sem isto a continuidade dependia inteiramente
     * do próximo ciclo do agendador — e um lead ficava sem nenhuma
     * tarefa visível no intervalo, dando a impressão de cadência parada.
     */
    const nextStep = await scheduleFollowUp(updated);
    return log(updated, {
      step: action.step,
      outcome: "sent",
      reason: `${action.reason}${
        nextStep ? ` Próxima etapa programada: ${nextStep}.` : ""
      }`,
      templateId: binding?.templateId ?? null,
      templateVersion: binding?.version ?? null,
      contentId: null,
      stateBefore,
      stateAfter: updated.state,
    });
  }

  /**
   * Programa (sem executar) a próxima etapa permitida. Nunca envia:
   * apenas garante que a tarefa exista na fila com o vencimento certo.
   */
  async function scheduleFollowUp(record: CadenceRecord): Promise<string | null> {
    try {
      const templates = await repository.loadTemplates();
      const context = leadContext ? ((await leadContext(record.leadId)) ?? {}) : {};
      const action = decideNextAction(record, {
        nowIso: clock.nowIso(),
        enabled,
        config,
        ...context,
        hasTemplateForPurpose: (purpose) =>
          virtualTemplates || hasTemplateForPurpose(templates, purpose),
      });
      if (action.kind === "none") return null;
      const dueAt = action.kind === "schedule_step" ? action.dueAt : clock.nowIso();
      const queue = await repository.loadQueue(record.leadId);
      const existing = queue.find(
        (q) => q.step === action.step && (q.status === "PENDING" || q.status === "PROCESSING"),
      );
      if (existing && existing.dueAt === dueAt) return action.step;
      await repository.upsertQueueItem({
        id: existing?.id,
        scope: repository.scope,
        runId: repository.runId,
        leadId: record.leadId,
        flow: action.flow,
        step: action.step,
        dueAt,
        priority: 5,
        status: "PENDING",
        attempts: existing?.attempts ?? 0,
        executedAt: null,
        result: null,
        reason: action.reason,
      });
      return action.step;
    } catch {
      // Programar a próxima etapa é complementar: a etapa já executada
      // permanece válida mesmo se este passo falhar.
      return null;
    }
  }


  return {
    scope: repository.scope,

    async handleEvent(event) {
      if (event.scope !== repository.scope) {
        throw new Error("Evento de outro ambiente não pode ser processado por este motor.");
      }
      const at = event.at || clock.nowIso();
      const record = await loadOrCreate(event.leadId, at);

      const fresh = await repository.registerEvent({ ...event, at });
      if (!fresh) {
        return log(record, {
          step: record.currentStep,
          outcome: "noop",
          reason: `Evento ${event.type} já processado anteriormente — efeito não duplicado.`,
        });
      }

      const stateBefore = record.state;
      const transition = applyEvent(record, { ...event, at }, config);
      await repository.saveRecord(transition.record);

      const cancelReason = event.historical ? null : CANCELLING_EVENTS[event.type];
      if (cancelReason) {
        await repository.cancelPendingItems(event.leadId, cancelReason);
      }

      if (event.historical) {
        return log(transition.record, {
          step: event.step ?? transition.record.currentStep,
          outcome: "noop",
          reason: "Evento histórico: registrado sem gerar nova etapa.",
          stateBefore,
          stateAfter: transition.record.state,
        });
      }

      const blocked = blocksAutomation(transition.record);
      if (blocked) {
        return log(transition.record, {
          step: transition.record.currentStep,
          outcome: "blocked",
          reason: `${transition.reason} ${blocked}`.trim(),
          stateBefore,
          stateAfter: transition.record.state,
        });
      }

      return evaluate(transition.record);
    },

    async confirmManualExecution({ leadId, step, queueItemId }) {
      const record = await loadOrCreate(leadId, clock.nowIso());
      const queue = await repository.loadQueue(leadId);
      const item =
        (queueItemId ? queue.find((q) => q.id === queueItemId) : undefined) ??
        queue.find(
          (q) => q.step === step && (q.status === "PENDING" || q.status === "PROCESSING"),
        );

      if (!item) {
        return log(record, {
          step,
          outcome: "noop",
          reason: `Nenhuma tarefa de ${step} encontrada na fila para confirmar.`,
        });
      }
      if (item.status === "EXECUTED") {
        return log(record, {
          step,
          outcome: "noop",
          reason: `Etapa ${step} já estava concluída — confirmação não duplicada.`,
        });
      }

      // Trava atômica: só um processo conclui a tarefa.
      if (item.status === "PENDING" && !(await repository.claimQueueItem(item.id))) {
        return log(record, {
          step,
          outcome: "noop",
          reason: `Etapa ${step} já está sendo concluída por outro processo.`,
        });
      }

      await repository.updateQueueItem(item.id, {
        status: "EXECUTED",
        executedAt: clock.nowIso(),
        result: "enviado_manual",
      });

      const stateBefore = record.state;
      const sentEvent: EngineEvent = {
        id: `${repository.scope}:${leadId}:${step}:sent`,
        scope: repository.scope,
        leadId,
        type: step === "E0" ? "FIRST_CONTACT_SENT" : "MESSAGE_SENT",
        at: clock.nowIso(),
        step,
      };
      const fresh = await repository.registerEvent(sentEvent);
      let updated = fresh ? applyEvent(record, sentEvent, config).record : record;

      if (STEPS[step]?.terminal) {
        const closeEvent: EngineEvent = {
          id: `${repository.scope}:${leadId}:${step}:completed`,
          scope: repository.scope,
          leadId,
          type: "CADENCE_COMPLETED",
          at: clock.nowIso(),
          data: { reason: `Fluxo concluído na etapa ${step}.` },
        };
        if (await repository.registerEvent(closeEvent)) {
          updated = applyEvent(updated, closeEvent, config).record;
          await repository.cancelPendingItems(leadId, "Cadência encerrada.");
        }
      }

      await repository.saveRecord(updated);
      const nextStep = await scheduleFollowUp(updated);
      return log(updated, {
        step,
        outcome: "sent",
        reason:
          `Etapa ${step} confirmada manualmente pelo Executivo na Ação do Dia.` +
          (nextStep ? ` Próxima etapa programada: ${nextStep}.` : ""),
        stateBefore,
        stateAfter: updated.state,
      });
    },

    async tick(leadId) {
      const record = await loadOrCreate(leadId, clock.nowIso());
      if (record.state === "CADENCE_NOT_STARTED") {
        return log(record, {
          step: null,
          outcome: "noop",
          reason: "Cadência não iniciada — o primeiro contato precisa ser executado antes.",
        });
      }
      return evaluate(record);
    },
  };
}