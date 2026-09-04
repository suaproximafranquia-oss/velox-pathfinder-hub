/**
 * CRM DE HOMOLOGAÇÃO (COMANDO 3B §17 e §19).
 *
 * Exibe as conversas fictícias da rodada REUTILIZANDO a mesma interface
 * de conversa do CRM de Relacionamento (`CrmThread`): não existe uma
 * segunda interface de CRM. Aqui apenas o contexto é isolado e
 * identificado como homologação. Nenhuma destas mensagens existe fora
 * da rodada — nada é enviado para a Meta.
 */
import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { CrmThread } from "@/components/crm/crm-conversation";
import type { CrmMessage } from "@/lib/crm/messages";
import { crmCssVars, resolveCrmBranding } from "@/lib/crm/theme";
import { findCrmTheme, getUserCrmTheme } from "@/lib/crm/themes";
import { cn } from "@/lib/utils";

export type HomologationMessageView = {
  direction: "outbound" | "inbound" | "system";
  /** Autor explícito da mensagem (COMANDO 3D §7). */
  author?: "EXECUTIVE" | "INVESTOR" | "SYSTEM";
  authorName?: string;
  step: string | null;
  body: string;
  at: string;
  contentId: string | null;
  contentName: string | null;
  contentKind: string | null;
  contentUrl: string | null;
  contentGroup: string | null;
  /** Botão do template (URL nunca aparece no corpo da mensagem). */
  button?: { label: string; url: string } | null;
};

export type HomologationConversation = {
  leadId: string;
  displayName: string;
  scenario: string;
  scenarioLabel: string;
  entryAt: string;
  entryLabel: string;
  result: "PASS" | "FAIL";
  divergence: string | null;
  finalState: string;
  reads: number;
  responses: number;
  scheduled: boolean;
  expectedSteps: string[];
  executedSteps: string[];
  messages: HomologationMessageView[];
  journey: { at: string; event: string; detail: string }[];
  decisions: {
    at: string;
    step: string | null;
    outcome: string;
    reason: string;
    stateBefore: string;
    stateAfter: string;
  }[];
};

