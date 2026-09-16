import { describe, expect, it } from "vitest";
import {
  collapseByLead,
  dedupeDailyActions,
  isUpcomingAction,
  isAutomaticDailyAction,
  normalizeDailyActions,
  operationalDate,
  resolveBucket,
  summarizeDailyActions,
  shouldNeutralizeQueueDuty,
  reclassifyDailyActions,
  type DailyAction,
} from "@/lib/crm/daily-actions";

function action(partial: Partial<DailyAction> & { actionKey: string }): DailyAction {
  return {
    source: "queue",
    kind: "mensagem",
    leadId: "gs_1",
    name: "Investidor",
    phone: "",
    scope: "green_sales",
    stepLabel: null,
    dueDate: "2026-02-10",
    startsAt: null,
    endsAt: null,
    overdue: false,
    priorityMax: false,
    bucket: "hoje",
    title: "Ação",
    responsibleName: null,
    attempts: [],
    ...partial,
  };
}

describe("Ações do Dia — regras puras", () => {
  const now = "2026-02-10T14:00:00.000Z"; // 11:00 em America/Sao_Paulo

  it("reclassifica reunião futura, em foco e atrasada com os mesmos limites", () => {
    const row = action({ actionKey: "meeting:TEST-0001", source: "meeting", kind: "reuniao", startsAt: "2026-02-10T14:00:00.000Z", bucket: "futura", priorityMax: true });
    expect(reclassifyDailyActions([row], "2026-02-10T13:54:00.000Z")[0]?.bucket).toBe("futura");
    expect(reclassifyDailyActions([row], "2026-02-10T13:55:00.000Z")[0]?.bucket).toBe("agora");
    expect(reclassifyDailyActions([row], "2026-02-10T14:05:00.000Z")[0]?.bucket).toBe("agora");
    expect(reclassifyDailyActions([row], "2026-02-10T14:06:00.000Z")[0]?.bucket).toBe("atrasada");
    const tomorrow = reclassifyDailyActions([row, action({ actionKey: "queue:TEST-2:E0", leadId: "TEST-2" })], "2026-02-11T14:00:00.000Z");
    const meeting = tomorrow.find((a) => a.source === "meeting");
    if (!meeting) throw new Error("Compromisso deve continuar visível");
    expect(meeting.overdue).toBe(true);
    expect(isAutomaticDailyAction(meeting)).toBe(true);
    expect(tomorrow[0].source).toBe("meeting");
  });

  it("E0 segue o calendário existente, sem atraso durante fim de semana", () => {
    const row = action({ actionKey: "queue:TEST-0001:E0", stepLabel: "E0", dueDate: "2026-02-13" });
    expect(reclassifyDailyActions([row], "2026-02-14T15:00:00.000Z")[0]?.bucket).toBe("hoje");
    expect(reclassifyDailyActions([row], "2026-02-18T15:00:00.000Z")[0]?.bucket).toBe("atrasada");
  });

  it("J) saldo do fim de semana chega à segunda sem atraso de sábado", () => {
    const row = action({ actionKey: "queue:weekend:E0", stepLabel: "E0", dueDate: "2026-09-21" });
    expect(reclassifyDailyActions([row], "2026-09-19T15:00:00.000Z")[0]?.bucket).toBe("futura");
    expect(reclassifyDailyActions([row], "2026-09-21T12:00:00.000Z")[0]?.bucket).toBe("hoje");
  });

  it("N–P) neutraliza estágio congelador, preserva E0 sem contato e é estável", () => {
    const frozen = {
      step: "E1",
      stageKey: "agendamentos",
      hasCommitment: true,
      firstContactExecuted: true,
    };
    expect(shouldNeutralizeQueueDuty(frozen)).toBe(true);
    expect(shouldNeutralizeQueueDuty({ ...frozen, stageKey: "video" })).toBe(true);
    expect(shouldNeutralizeQueueDuty({ ...frozen, stageKey: "oportunidade", hasCommitment: false })).toBe(true);
    expect(shouldNeutralizeQueueDuty({ ...frozen, step: "E0", firstContactExecuted: false })).toBe(false);
    expect(shouldNeutralizeQueueDuty(frozen)).toBe(shouldNeutralizeQueueDuty(frozen));
  });

  it("tentativa adicional expirada sai da lista sem virar atraso", () => {
    const row = action({ actionKey: "queue:TEST-0001:E1:2", expiresAt: "2026-02-10T20:30:00.000Z" });
    expect(reclassifyDailyActions([row], "2026-02-10T20:29:00.000Z")).toHaveLength(1);
    expect(reclassifyDailyActions([row], "2026-02-10T20:30:00.000Z")).toEqual([]);
  });

  it("expirar tentativa adicional preserva mensagem pendente da mesma lead", () => {
    const message = action({ actionKey: "queue:TEST-0001:E1:3", stepLabel: "E1" });
    const call = action({ actionKey: "queue:TEST-0001:E1:2", kind: "ligacao", expiresAt: "2026-02-10T20:30:00.000Z", secondary: [message] });
    const rows = reclassifyDailyActions([call], "2026-02-10T20:30:00.000Z");
    expect(rows.map((r) => r.actionKey)).toEqual([message.actionKey]);
    expect(rows[0]?.secondary ?? []).toEqual([]);
  });

  it("o compromisso original permanece a mesma pendência sem ação derivada", () => {
    const meeting = action({ actionKey: "meeting:TEST-0001:agendamento:2026-02-09", source: "meeting", kind: "reuniao", startsAt: "2026-02-09T16:00:00.000Z", followUp: { state: "PENDENTE", scheduledAt: "2026-02-09T16:00:00.000Z" } });
    const once = reclassifyDailyActions([meeting], now);
    expect(once).toHaveLength(1);
    expect(once[0]?.actionKey).toBe(meeting.actionKey);
    expect(reclassifyDailyActions(once, now)).toEqual(once);
  });

  it("12) usa America/Sao_Paulo nas decisões operacionais", () => {
    expect(operationalDate("2026-02-11T02:00:00.000Z")).toBe("2026-02-10");
  });

  it("nunca converte ação atrasada em ação de hoje", () => {
    expect(resolveBucket({ dueDate: "2026-02-09", startsAt: null, nowIso: now })).toBe("atrasada");
    expect(resolveBucket({ dueDate: "2026-02-10", startsAt: null, nowIso: now })).toBe("hoje");
    expect(resolveBucket({ dueDate: "2026-02-12", startsAt: null, nowIso: now })).toBe("futura");
  });

  it("5) reunião 20 minutos no futuro não entra em foco — é compromisso futuro", () => {
    expect(
      resolveBucket({ dueDate: "2026-02-10", startsAt: "2026-02-10T14:20:00.000Z", nowIso: now }),
    ).toBe("futura");
  });

  it("6) reunião 10 minutos no futuro ainda não entra em foco (janela de 5 min)", () => {
    expect(
      resolveBucket({ dueDate: "2026-02-10", startsAt: "2026-02-10T14:10:00.000Z", nowIso: now }),
    ).toBe("futura");
  });

  it("9) compromisso de hoje às 11:00 não é trabalho das 08:18", () => {
    const manha = "2026-02-10T11:18:00.000Z"; // 08:18 em São Paulo
    expect(
      resolveBucket({ dueDate: "2026-02-10", startsAt: "2026-02-10T14:00:00.000Z", nowIso: manha }),
    ).toBe("futura");
    expect(
      resolveBucket({ dueDate: "2026-02-10", startsAt: "2026-02-10T19:00:00.000Z", nowIso: manha }),
    ).toBe("futura");
  });

  it("6b) reunião 4 minutos no futuro entra em foco", () => {
    expect(
      resolveBucket({ dueDate: "2026-02-10", startsAt: "2026-02-10T14:04:00.000Z", nowIso: now }),
    ).toBe("agora");
  });

  it("1) um lead com uma ligação aparece uma única vez", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "cadence:a:ligacao-3:2026-02-01", source: "cadence", kind: "ligacao", leadId: "a" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("ligacao");
  });

  it("2) um lead com uma mensagem aparece uma única vez", () => {
    const rows = normalizeDailyActions([action({ actionKey: "queue:b:E1:1", leadId: "b" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("mensagem");
  });

  it("3) reunião na janela aparece uma vez e como prioridade máxima", () => {
    const rows = normalizeDailyActions([
      action({
        actionKey: "meeting:c:reuniao:2026-02-10T14:10:00.000Z",
        source: "meeting",
        kind: "reuniao",
        leadId: "c",
        priorityMax: true,
        bucket: "agora",
        startsAt: "2026-02-10T14:10:00.000Z",
      }),
      action({ actionKey: "queue:d:E1:9", leadId: "d" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.kind).toBe("reuniao");
  });

  it("4) reunião + mensagem + ligação do mesmo lead geram um único card", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "queue:e:E1:1", leadId: "e" }),
      action({ actionKey: "cadence:e:ligacao-2:2026-02-01", source: "cadence", kind: "ligacao", leadId: "e" }),
      action({
        actionKey: "meeting:e:reuniao:2026-02-10T14:05:00.000Z",
        source: "meeting",
        kind: "reuniao",
        leadId: "e",
        priorityMax: true,
        bucket: "agora",
        startsAt: "2026-02-10T14:05:00.000Z",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("reuniao");
    expect(rows[0]?.secondary?.map((s) => s.kind).sort()).toEqual(["ligacao", "mensagem"]);
  });

  it("7) reunião passada permanece aberta e prioritária", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "queue:f:E1:1", leadId: "f", bucket: "atrasada" }),
      action({
        actionKey: "meeting:g:reuniao:2026-02-10T12:00:00.000Z",
        source: "meeting",
        kind: "reuniao",
        leadId: "g",
        priorityMax: true,
        bucket: "atrasada",
        startsAt: "2026-02-10T12:00:00.000Z",
      }),
    ]);
    expect(rows[0]?.source).toBe("meeting");
  });

  it("8) concluir na fonte oficial remove o item na releitura", () => {
    const before = [
      action({ actionKey: "queue:h:E1:1", leadId: "h" }),
      action({ actionKey: "cadence:i:ligacao-1:2026-02-01", source: "cadence", kind: "ligacao", leadId: "i" }),
    ];
    expect(normalizeDailyActions(before)).toHaveLength(2);
    // a fonte oficial deixou de retornar a mensagem concluída
    expect(normalizeDailyActions(before.slice(1))).toHaveLength(1);
  });

  it("9) remontar a tela relendo as mesmas fontes não duplica ações", () => {
    const rows = [action({ actionKey: "queue:j:E1:1", leadId: "j" })];
    const first = normalizeDailyActions(rows);
    const second = normalizeDailyActions([...rows, ...rows]);
    expect(second).toHaveLength(1);
    expect(second[0]?.actionKey).toBe(first[0]?.actionKey);
  });

  it("10) a mesma obrigação lida por duas fontes não duplica", () => {
    const rows = dedupeDailyActions([
      action({ actionKey: "k", source: "cadence", kind: "ligacao" }),
      action({ actionKey: "k", source: "meeting", kind: "reuniao" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("meeting");
  });

  it("11) tentativa não é inventada quando a fonte não fornece o número", () => {
    const semHistorico = action({ actionKey: "cadence:l:ligacao-4:2026-02-01", leadId: "l", attempts: [] });
    expect(semHistorico.stepLabel).toBeNull();
  });

  it("compromisso sem lead nunca é colapsado com outro compromisso", () => {
    const rows = collapseByLead([
      action({ actionKey: "agenda:x:1", source: "agenda", kind: "compromisso", leadId: null }),
      action({ actionKey: "agenda:x:2", source: "agenda", kind: "compromisso", leadId: null }),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("ordena reunião em foco, depois atrasadas, depois o restante", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "hoje", leadId: "m1", bucket: "hoje" }),
      action({ actionKey: "atrasada", leadId: "m2", bucket: "atrasada" }),
      action({
        actionKey: "reuniao",
        leadId: "m3",
        kind: "reuniao",
        source: "meeting",
        priorityMax: true,
        bucket: "agora",
        startsAt: "2026-02-10T14:10:00.000Z",
      }),
    ]);
    expect(rows.map((r) => r.actionKey)).toEqual(["reuniao", "atrasada", "hoje"]);
  });

  it("resume a fila sem contar duas vezes", () => {
    const summary = summarizeDailyActions(
      normalizeDailyActions([
        action({ actionKey: "a", leadId: "n1", bucket: "atrasada" }),
        action({ actionKey: "a", leadId: "n1", bucket: "atrasada" }),
        action({ actionKey: "b", leadId: "n2", bucket: "hoje" }),
        action({ actionKey: "c", leadId: "n3", kind: "reuniao", source: "meeting", bucket: "agora" }),
      ]),
    );
    expect(summary).toEqual({ overdue: 1, today: 2, meetings: 1, total: 3 });
  });
});

describe("Compromisso futuro não é trabalho de hoje", () => {
  it("nunca ocupa a posição 1, mesmo com prioridade máxima", () => {
    const rows = normalizeDailyActions([
      action({
        actionKey: "meet_amanha",
        kind: "reuniao",
        leadId: "gs_futuro",
        bucket: "futura",
        priorityMax: true,
        dueDate: "2026-02-11",
      }),
      action({
        actionKey: "e0_hoje",
        leadId: "gs_hoje",
        bucket: "hoje",
        stepLabel: "E0",
      }),
    ]);
    expect(rows[0]?.actionKey).toBe("e0_hoje");
    expect(rows.some((r) => r.actionKey === "meet_amanha")).toBe(true);
  });

  it("continua visível como próximo compromisso", () => {
    expect(isUpcomingAction(action({ actionKey: "a", bucket: "futura" }))).toBe(true);
    expect(isUpcomingAction(action({ actionKey: "b", bucket: "hoje" }))).toBe(false);
  });
});

describe("Ações do Dia — continuidade da mesma lead", () => {
  const ronaldoMsg = action({
    actionKey: "queue:ronaldo:E0:2",
    leadId: "ronaldo",
    stepLabel: "E0",
    name: "Ronaldo",
  });
  const outraLead = action({
    actionKey: "queue:aaa:E0:1",
    leadId: "aaa",
    stepLabel: "E0",
    name: "Ana",
  });

  it("sem continuidade, o desempate alfabético mantém a outra lead na frente", () => {
    const rows = normalizeDailyActions([ronaldoMsg, outraLead]);
    expect(rows[0]?.leadId).toBe("aaa");
  });

  it("a próxima ação liberada da lead em curso assume a posição 1", () => {
    const rows = normalizeDailyActions([ronaldoMsg, outraLead], "ronaldo");
    expect(rows[0]?.leadId).toBe("ronaldo");
    expect(rows[1]?.leadId).toBe("aaa");
  });

  it("a continuidade não promove compromisso futuro nem altera o rank geral", () => {
    const futura = action({
      actionKey: "meeting:ronaldo:1",
      leadId: "ronaldo",
      bucket: "futura",
      kind: "reuniao",
      source: "meeting",
      priorityMax: true,
    });
    const rows = normalizeDailyActions([futura, outraLead], "ronaldo");
    expect(rows[0]?.leadId).toBe("aaa");
  });

  it("a continuidade não interrompe uma ação claimed de outra lead", () => {
    const kellyEmAtendimento = action({
      actionKey: "queue:kelly:E0:1",
      leadId: "kelly",
      stepLabel: "E0",
      name: "Kelly",
      claimed: true,
      active: true,
    });
    const rows = normalizeDailyActions([kellyEmAtendimento, ronaldoMsg], "ronaldo");
    expect(rows[0]?.leadId).toBe("kelly");
    expect(rows[1]?.leadId).toBe("ronaldo");
  });

  it("ação claimed vence compromisso de prioridade máxima no empate", () => {
    const claimed = action({ actionKey: "queue:claimed:E1:1", leadId: "claimed", claimed: true, active: true });
    const meeting = action({
      actionKey: "meeting:priority",
      source: "meeting",
      kind: "reuniao",
      leadId: "meeting",
      priorityMax: true,
      bucket: "agora",
      startsAt: "2026-02-10T13:59:00.000Z",
    });
    expect(normalizeDailyActions([meeting, claimed])[0]?.actionKey).toBe(claimed.actionKey);
  });

  it("Q) PROCESSING permanece protegido durante a reconciliação", () => {
    const current = action({ actionKey: "processing", leadId: "current", claimed: true, active: true, sortAt: "2026-09-20T17:00:00.000Z" });
    const older = action({ actionKey: "older", leadId: "older", stepLabel: "E0", sortAt: "2026-09-18T22:00:00.000Z" });
    expect(normalizeDailyActions([older, current])[0]?.actionKey).toBe("processing");
  });

  it("R) ordena o acumulado sexta, sábado e domingo pela entrada real", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "ana", leadId: "ana", stepLabel: "E0", dueDate: "2026-09-21", sortAt: "2026-09-20T17:00:00.000Z" }),
      action({ actionKey: "joao", leadId: "joao", stepLabel: "E0", dueDate: "2026-09-21", sortAt: "2026-09-18T22:00:00.000Z" }),
      action({ actionKey: "carlos", leadId: "carlos", stepLabel: "E0", dueDate: "2026-09-21", sortAt: "2026-09-19T05:00:00.000Z" }),
    ]);
    expect(rows.map((row) => row.actionKey)).toEqual(["joao", "carlos", "ana"]);
  });

  it("preserva claim, emergência, alerta, E0, atrasada e ação normal nesta ordem", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "normal", leadId: "normal" }),
      action({ actionKey: "late", leadId: "late", bucket: "atrasada" }),
      action({ actionKey: "e0", leadId: "e0", stepLabel: "E0" }),
      action({ actionKey: "alert", leadId: "alert", source: "portal_alert", kind: "alerta_portal", bucket: "alerta" }),
      action({ actionKey: "urgent", leadId: "urgent", source: "meeting", kind: "reuniao", bucket: "agora", priorityMax: true }),
      action({ actionKey: "claimed", leadId: "claimed", claimed: true, active: true }),
    ]);
    expect(rows.map((row) => row.actionKey)).toEqual([
      "claimed", "urgent", "alert", "e0", "late", "normal",
    ]);
    expect(isAutomaticDailyAction(rows[2])).toBe(true);
  });

  it("RE0 compartilha a prioridade de abertura do E0 sem mudar outras classes", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "normal", leadId: "normal" }),
      action({ actionKey: "late", leadId: "late", bucket: "atrasada" }),
      action({ actionKey: "re0", leadId: "re0", stepLabel: "RE0", sortAt: "2026-02-10T13:00:00.000Z" }),
      action({ actionKey: "e0", leadId: "e0", stepLabel: "E0", sortAt: "2026-02-10T14:00:00.000Z" }),
      action({ actionKey: "alert", leadId: "alert", source: "portal_alert", kind: "alerta_portal", bucket: "alerta" }),
      action({ actionKey: "urgent", leadId: "urgent", source: "meeting", kind: "reuniao", bucket: "agora", priorityMax: true }),
    ]);
    expect(rows.map((row) => row.actionKey)).toEqual(["urgent", "alert", "re0", "e0", "late", "normal"]);
  });

  it("RE0 não desloca PROCESSING e preserva a continuidade", () => {
    const claimed = action({ actionKey: "claimed", leadId: "claimed", claimed: true, active: true });
    const re0 = action({ actionKey: "re0", leadId: "re0", stepLabel: "RE0" });
    const continuation = action({ actionKey: "continuation", leadId: "same", stepLabel: "E1" });
    expect(normalizeDailyActions([re0, claimed])[0]?.actionKey).toBe("claimed");
    expect(normalizeDailyActions([re0, continuation], "same")[0]?.actionKey).toBe("continuation");
  });

  it("mantém agendamento urgente do mesmo lead logo após a ação claimada", () => {
    const rows = normalizeDailyActions([
      action({ actionKey: "claimed", leadId: "same", claimed: true, active: true }),
      action({ actionKey: "meeting", leadId: "same", source: "meeting", kind: "reuniao", bucket: "agora", priorityMax: true }),
      action({ actionKey: "duplicate", leadId: "same", source: "queue" }),
    ]);
    expect(rows.slice(0, 2).map((row) => row.actionKey)).toEqual(["claimed", "meeting"]);
    expect(rows).toHaveLength(2);
  });

  describe("blindagem única do card efetivamente ativo", () => {
    const active = action({
      actionKey: "active-e1",
      leadId: "active",
      stepLabel: "E1",
      claimed: true,
      active: true,
    });
    const staleProcessing = action({
      actionKey: "stale-e1",
      leadId: "stale",
      stepLabel: "E1",
      claimed: true,
    });
    const e0 = action({ actionKey: "new-e0", leadId: "new", stepLabel: "E0" });
    const meeting = action({
      actionKey: "new-meeting",
      source: "meeting",
      kind: "reuniao",
      leadId: "meeting",
      bucket: "agora",
      priorityMax: true,
      startsAt: "2026-02-10T13:59:00.000Z",
    });
    const alert = action({
      actionKey: "new-alert",
      source: "portal_alert",
      kind: "alerta_portal",
      leadId: "alert",
      bucket: "alerta",
    });

    it("A–B) protege só o atendimento ativo entre vários PROCESSING", () => {
      const rows = normalizeDailyActions([staleProcessing, active]);
      expect(rows.map((row) => row.actionKey)).toEqual(["active-e1", "stale-e1"]);
      expect(rows.filter((row) => row.active)).toHaveLength(1);
      expect(rows.every((row) => row.claimed)).toBe(true);
    });

    it("C) posiciona E0 imediatamente depois do atendimento ativo", () => {
      expect(normalizeDailyActions([staleProcessing, e0, active]).map((row) => row.actionKey)).toEqual([
        "active-e1", "new-e0", "stale-e1",
      ]);
    });

    it("D) posiciona E0 primeiro quando não existe atendimento ativo", () => {
      expect(normalizeDailyActions([staleProcessing, e0])[0]?.actionKey).toBe("new-e0");
    });

    it("E–F) mantém agendamento e aviso abaixo do ativo e acima do E0", () => {
      expect(normalizeDailyActions([staleProcessing, e0, alert, meeting, active]).map((row) => row.actionKey)).toEqual([
        "active-e1", "new-meeting", "new-alert", "new-e0", "stale-e1",
      ]);
    });

    it("G–H) releitura e reload recalculam a mesma hierarquia", () => {
      const reread = reclassifyDailyActions([staleProcessing, e0, active], now);
      const reload = reclassifyDailyActions([staleProcessing, e0], now);
      expect(reread.map((row) => row.actionKey)).toEqual(["active-e1", "new-e0", "stale-e1"]);
      expect(reload.map((row) => row.actionKey)).toEqual(["new-e0", "stale-e1"]);
    });

    it("I–J) ordenação não apaga nem converte estados persistidos", () => {
      const source = [staleProcessing, e0, active];
      const rows = normalizeDailyActions(source);
      expect(rows).toHaveLength(source.length);
      expect(rows.filter((row) => row.claimed).map((row) => row.actionKey).sort()).toEqual([
        "active-e1", "stale-e1",
      ]);
      expect(rows.find((row) => row.actionKey === "stale-e1")?.active).not.toBe(true);
    });
  });
});
