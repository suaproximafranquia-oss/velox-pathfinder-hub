/**
 * Cenários mínimos do motor (COMANDO 2A §114). Não substituem o
 * COMANDO 3 — apenas provam que as regras centrais estão corretas.
 */
import { describe, expect, it } from "vitest";
import { RELATIONSHIP_CONFIG, STEPS } from "./config";
import { decideNextAction } from "./decide";
import { applyEvent, initialRecord } from "./machine";
import { dueMomentAfterBusinessDays, isBusinessDay } from "./calendar";
import type { CadenceRecord, EngineEvent } from "./types";

const config = { ...RELATIONSHIP_CONFIG, enabled: true };
const always = () => true;

function record(): CadenceRecord {
  return initialRecord({ scope: "homologation", leadId: "TEST-0001", at: "2026-08-14T12:00:00Z" });
}

function event(type: EngineEvent["type"], at: string, extra: Partial<EngineEvent> = {}): EngineEvent {
  return { id: `${type}-${at}`, scope: "homologation", leadId: "TEST-0001", type, at, ...extra };
}

describe("calendário", () => {
  it("sábado e domingo não são dias úteis", () => {
    expect(isBusinessDay("2026-08-15")).toBe(false); // sábado
    expect(isBusinessDay("2026-08-16")).toBe(false); // domingo
    expect(isBusinessDay("2026-08-17")).toBe(true);
  });

  it("etapa que cairia no sábado vai para segunda", () => {
    const due = dueMomentAfterBusinessDays("2026-08-14T18:00:00Z", 1, config);
    expect(due.slice(0, 10)).toBe("2026-08-17");
  });
});

describe("motor", () => {
  it("primeiro contato ativa a cadência em E0", () => {
    const after = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config);
    expect(after.record.state).toBe("CADENCE_ACTIVE");
    expect(after.record.executedSteps).toEqual(["E0"]);
  });

  it("resposta interrompe a cadência original", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("MESSAGE_RECEIVED", "2026-08-17T13:00:00Z"), config).record;
    expect(r.state).toBe("RESPONDED");
    expect(r.flow).toBe("reengajamento");
    const action = decideNextAction(r, {
      nowIso: "2026-08-17T14:00:00Z",
      config,
      hasTemplateForPurpose: always,
    });
    expect(action.kind).toBe("none");
  });

  it("visualizar não é responder, mas a segunda visualização troca o fluxo", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("MESSAGE_READ", "2026-08-17T12:05:00Z"), config).record;
    expect(r.flow).toBe("sem_resposta");
    r = applyEvent(r, event("MESSAGE_READ", "2026-08-18T12:05:00Z"), config).record;
    expect(r.flow).toBe("visualizacao");
    expect(r.state).toBe("VISUALIZED_NO_RESPONSE");
  });

  it("agendamento bloqueia qualquer etapa automática", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("SCHEDULE_CREATED", "2026-08-17T15:00:00Z"), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-19T12:00:00Z",
      config,
      hasTemplateForPurpose: always,
    });
    expect(action).toMatchObject({ kind: "none" });
    expect(action.reason).toContain("agendamento");
  });

  it("janela fechada sem template oficial bloqueia o envio", () => {
    const r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-18T13:00:00Z",
      config,
      hasTemplateForPurpose: () => false,
    });
    expect(action.kind).toBe("none");
    expect(action.reason).toContain("template oficial");
  });

  it("etapa já executada nunca se repete e a ordem é respeitada", () => {
    let r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    r = applyEvent(r, event("MESSAGE_SENT", "2026-08-18T13:00:00Z", { step: "E1" }), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-20T13:00:00Z",
      config,
      hasTemplateForPurpose: always,
    });
    expect(action.kind === "send_step" && action.step).toBe("E3");
  });

  it("motor desabilitado não cria disparo", () => {
    const r = applyEvent(record(), event("FIRST_CONTACT_SENT", "2026-08-17T12:00:00Z"), config).record;
    const action = decideNextAction(r, {
      nowIso: "2026-08-19T13:00:00Z",
      config: { ...config, enabled: false },
      hasTemplateForPurpose: always,
    });
    expect(action.reason).toContain("desabilitado");
  });

  it("evento histórico não reativa cadência", () => {
    const r = applyEvent(record(), { ...event("MESSAGE_SENT", "2026-01-10T12:00:00Z", { step: "E1" }), historical: true }, config);
    expect(r.record.state).toBe("CADENCE_NOT_STARTED");
  });
});
/**
 * CENÁRIOS 01–10 do COMANDO 2B — validação técnica controlada do motor
 * completo (decisão + fila + trava de destinatário + idempotência),
 * usando repositório e despachante em memória. Nenhum dado real, nenhum
 * envio real: a homologação e a produção não são tocadas.
 */
import { createEngine } from "./engine";
import type { EngineDispatcher, EngineRepository } from "./ports";
import type { QueueItem, EngineDecision, EngineScope } from "./types";
import { canOverrideState } from "./machine";

