import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Send, Loader2, X, FileDown, ShieldCheck } from "lucide-react";
import type { ExecutiveSession } from "@/lib/executive-auth";
import { ROLE_LABEL } from "@/lib/executive-auth";
import { askKpiInsights } from "@/lib/ai.functions";
import {
  buildKpiInsightSnapshot,
  serializeSnapshotForPrompt,
} from "@/lib/kpi-ai";
import { findMonth } from "@/lib/kpi-manager";
import { cn } from "@/lib/utils";

/**
 * IA Gerencial — botao flutuante + modal disponivel em KPI e Relatorios.
 * Restrito aos perfis Administrador e Gestor.
 */

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  question?: string;
};

const SUGGESTIONS = [
  "Compare o desempenho entre dois executivos.",
  "Compare este mes com o mes anterior.",
  "Qual executivo apresentou maior evolucao?",
  "Quem possui melhor conversao?",
  "Quais indicadores precisam de atencao?",
  "Faca uma analise completa do funil.",
  "Analise os ultimos 90 dias.",
  "Quais oportunidades de melhoria voce identifica?",
  "Gere um resumo executivo.",
];

export function canUseKpiInsights(session: ExecutiveSession): boolean {
  return session.activeRole === "super_admin" || session.activeRole === "diretora";
}

export function KpiAiAssistant({
  session,
  monthKey,
  origin,
}: {
  session: ExecutiveSession;
  monthKey: string;
  origin: "kpi" | "reports";
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const monthLabel = useMemo(() => findMonth(monthKey).label, [monthKey]);
  const scopeLabel =
    session.activeRole === "super_admin"
      ? "Consolidado geral"
      : "Equipe sob gestao";

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  if (!canUseKpiInsights(session)) return null;

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { id: `u_${Date.now()}`, role: "user", content: q },
    ]);
    setBusy(true);
    try {
      const snapshot = buildKpiInsightSnapshot(session, monthKey);
      const serialized = serializeSnapshotForPrompt(snapshot);
      const res = await askKpiInsights({
        data: { question: q, snapshot: serialized, monthLabel },
      });
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: res.answer,
          question: q,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content:
            "Nao foi possivel consultar a IA Gerencial agora. Tente novamente em instantes.",
          question: q,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf(msg: ChatMessage) {
    if (!msg.question) return;
    const snapshot = buildKpiInsightSnapshot(session, monthKey);
    // Motor de PDF carregado sob demanda (não pesa no KPI Manager).
    const { generateKpiInsightPdf } = await import("@/lib/kpi-ai-report");
    generateKpiInsightPdf({
      question: msg.question,
      answer: msg.content,
      monthLabel,
      scopeLabel,
      actorName: `${session.name} · ${ROLE_LABEL[session.activeRole]}`,
      snapshot,
    });
  }

  return (
    <>
      {/* Botao flutuante — mesmo padrao das demais IAs */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir IA Gerencial"
        className={cn(
          "fixed z-40 bottom-6 right-6 group inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/60 bg-[color:var(--navy-deep)] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_48px_-12px_rgba(6,12,28,0.55)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] hover:border-[color:var(--gold)] transition-all",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <Sparkles className="h-4 w-4 text-[color:var(--gold)] group-hover:text-[color:var(--gold-foreground)] transition-colors" />
        <span className="hidden sm:inline">IA Gerencial</span>
      </button>

      {/* Modal sobre a tela */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-[color:var(--navy-deep)]/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <aside
            className={cn(
              "relative w-full max-w-3xl h-[86vh] max-h-[840px] rounded-3xl border border-[color:var(--gold)]/25 bg-[color:var(--navy-deep)] text-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-300",
              open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
            )}
            aria-label="IA Gerencial"
          >
            <header className="flex items-start justify-between px-6 py-5 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/70 flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-[color:var(--gold)]" />
                  IA Gerencial · Atlas Platform
                </p>
                <p className="font-display text-lg mt-1 text-white">
                  Analise de KPIs — {monthLabel}
                </p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {scopeLabel} · Contexto: {origin === "kpi" ? "KPI Manager" : "Relatorios Executivos"}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar IA Gerencial"
                className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
            >
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 px-4 py-3 text-sm leading-relaxed text-white/90 flex items-start gap-3">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--gold)] mt-0.5 flex-shrink-0" />
                    <span>
                      Responde exclusivamente a partir dos indicadores oficiais
                      do KPI Manager, respeitando as permissoes do seu perfil.
                      Nao utiliza conhecimento externo.
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/60 mb-2">
                      Sugestoes rapidas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => send(s)}
                          className="text-xs rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:text-white hover:border-[color:var(--gold)]/60 hover:bg-white/10 transition"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-[color:var(--gold)]/15 border border-[color:var(--gold)]/40 text-white"
                        : "bg-white/5 border border-white/10 text-white",
                    )}
                  >
                    {m.content}
                    {m.role === "assistant" && m.question && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void exportPdf(m)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)]/50 px-3 py-1.5 text-[11px] text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          Gerar PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analisando os indicadores oficiais...
                </div>
              )}
            </div>

            <footer className="border-t border-white/10 p-4">
              <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 focus-within:border-[color:var(--gold)]/60 transition-colors">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Pergunte sobre indicadores, executivos ou tendencias..."
                  className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-white/50 max-h-32"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || busy}
                  aria-label="Enviar"
                  className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--gold-foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-white/60 text-center">
                A IA Gerencial responde apenas com base no snapshot oficial do
                KPI Manager para {monthLabel}.
              </p>
            </footer>
          </aside>
        </div>
      </div>
    </>
  );
}