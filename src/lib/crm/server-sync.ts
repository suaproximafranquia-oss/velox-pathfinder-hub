/**
 * Ponte entre o cache do navegador e a fonte de verdade do CRM.
 *
 * Regra definitiva do projeto: o banco é a verdade, o navegador é
 * interface. Este módulo (1) envia toda mensagem/ocorrência criada
 * localmente para o servidor e (2) traz de volta o histórico completo,
 * mesclando com o conteúdo já existente no navegador — nada é apagado e
 * nada é duplicado (o identificador do registro é a chave).
 */
import { pushCrmRecords, pullCrmRecords, pushPortalCrmRecords } from "@/lib/crm/crm-sync.functions";
import { mergeRemoteMessages, type CrmMessage } from "@/lib/crm/messages";
import { mergeRemoteTimeline, type CrmTimelineEntry } from "@/lib/crm/timeline";
import { runSyncMuted } from "@/lib/sync-bus";

type Batch = { messages: CrmMessage[]; timeline: CrmTimelineEntry[] };

async function send(batch: Batch): Promise<void> {
  try {
    await pushCrmRecords({ data: batch });
    return;
  } catch {
    /* sem sessão de executivo: tenta a via autorizada do visitante */
  }
  const investorId = batch.messages[0]?.investorId ?? batch.timeline[0]?.investorId;
  if (!investorId) return;
  const { ensurePortalToken } = await import("@/lib/portal-token");
  const token = await ensurePortalToken(investorId);
  if (!token) return;
  try {
    await pushPortalCrmRecords({ data: { ...batch, investorId, token } });
  } catch {
    /* reenviado na próxima sincronização */
  }
}

/** Enfileira o registro recém-criado — nunca bloqueia a interface. */
export function mirrorCrmRecords(input: {
  messages?: CrmMessage[];
  timeline?: CrmTimelineEntry[];
}): void {
  if (typeof window === "undefined") return;
  const batch: Batch = { messages: input.messages ?? [], timeline: input.timeline ?? [] };
  if (!batch.messages.length && !batch.timeline.length) return;
  const ids = new Set([
    ...batch.messages.map((message) => message.investorId),
    ...batch.timeline.map((entry) => entry.investorId),
  ]);
  for (const id of ids) {
    void send({
      messages: batch.messages.filter((message) => message.investorId === id),
      timeline: batch.timeline.filter((entry) => entry.investorId === id),
    });
  }
}

let hydrating: Promise<boolean> | null = null;

/**
 * Traz o histórico oficial do servidor e envia o que existir apenas
 * neste navegador (conteúdo criado antes desta camada). Após a primeira
 * execução, qualquer computador autorizado enxerga a mesma conversa.
 */
export function hydrateCrmFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const remote = await pullCrmRecords({ data: {} });
      const remoteMessages: CrmMessage[] = remote.messages.map((m) => ({
        id: m.id,
        investorId: m.investor_id,
        direction: m.direction as CrmMessage["direction"],
        body: m.body,
        at: m.at,
        authorId: m.author_id,
        ...(m.author_name ? { authorName: m.author_name } : {}),
      }));
      const remoteTimeline: CrmTimelineEntry[] = remote.timeline.map((t) => ({
        id: t.id,
        investorId: t.investor_id,
        event: t.event as CrmTimelineEntry["event"],
        origin: t.origin,
        reason: t.reason,
        ownerId: t.owner_id ?? "",
        actorId: t.actor_id ?? "",
        at: t.at,
      }));

      // Espelho do servidor: grava sem reavisar o barramento (estabilidade).
      runSyncMuted(() => {
        mergeRemoteMessages(remoteMessages);
        mergeRemoteTimeline(remoteTimeline);
      });
      return true;
    } catch {
      return false;
    } finally {
      hydrating = null;
    }
  })();
  return hydrating;
}