function memoryRepository(scope: EngineScope, runId: string | null = null) {
  const records = new Map<string, CadenceRecord>();
  const events = new Set<string>();
  const queue = new Map<string, QueueItem>();
  const decisions: EngineDecision[] = [];
  let seq = 0;

  const repo: EngineRepository = {
    scope,
    runId,
    async loadRecord(leadId) {
      return records.get(leadId) ?? null;
    },
    async saveRecord(record) {
      if (record.scope !== scope) throw new Error("escopo cruzado");
      records.set(record.leadId, record);
    },
    async registerEvent(event) {
      if (event.scope !== scope) throw new Error("escopo cruzado");
      if (events.has(event.id)) return false;
      events.add(event.id);
      return true;
    },
    async loadQueue(leadId) {
      return [...queue.values()].filter((q) => q.leadId === leadId);
    },
    async upsertQueueItem(item) {
      const existing =
        item.id ??
        [...queue.values()].find((q) => q.leadId === item.leadId && q.step === item.step)?.id;
      const id = existing ?? `q${(seq += 1)}`;
      const next: QueueItem = { ...(item as QueueItem), id };
      queue.set(id, next);
      return next;
    },
    async claimQueueItem(id) {
      const item = queue.get(id);
      if (!item || item.status !== "PENDING") return false;
      queue.set(id, { ...item, status: "PROCESSING" });
      return true;
    },
    async updateQueueItem(id, patch) {
      const item = queue.get(id);
      if (item) queue.set(id, { ...item, ...patch });
    },
    async cancelPendingItems(leadId, reason) {
      let count = 0;
      for (const [id, item] of queue) {
        if (item.leadId === leadId && (item.status === "PENDING" || item.status === "PROCESSING")) {
          queue.set(id, { ...item, status: "CANCELLED", reason });
          count += 1;
        }
      }
      return count;
    },
    async recordDecision(decision) {
      decisions.push(decision);
    },
    async loadTemplates() {
      return {
        bindings: Object.values(STEPS).map((s) => ({
          purpose: s.templatePurpose,
          templateId: `binding-${s.templatePurpose}`,
          metaId: null,
          version: 1,
          approved: true,
          updatedAt: null,
        })),
      };
    },
    async loadContentLibrary() {
      // Biblioteca mínima de homologação: um conteúdo ativo por grupo.
      return ["E1", "E3", "R1", "R2"].map((group) => ({
        id: `${group}-1`,
        group,
        name: `Conteúdo ${group}`,
        kind: "pdf" as const,
        url: "https://exemplo.test/conteudo",
        active: true,
        usageCount: 0,
        createdAt: "2026-08-01T12:00:00.000Z",
        updatedAt: "2026-08-01T12:00:00.000Z",
      }));
    },
  };
  return { repo, queue, decisions, records };
}

function memoryDispatcher(scope: EngineScope, allow = true) {
  const sent: string[] = [];
  const dispatcher: EngineDispatcher = {
    scope,
    async assertRecipientAllowed(leadId) {
      const fake = leadId.toUpperCase().startsWith("TEST-");
      if (scope === "homologation" && !fake) {
        return { ok: false, reason: "Lead real não pode entrar na homologação." };
      }
      if (scope === "production" && fake) {
        return { ok: false, reason: "Lead fictício não pode atingir produção." };
      }
      if (!allow) return { ok: false, reason: "Destinatário bloqueado." };
      return { ok: true };
    },
    async send(request) {
      sent.push(`${request.leadId}:${request.step}`);
      return { delivered: true, externalId: `ext-${sent.length}` };
    },
  };
  return { dispatcher, sent };
}

const homologationClock = (iso: string) => ({
  kind: "virtual" as const,
  now: () => new Date(iso),
  nowIso: () => iso,
});