function hour(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Converte a mensagem da rodada para o formato do CRM real, para que a
 * renderização seja feita pelo MESMO componente de conversa.
 */
function toCrmMessages(conversation: HomologationConversation): CrmMessage[] {
  return conversation.messages.map((m, i) => {
    const author =
      m.author ??
      (m.direction === "inbound"
        ? "INVESTOR"
        : m.direction === "system"
          ? "SYSTEM"
          : "EXECUTIVE");
    const kind = (m.contentKind ?? null) as string | null;
    return {
      id: `${conversation.leadId}-${i}`,
      investorId: conversation.leadId,
      // O lado é definido pelo autor: investidor à esquerda (recebida),
      // Velox/Executivo à direita (enviada).
      direction: author === "INVESTOR" ? "recebida" : "enviada",
      body: m.body,
      at: m.at,
      authorId: author,
      authorName: m.authorName,
      step: m.step,
      button: m.button ?? null,
      attachment: m.contentName
        ? {
            name: m.contentName,
            kind,
            url: m.contentUrl,
            group: m.contentGroup,
          }
        : null,
    } satisfies CrmMessage;
  });
}

export function HomologationCrm({
  conversations,
  executive,
}: {
  conversations: HomologationConversation[];
  /** Executivo responsável — avatar das mensagens enviadas (COMANDO 1A §9). */
  executive?: { name: string; photoUrl?: string | null };
}) {
  /**
   * A posição visual é definida pelo AUTOR da mensagem (COMANDO 3D §6/§7):
   * OUTBOUND (Velox/Executivo) à direita, INBOUND (investidor) à esquerda.
   */
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(conversations[0]?.leadId ?? "");
  const themeVars = useMemo(() => {
    const theme = findCrmTheme(getUserCrmTheme(null));
    return crmCssVars(resolveCrmBranding({ colors: theme.colors })) as React.CSSProperties;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.leadId.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        c.scenario.toLowerCase() === q,
    );
  }, [conversations, query]);

  const current = conversations.find((c) => c.leadId === selected) ?? filtered[0] ?? null;
  const threadMessages = useMemo(
    () => (current ? toCrmMessages(current) : []),
    [current],
  );

  if (conversations.length === 0) {
    return (
      <p className="text-xs text-[color:var(--muted-foreground)]">
        A rodada selecionada não possui conversas registradas.
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
      <div className="rounded-xl border border-[color:var(--border)]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar TEST-0047 ou cenário"
          className="w-full rounded-t-xl border-b border-[color:var(--border)] bg-transparent px-3 py-2 text-xs outline-none"
        />
        <ul className="max-h-[520px] overflow-y-auto">
          {filtered.slice(0, 300).map((c) => (
            <li key={c.leadId}>
              <button
                onClick={() => setSelected(c.leadId)}
                className={cn(
                  "w-full border-b border-[color:var(--border)]/50 px-3 py-2 text-left text-xs transition",
                  c.leadId === current?.leadId
                    ? "bg-[color:var(--gold)]/10 text-[color:var(--foreground)]"
                    : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--card)]/60",
                )}
              >
                <span className="block truncate text-[color:var(--foreground)]">{c.leadId}</span>
                <span className="block truncate">
                  Cenário {c.scenario} · {c.messages.length} msgs
                </span>
                <span
                  className={cn(
                    "text-[10px]",
                    c.result === "PASS" ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {c.result === "PASS" ? "conforme" : "divergente"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {current ? (
        <div className="rounded-xl border border-[color:var(--border)]">
          <header className="border-b border-[color:var(--border)] px-4 py-3">
            <p className="text-sm text-[color:var(--foreground)]">
              {current.displayName}{" "}
              <span className="text-[color:var(--muted-foreground)]">— {current.leadId}</span>
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
              Cenário {current.scenario} · {current.scenarioLabel} · entrada {current.entryLabel} (
              {hour(current.entryAt)})
            </p>
            <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
              Esperado: {current.expectedSteps.join(" → ") || "—"} · Executado:{" "}
              {current.executedSteps.join(" → ") || "—"} · Estado final: {current.finalState}
              {current.scheduled ? " · agendamento ativo" : ""}
            </p>
            {current.divergence ? (
              <p className="mt-1 text-[11px] text-red-400">{current.divergence}</p>
            ) : null}
          </header>

          {/*
            Mesma interface do CRM de Relacionamento — apenas isolada e
            sinalizada como homologação (dados fictícios).
          */}
          <div
            style={themeVars}
            className="crm-root max-h-[460px] overflow-y-auto bg-[color:var(--crm-background)] p-4"
          >
            <p className="mx-auto mb-3 w-fit rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-500">
              Homologação · conversa fictícia · nada é enviado
            </p>
            <CrmThread
              item={{ id: current.leadId, name: current.displayName }}
              messages={threadMessages}
              self={{
                name: executive?.name ?? "Gerente de Expansão",
                photoUrl: executive?.photoUrl ?? null,
              }}
              peer={{ name: current.displayName }}
            />
          </div>

          <div className="grid gap-3 border-t border-[color:var(--border)] p-4 md:grid-cols-2">
            <div>
              <p className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
                <Eye className="h-3 w-3" /> Linha do tempo ({current.reads} visualizações ·{" "}
                {current.responses} respostas)
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-[color:var(--muted-foreground)]">
                {current.journey.map((j, i) => (
                  <li key={`${j.at}-${i}`}>
                    <span className="text-[color:var(--foreground)]">{hour(j.at)}</span> — {j.event}
                    : {j.detail}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
                Decisões do motor (envios e não envios)
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-[color:var(--muted-foreground)]">
                {current.decisions.map((d, i) => (
                  <li key={`${d.at}-${i}`}>
                    <span className="text-[color:var(--foreground)]">{hour(d.at)}</span> ·{" "}
                    {d.step ?? "—"} · {d.outcome} · {d.stateBefore} → {d.stateAfter} — {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
