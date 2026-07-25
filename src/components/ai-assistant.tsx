import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { getChapterByPath } from "@/lib/journey-data";
import { cn } from "@/lib/utils";

/**
 * Assistente IA — estrutura inicial.
 *
 * Nesta etapa, nenhuma inteligência artificial está conectada.
 * Toda a arquitetura (mensagens, contexto por capítulo, envio,
 * histórico) já está preparada para receber futuramente uma
 * Base Oficial de Conhecimento e um provedor de IA.
 *
 * O painel mantém a conversa durante toda a navegação (o
 * componente é montado no chrome persistente).
 */

/**
 * Diretrizes obrigatórias do Assistente Velox.
 *
 * Estas regras devem ser aplicadas em qualquer futura integração de IA.
 * Elas existem para garantir fidelidade absoluta ao ecossistema Velox:
 *
 *  1. Responder exclusivamente assuntos relacionados ao ecossistema Velox,
 *     ao Manual do Investidor e à Base Oficial de Conhecimento.
 *  2. Nunca responder perguntas fora desse contexto. Se o usuário perguntar
 *     qualquer assunto externo, responder educadamente informando que o
 *     assistente é especializado exclusivamente nesses conteúdos.
 *  3. Nunca inventar respostas.
 *  4. Nunca utilizar conhecimento externo como se fosse conhecimento oficial
 *     da empresa.
 *  5. Nunca emitir opiniões.
 *  6. Nunca prometer ganhos financeiros.
 *  7. Nunca prometer resultados.
 *  8. Toda futura inteligência deverá utilizar exclusivamente a Base Oficial
 *     de Conhecimento da Velox.
 */
export const ASSISTANT_GUIDELINES = [
  "Responder apenas assuntos relacionados ao ecossistema Velox, ao Manual do Investidor e à Base Oficial de Conhecimento.",
  "Nunca responder perguntas fora desse contexto — informar educadamente a especialização do assistente.",
  "Nunca inventar respostas.",
  "Nunca utilizar conhecimento externo como se fosse conhecimento oficial da Velox.",
  "Nunca emitir opiniões.",
  "Nunca prometer ganhos financeiros.",
  "Nunca prometer resultados.",
  "Utilizar exclusivamente a Base Oficial de Conhecimento da Velox.",
] as const;

export const OFF_TOPIC_REPLY =
  "Este assistente é especializado exclusivamente em conteúdos relacionados à Velox, ao Manual do Investidor e à Base Oficial de Conhecimento. Para outros temas, recomendo uma fonte apropriada. Posso ajudar com qualquer dúvida sobre o ecossistema Velox?";

export type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  chapterSlug?: string;
  createdAt: number;
};

// Ponto de extensão futuro: substituir por chamada real à IA + base de conhecimento.
async function requestAssistantReply(
  _userMessage: string,
  _context: { chapterSlug?: string; chapterTitle?: string },
): Promise<string> {
  return "Obrigado pela pergunta. Em breve, este assistente estará conectado à Base Oficial da Velox e poderá responder de forma detalhada. Enquanto isso, um especialista pode esclarecer este ponto pessoalmente ao final do Manual.";
}

function chapterLabelFor(pathname: string): { title: string; hint: string } {
  const c = getChapterByPath(pathname);
  if (c) {
    const label = c.eyebrow.split("·")[1]?.trim() ?? c.eyebrow;
    return {
      title: label,
      hint: `Você está visualizando o capítulo ${label}. Posso esclarecer dúvidas sobre este assunto ou qualquer outro tema relacionado à Velox.`,
    };
  }
  return {
    title: "Manual do Investidor",
    hint: "Posso esclarecer dúvidas sobre o Manual do Investidor ou qualquer tema relacionado à Velox.",
  };
}

export function AiAssistant() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const ctx = chapterLabelFor(pathname);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || pending) return;
    const userMsg: AssistantMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      chapterSlug: getChapterByPath(pathname)?.slug,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPending(true);
    try {
      const reply = await requestAssistantReply(text, {
        chapterSlug: userMsg.chapterSlug,
        chapterTitle: ctx.title,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: reply,
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Botão flutuante discreto */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir assistente"
        className={cn(
          "fixed z-40 bottom-6 right-6 group inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)]/40 bg-[color:var(--navy)]/90 backdrop-blur-md px-4 py-3 text-sm text-[color:var(--foreground)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] hover:border-[color:var(--gold)] hover:text-[color:var(--gold)] transition-all",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <MessageCircle className="h-4 w-4 text-[color:var(--gold)]" />
        <span className="hidden sm:inline">Tirar uma dúvida</span>
      </button>

      {/* Painel lateral / drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-[color:var(--navy-deep)]/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute right-0 top-0 h-full w-full sm:max-w-md border-l border-[color:var(--border)] bg-[color:var(--navy)] shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] flex flex-col",
            open ? "translate-x-0" : "translate-x-full",
          )}
          aria-label="Assistente do Manual"
        >
          <header className="flex items-start justify-between px-6 py-5 border-b border-[color:var(--border)]">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-[color:var(--gold)]" />
                Assistente do Manual
              </p>
              <p className="text-sm mt-1 truncate">{ctx.title}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="rounded-full p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
          >
            <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 px-4 py-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              {ctx.hint}
            </div>

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
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/30 text-[color:var(--foreground)]"
                      : "bg-[color:var(--card)]/60 border border-[color:var(--border)] text-[color:var(--foreground)]",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm bg-[color:var(--card)]/60 border border-[color:var(--border)] text-[color:var(--muted-foreground)]">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse [animation-delay:0.3s]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <footer className="border-t border-[color:var(--border)] p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-2 focus-within:border-[color:var(--gold)]/40 transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Escreva sua dúvida..."
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-[color:var(--muted-foreground)]/60 max-h-32"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || pending}
                aria-label="Enviar"
                className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--gold-foreground)] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[color:var(--muted-foreground)]/70 text-center">
              O assistente é um apoio opcional durante a leitura.
            </p>
          </footer>
        </aside>
      </div>
    </>
  );
}