describe("COMANDO 2B — cenários de validação", () => {
  it("01 — lead criado em homologação nasce com estado inicial correto", async () => {
    const { repo, records } = memoryRepository("homologation");
    const { dispatcher } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-17T12:00:00Z"),
    });
    await engine.handleEvent({
      id: "e1",
      scope: "homologation",
      leadId: "TEST-0001",
      type: "LEAD_CREATED",
      at: "2026-08-17T12:00:00Z",
    });
    expect(records.get("TEST-0001")?.state).toBe("CADENCE_NOT_STARTED");
    expect(records.get("TEST-0001")?.executedSteps).toEqual([]);
  });

  it("02 — lead elegível gera uma única decisão de envio", async () => {
    const { repo, decisions } = memoryRepository("homologation");
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-18T12:00:00Z"),
    });
    await engine.handleEvent({
      id: "e0-sent",
      scope: "homologation",
      leadId: "TEST-0002",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-17T12:00:00Z",
      step: "E0",
    });
    expect(sent).toEqual(["TEST-0002:E1"]);
    expect(decisions.filter((d) => d.outcome === "sent")).toHaveLength(1);
  });

  it("03 — o mesmo evento processado duas vezes executa uma única vez", async () => {
    const { repo } = memoryRepository("homologation");
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-18T12:00:00Z"),
    });
    const evt = {
      id: "repetido",
      scope: "homologation" as const,
      leadId: "TEST-0003",
      type: "FIRST_CONTACT_SENT" as const,
      at: "2026-08-17T12:00:00Z",
      step: "E0" as const,
    };
    await engine.handleEvent(evt);
    await engine.handleEvent(evt);
    expect(sent).toEqual(["TEST-0003:E1"]);
  });

  it("04 — resposta antes da próxima etapa interrompe a cadência", async () => {
    const { repo, queue } = memoryRepository("homologation");
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-17T13:00:00Z"),
    });
    await engine.handleEvent({
      id: "s1",
      scope: "homologation",
      leadId: "TEST-0004",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-17T12:00:00Z",
      step: "E0",
    });
    const before = sent.length;
    await engine.handleEvent({
      id: "in1",
      scope: "homologation",
      leadId: "TEST-0004",
      type: "MESSAGE_RECEIVED",
      at: "2026-08-17T13:00:00Z",
    });
    expect(sent.length).toBe(before);
    expect([...queue.values()].every((q) => q.status !== "PENDING")).toBe(true);
  });

  it("05 — agendamento interrompe a cadência e vence eventos menores", async () => {
    const { repo, records } = memoryRepository("homologation");
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-18T12:00:00Z"),
    });
    await engine.handleEvent({
      id: "s2",
      scope: "homologation",
      leadId: "TEST-0005",
      type: "SCHEDULE_CREATED",
      at: "2026-08-17T12:00:00Z",
    });
    const before = sent.length;
    await engine.handleEvent({
      id: "in2",
      scope: "homologation",
      leadId: "TEST-0005",
      type: "MESSAGE_RECEIVED",
      at: "2026-08-17T13:00:00Z",
    });
    expect(sent.length).toBe(before);
    expect(records.get("TEST-0005")?.state).toBe("SCHEDULED");
    expect(canOverrideState("SCHEDULED", "MESSAGE_READ")).toBe(false);
  });

  it("06 — janela fechada sem template oficial bloqueia e registra o motivo", async () => {
    const { repo, decisions } = memoryRepository("homologation");
    repo.loadTemplates = async () => ({ bindings: [] });
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-18T12:00:00Z"),
    });
    await engine.handleEvent({
      id: "s3",
      scope: "homologation",
      leadId: "TEST-0006",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-17T12:00:00Z",
      step: "E0",
    });
    expect(sent).toEqual([]);
    expect(decisions.at(-1)?.reason).toContain("template oficial");
  });

  it("07 — lead fictício não atinge produção", async () => {
    const { repo, decisions } = memoryRepository("production");
    const { dispatcher, sent } = memoryDispatcher("production");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-18T12:00:00Z"),
    });
    await engine.handleEvent({
      id: "s4",
      scope: "production",
      leadId: "TEST-9999",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-17T12:00:00Z",
      step: "E0",
    });
    expect(sent).toEqual([]);
    expect(decisions.at(-1)?.outcome).toBe("blocked");
  });

  it("08 — lead real não entra na homologação", async () => {
    const { repo, decisions } = memoryRepository("homologation");
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-18T12:00:00Z"),
    });
    await engine.handleEvent({
      id: "s5",
      scope: "homologation",
      leadId: "lead-real-123",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-17T12:00:00Z",
      step: "E0",
    });
    expect(sent).toEqual([]);
    expect(decisions.at(-1)?.outcome).toBe("blocked");
  });

  it("09 — etapa que venceria no fim de semana espera o próximo dia útil", async () => {
    const { repo, queue } = memoryRepository("homologation");
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const engine = createEngine({
      repository: repo,
      dispatcher,
      config,
      clock: homologationClock("2026-08-15T12:00:00Z"), // sábado
    });
    await engine.handleEvent({
      id: "s6",
      scope: "homologation",
      leadId: "TEST-0009",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-14T18:00:00Z", // sexta
      step: "E0",
    });
    expect(sent).toEqual([]);
    const pending = [...queue.values()].find((q) => q.step === "E1");
    expect(pending?.status).toBe("PENDING");
    expect(pending?.dueAt.slice(0, 10)).toBe("2026-08-17"); // segunda
  });

  it("10 — dois processos disputando a mesma tarefa executam uma única vez", async () => {
    const { repo } = memoryRepository("homologation");
    const { dispatcher, sent } = memoryDispatcher("homologation");
    const clock = homologationClock("2026-08-18T12:00:00Z");
    const engineA = createEngine({ repository: repo, dispatcher, config, clock });
    const engineB = createEngine({ repository: repo, dispatcher, config, clock });
    await engineA.handleEvent({
      id: "s7",
      scope: "homologation",
      leadId: "TEST-0010",
      type: "FIRST_CONTACT_SENT",
      at: "2026-08-17T12:00:00Z",
      step: "E0",
    });
    await Promise.all([engineA.tick("TEST-0010"), engineB.tick("TEST-0010")]);
    expect(sent.filter((s) => s === "TEST-0010:E1")).toHaveLength(1);
  });
});
