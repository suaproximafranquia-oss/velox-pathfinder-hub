import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Database, ShieldCheck } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  canManageKnowledge,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import {
  listDocuments,
  pullOfficialBase,
  retrievePassages,
  visibleDocuments,
} from "@/lib/knowledge-base";
import { askKnowledge } from "@/lib/ai.functions";

export const Route = createFileRoute("/executivo/ia")({
  head: () => ({
    meta: [
      { title: "IA Corporativa — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IaPage,
});

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

function IaPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [baseSize, setBaseSize] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
    setBaseSize(listDocuments(s.workspaceId).length);
    void pullOfficialBase(s.workspaceId).then((docs) => setBaseSize(docs.length));
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (!session) return null;

  // Somente Administrador e Gestor acessam documentos Restritos.
  // Colaboradores consultam apenas documentos Públicos.
  const canSeeRestricted =
    session.activeRole === "super_admin" || session.activeRole === "diretora";
  const audience: "publico" | "interno" = canSeeRestricted ? "interno" : "publico";
  const canManageBase = canManageKnowledge(session.activeRole);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const allDocs = await pullOfficialBase(session!.workspaceId);
      const scoped = visibleDocuments(allDocs, audience);
      const passages = retrievePassages(q, scoped).map((p) => ({
        source: p.documentName,
        text: p.text,
      }));
      const res = await askKnowledge({ data: { question: q, passages } });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer, sources: res.sources },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Não foi possível consultar a IA Corporativa agora. Tente novamente em instantes.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ExecutiveShell session={session} title="IA Corporativa">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 flex flex-col min-h-[560px]">
          <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-6 py-4">
            <Sparkles className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="font-display text-lg">Consulta à Base Oficial</h2>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5 max-h-[520px]">
            {messages.length === 0 && (
              <div className="text-sm text-[color:var(--muted-foreground)] leading-relaxed">
                Faça uma pergunta corporativa. A IA responderá exclusivamente
                com base na Base Oficial de Conhecimento deste workspace,
                citando as fontes utilizadas.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap " +
                    (m.role === "user"
                      ? "bg-[color:var(--gold)]/10 border border-[color:var(--gold)]/30 text-[color:var(--foreground)]"
                      : "bg-[color:var(--accent)]/60 border border-[color:var(--border)] text-[color:var(--foreground)]")
                  }
                >
                  {m.content}
                  {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[color:var(--border)] text-[11px] text-[color:var(--muted-foreground)]">
                      <span className="uppercase tracking-[0.18em]">Fontes: </span>
                      {m.sources.join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Consultando a Base Oficial…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-[color:var(--border)] p-4 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              placeholder="Pergunte à IA Corporativa…"
              className="flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/40 px-5 py-3 text-sm outline-none focus:border-[color:var(--gold)]/50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-5 py-3 text-sm text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-[color:var(--gold)]" />
              <h3 className="font-display text-sm">Governança</h3>
            </div>
            <ul className="text-[12px] text-[color:var(--muted-foreground)] leading-relaxed space-y-2">
              <li>Responde apenas com base na Base Oficial deste workspace.</li>
              <li>Nunca utiliza conhecimento externo, opiniões ou promessas.</li>
              <li>Sempre informa as fontes utilizadas.</li>
              <li>
                Se a informação não existir na base, responde:{" "}
                <em>“Não encontrei essa informação…”</em>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-[color:var(--gold)]" />
              <h3 className="font-display text-sm">Base Oficial</h3>
            </div>
            <p className="text-[12px] text-[color:var(--muted-foreground)] leading-relaxed">
              {baseSize === 0
                ? "Nenhum documento indexado."
                : `${baseSize} documento(s) indexado(s).`}
            </p>
            {canManageBase && (
              <Link
                to="/executivo/conhecimento"
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition"
              >
                Gerenciar base
              </Link>
            )}
          </div>
        </aside>
      </div>
    </ExecutiveShell>
  );
}