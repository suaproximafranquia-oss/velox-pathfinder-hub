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
 * Diretrizes obrigatórias do Assistente da Atlas Platform.
 *
 * A plataforma é White Label: nenhuma regra pode referenciar uma empresa
 * específica. Toda inteligência conectada aqui deve obedecer:
 *
 *  1. Responder exclusivamente com base na Base Oficial de Conhecimento
 *     do Workspace ativo.
 *  2. Nunca utilizar conhecimento externo.
 *  3. Nunca inventar respostas, opiniões, promessas ou previsões.
 *  4. Quando a informação não estiver na Base Oficial, informar de forma
 *     educada e sugerir continuar a leitura ou falar com um consultor.
 */
export const ASSISTANT_GUIDELINES = [
  "Responder exclusivamente com base na Base Oficial de Conhecimento do Workspace ativo.",
  "Nunca utilizar conhecimento externo como se fosse conteúdo oficial.",
  "Nunca inventar respostas, opiniões, promessas ou previsões.",
  "Quando não houver informação na Base Oficial, informar de forma educada e sugerir continuar a leitura ou falar com um consultor.",
] as const;

export const OFF_TOPIC_REPLY =
  "Este assistente responde apenas com base na Base Oficial de Conhecimento deste Workspace. Para outros temas, recomendo uma fonte apropriada. Posso ajudar com alguma dúvida a partir do conteúdo oficial?";

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
  return "Obrigado pela pergunta. Em breve, este assistente estará conectado à Base Oficial de Conhecimento deste Workspace e poderá responder de forma detalhada. Enquanto isso, um consultor pode esclarecer este ponto pessoalmente ao final da leitura.";
}

function chapterLabelFor(pathname: string): { title: string; hint: string } {
  const c = getChapterByPath(pathname);
  if (c) {
    const label = c.eyebrow.split("·")[1]?.trim() ?? c.eyebrow;
    return {
      title: label,
      hint: `Você está visualizando o capítulo ${label}. Posso esclarecer dúvidas com base na Base Oficial de Conhecimento deste Workspace.`,
    };
  }
  return {
    title: "Assistente",
    hint: "Posso esclarecer dúvidas com base na Base Oficial de Conhecimento deste Workspace.",
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
          "fixed z-40 bottom-6 right-6 group inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-orange)]/60 bg-[color:var(--brand-blue-deep)] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_48px_-12px_rgba(6,12,28,0.55)] hover:bg-[color:var(--brand-orange)] hover:text-white hover:border-[color:var(--brand-orange)] transition-all",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <MessageCircle className="h-4 w-4 text-[color:var(--brand-orange)] group-hover:text-white transition-colors" />
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
            "absolute right-0 top-0 h-full w-full sm:max-w-md border-l border-white/10 bg-[color:var(--brand-blue-deep)] text-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] flex flex-col",
            open ? "translate-x-0" : "translate-x-full",
          )}
          aria-label="Assistente do Manual"
        >
          <header className="flex items-start justify-between px-6 py-5 border-b border-white/10">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/70 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-[color:var(--brand-orange)]" />
                Assistente do Manual
              </p>
              <p className="text-sm mt-1 truncate text-white">{ctx.title}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
          >
            <div className="rounded-2xl border border-[color:var(--brand-orange)]/30 bg-[color:var(--brand-orange)]/10 px-4 py-3 text-sm leading-relaxed text-white/85">
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
                      ? "bg-[color:var(--brand-orange)]/20 border border-[color:var(--brand-orange)]/40 text-white"
                      : "bg-white/5 border border-white/10 text-white",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 text-sm bg-white/5 border border-white/10 text-white/70">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-orange)] animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-orange)] animate-pulse [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--brand-orange)] animate-pulse [animation-delay:0.3s]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <footer className="border-t border-white/10 p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 focus-within:border-[color:var(--brand-orange)]/60 transition-colors">
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
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-white outline-none placeholder:text-white/50 max-h-32"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || pending}
                aria-label="Enviar"
                className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand-orange)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-white/60 text-center">
              O assistente é um apoio opcional durante a leitura.
            </p>
          </footer>
        </aside>
      </div>
    </>
  );
}