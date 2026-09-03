import { describe, expect, it } from "vitest";
import {
  collapseByLead,
  dedupeDailyActions,
  normalizeDailyActions,
  operationalDate,
  resolveBucket,
  summarizeDailyActions,
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

  it("12) usa America/Sao_Paulo nas decisões operacionais", () => {
    expect(operationalDate("2026-02-11T02:00:00.000Z")).toBe("2026-02-10");
  });

  it("nunca converte ação atrasada em ação de hoje", () => {
    expect(resolveBucket({ dueDate: "2026-02-09", startsAt: null, nowIso: now })).toBe("atrasada");
    expect(resolveBucket({ dueDate: "2026-02-10", startsAt: null, nowIso: now })).toBe("hoje");
    expect(resolveBucket({ dueDate: "2026-02-12", startsAt: null, nowIso: now })).toBe("futura");
  });

  it("5) reunião 20 minutos no futuro não entra em foco", () => {
    expect(
      resolveBucket({ dueDate: "2026-02-10", startsAt: "2026-02-10T14:20:00.000Z", nowIso: now }),
    ).toBe("hoje");
  });

  it("6) reunião 10 minutos no futuro ainda não entra em foco (janela de 5 min)", () => {
    expect(
      resolveBucket({ dueDate: "2026-02-10", startsAt: "2026-02-10T14:10:00.000Z", nowIso: now }),
    ).toBe("hoje");
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

  it("7) reunião atrasada permanece no topo", () => {
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
    expect(rows[0]?.kind).toBe("reuniao");
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
