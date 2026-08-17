/**
 * CRM DE HOMOLOGAÇÃO (COMANDO 3B §17 e §19).
 *
 * Exibe as conversas fictícias da rodada exatamente como elas
 * aconteceriam na operação: mensagem, anexo com tipo, visualização,
 * resposta, horário virtual e decisão do motor. Nenhuma destas
 * mensagens existe fora da rodada — nada é enviado para a Meta.
 */
import { useMemo, useState } from "react";
import {
  CheckCheck,
  Eye,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Paperclip,
  Presentation,
} from "lucide-react";
import type { ContentKind } from "@/lib/relationship/content";
import { cn } from "@/lib/utils";

export type HomologationMessageView = {
  direction: "outbound" | "inbound" | "system";
  step: string | null;
  body: string;
  at: string;
  contentId: string | null;
  contentName: string | null;
  contentKind: ContentKind | null;
  contentUrl: string | null;
  contentGroup: string | null;
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

const KIND_ICON: Record<ContentKind, typeof FileText> = {
  texto: FileText,
  imagem: ImageIcon,
  video: Film,
  audio: Mic,
  pdf: FileText,
  documento: FileText,
  apresentacao: Presentation,
  arquivo: Paperclip,
  link: Link2,
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

function Attachment({ message }: { message: HomologationMessageView }) {
  if (!message.contentName) return null;
  const kind = (message.contentKind ?? "arquivo") as ContentKind;
  const Icon = KIND_ICON[kind] ?? Paperclip;
  return (
    <div className="mt-2 rounded-lg border border-[color:var(--border)]/70 bg-[color:var(--background)]/40 p-2">
      {kind === "imagem" && message.contentUrl ? (
        <img
          src={message.contentUrl}
          alt={message.contentName}
          loading="lazy"
          className="mb-2 max-h-40 w-full rounded-md object-cover"
        />
      ) : null}
      <div className="flex items-center gap-2 text-[11px]">
        <Icon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
        <span className="truncate text-[color:var(--foreground)]">{message.contentName}</span>
        <span className="ml-auto shrink-0 uppercase text-[color:var(--muted-foreground)]">
          {kind}
          {message.contentGroup ? ` · ${message.contentGroup}` : ""}
        </span>
      </div>
    </div>
  );
}

export function HomologationCrm({
  conversations,
}: {
  conversations: HomologationConversation[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(conversations[0]?.leadId ?? "");

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

          <div className="max-h-[440px] space-y-2 overflow-y-auto p-4">
            {current.messages.map((m, i) => (
              <div
                key={`${m.at}-${i}`}
                className={cn("flex", m.direction === "inbound" ? "justify-start" : "justify-end")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-xs",
                    m.direction === "inbound"
                      ? "bg-[color:var(--card)]/70 text-[color:var(--foreground)]"
                      : "bg-[color:var(--gold)]/15 text-[color:var(--foreground)]",
                  )}
                >
                  {m.step ? (
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-[color:var(--gold)]">
                      Etapa {m.step}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-line">{m.body}</p>
                  <Attachment message={m} />
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[color:var(--muted-foreground)]">
                    {hour(m.at)}
                    {m.direction === "outbound" ? <CheckCheck className="h-3 w-3" /> : null}
                  </p>
                </div>
              </div>
            ))}
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
