import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  Upload,
  Trash2,
  AlertTriangle,
  FileText,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  canManageKnowledge,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import {
  addDocument,
  chunkText,
  ingestFile,
  type IngestLog,
  listDocuments,
  newDocumentId,
  removeDocument,
  resetWorkspace,
  updateDocument,
  STATUS_LABEL,
  VISIBILITY_LABEL,
  type DocumentVisibility,
  type KnowledgeDocument,
} from "@/lib/knowledge-base";

export const Route = createFileRoute("/executivo/conhecimento")({
  head: () => ({
    meta: [
      { title: "Central de Conhecimento — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [logs, setLogs] = useState<IngestLog[]>([]);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, setPending] = useState<{
    file: File;
    name: string;
    visibility: DocumentVisibility;
    description: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    if (!canManageKnowledge(s.activeRole)) return void navigate({ to: "/executivo/home" });
    setSession(s);
    setDocs(listDocuments(s.workspaceId));
  }, [navigate]);

  const stats = useMemo(() => {
    return {
      total: docs.length,
      ativos: docs.filter((d) => d.status === "ativo").length,
      publicos: docs.filter((d) => d.visibility === "publico").length,
      restritos: docs.filter((d) => d.visibility === "restrito").length,
    };
  }, [docs]);

  if (!session) return null;

  function refresh() {
    setDocs(listDocuments(session!.workspaceId));
  }

  function onPickFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const lower = file.name.toLowerCase();
    const ok = lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".txt");
    if (!ok) {
      setFlash({
        type: "err",
        msg: "Formato não suportado. Envie PDF, Word (.docx) ou TXT.",
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPending({
      file,
      name: file.name.replace(/\.[^.]+$/, ""),
      visibility: "publico",
      description: "",
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submitPending() {
    if (!pending || busy) return;
    const { file, name, visibility, description } = pending;
    const displayName = name.trim() || file.name;
    setPending(null);
    setBusy(true);
    setFlash(null);
    setLogs([]);
    const id = newDocumentId();
    const now = new Date().toISOString();
    const provisional: KnowledgeDocument = {
      id,
      workspaceId: session!.workspaceId,
      name: displayName,
      type: file.name.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : file.name.toLowerCase().endsWith(".docx")
          ? "docx"
          : "txt",
      visibility,
      description: description.trim() || undefined,
      sizeBytes: file.size,
      uploadedByUserId: session!.userId,
      uploadedByName: session!.name,
      uploadedAt: now,
      updatedAt: now,
      status: "processando",
      chunks: [],
    };
    addDocument(provisional);
    refresh();
    try {
      setStage("Analisando documento…");
      const result = await ingestFile(file, (entry) => {
        setLogs((prev) => [...prev, entry]);
        setStage(entry.msg);
        // cede o event loop para o React repintar o painel de logs.
        return new Promise<void>((r) => setTimeout(r, 0)) as unknown as void;
      });
      setStage("Indexando conteúdo…");
      await new Promise((r) => setTimeout(r, 50));
      const chunks = chunkText(result.text);
      setStage("Atualizando Base Oficial…");
      await new Promise((r) => setTimeout(r, 150));
      // Nunca descartar conteúdo parcial: se houver qualquer chunk, ativa.
      updateDocument(id, {
        chunks,
        type: result.type,
        status: chunks.length ? "ativo" : "erro",
      });
      refresh();
      if (chunks.length) {
        const suffix = result.usedOcr
          ? result.partial
            ? ` — indexado parcialmente via OCR (${result.pagesProcessed}/${result.pagesTotal} páginas).`
            : ` — indexado via OCR (${result.pagesProcessed}/${result.pagesTotal} páginas).`
          : ".";
        setFlash({
          type: "ok",
          msg: `"${displayName}" foi indexado e está disponível${suffix}`,
        });
      } else {
        setFlash({
          type: "err",
          msg: `Não foi possível reconhecer conteúdo em "${displayName}", mesmo após OCR.`,
        });
      }
    } catch (e) {
      updateDocument(id, { status: "erro" });
      refresh();
      setFlash({
        type: "err",
        msg: `Falha ao processar "${displayName}": ${(e as Error).message}`,
      });
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  function handleRemove(id: string) {
    removeDocument(id);
    refresh();
  }

  return (
    <ExecutiveShell session={session} title="Central de Conhecimento">
      <p className="text-sm text-[color:var(--muted-foreground)] max-w-3xl mb-8 leading-relaxed">
        Base Oficial de Conhecimento do Workspace. Documentos enviados aqui
        alimentam a IA Corporativa e demais módulos autorizados. A classificação
        de visibilidade é definida pelo Administrador — nunca pela IA.
      </p>

      <div className="grid gap-3 sm:grid-cols-4 mb-8">
        <Stat label="Documentos" value={stats.total} />
        <Stat label="Ativos" value={stats.ativos} />
        <Stat label="Públicos" value={stats.publicos} />
        <Stat label="Restritos" value={stats.restritos} />
      </div>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="h-4 w-4 text-[color:var(--gold)]" />
          <h2 className="font-display text-lg">Enviar documento</h2>
        </div>
        <p className="text-xs text-[color:var(--muted-foreground)] mb-5">
          Formatos aceitos: PDF, Word (.docx) e TXT. Após selecionar o
          arquivo, você poderá definir nome, visibilidade e descrição antes
          do envio.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => onPickFile(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-5 py-2.5 text-sm text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Adicionar Documento
        </button>

        {busy && (
          <div className="mt-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)]/30 px-4 py-3 text-xs text-[color:var(--muted-foreground)]">
            <div className="flex items-center gap-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--gold)]" />
              <span>{stage || "Processando…"}</span>
            </div>
            {logs.length > 0 && (
              <ul className="mt-3 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed">
                {logs.map((l, i) => (
                  <li
                    key={i}
                    className={l.ok ? "text-emerald-300/90" : "text-amber-300/90"}
                  >
                    {l.ok ? "✓" : "✖"} {l.msg}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {flash && !busy && (
          <div
            className={
              "mt-4 rounded-xl border px-4 py-3 text-xs " +
              (flash.type === "ok"
                ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
                : "border-red-400/30 bg-red-400/5 text-red-300")
            }
          >
            {flash.type === "ok" ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> {flash.msg}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> {flash.msg}
              </span>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="font-display text-lg">Base Oficial</h2>
          </div>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-red-400/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Resetar Base
          </button>
        </div>
        {docs.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-[color:var(--muted-foreground)]">
            Nenhum documento indexado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
                <tr className="border-b border-[color:var(--border)]">
                  <th className="text-left px-6 py-3">Documento</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Visibilidade</th>
                  <th className="text-left px-4 py-3">Enviado por</th>
                  <th className="text-left px-4 py-3">Envio</th>
                  <th className="text-left px-4 py-3">Atualizado</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[color:var(--border)]/60 hover:bg-[color:var(--accent)]/30"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                        <span>{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 uppercase text-xs text-[color:var(--muted-foreground)]">
                      {d.type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " +
                          (d.visibility === "publico"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-amber-400/10 text-amber-300")
                        }
                      >
                        {VISIBILITY_LABEL[d.visibility]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                      {d.uploadedByName}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                      {formatDate(d.uploadedAt)}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted-foreground)]">
                      {formatDate(d.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={d.status} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(d.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] text-[color:var(--muted-foreground)] hover:text-red-300 hover:border-red-400/40 transition"
                      >
                        <Trash2 className="h-3 w-3" /> Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resetOpen && (
        <ResetModal
          onCancel={() => setResetOpen(false)}
          onConfirm={() => {
            resetWorkspace(session.workspaceId);
            setResetOpen(false);
            refresh();
            setFlash({ type: "ok", msg: "Base Oficial resetada com sucesso." });
          }}
        />
      )}

      {pending && (
        <UploadModal
          pending={pending}
          onChange={(p) => setPending(p)}
          onCancel={() => setPending(null)}
          onConfirm={submitPending}
        />
      )}
    </ExecutiveShell>
  );
}

function UploadModal({
  pending,
  onChange,
  onCancel,
  onConfirm,
}: {
  pending: {
    file: File;
    name: string;
    visibility: DocumentVisibility;
    description: string;
  };
  onChange: (p: {
    file: File;
    name: string;
    visibility: DocumentVisibility;
    description: string;
  }) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--navy-deep)]/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-[color:var(--navy)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-[color:var(--gold)]" />
          <h3 className="font-display text-lg">Novo documento</h3>
        </div>
        <p className="text-[11px] text-[color:var(--muted-foreground)] mb-4">
          Arquivo selecionado:{" "}
          <span className="text-[color:var(--foreground)]">{pending.file.name}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1.5">
              Nome do documento
            </label>
            <input
              type="text"
              value={pending.name}
              onChange={(e) => onChange({ ...pending, name: e.target.value })}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
              Visibilidade
            </label>
            <div className="flex gap-2">
              {(["publico", "restrito"] as const).map((v) => {
                const active = pending.visibility === v;
                const Icon = v === "publico" ? Eye : EyeOff;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ ...pending, visibility: v })}
                    className={
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition " +
                      (active
                        ? "border-[color:var(--gold)]/50 bg-[color:var(--accent)] text-[color:var(--foreground)]"
                        : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]")
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {VISIBILITY_LABEL[v]}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
              {pending.visibility === "publico"
                ? "Disponível para todos os perfis autenticados do Workspace."
                : "Disponível apenas para Colaboradores, Gestores e Administradores."}
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-1.5">
              Descrição (opcional)
            </label>
            <textarea
              value={pending.description}
              onChange={(e) => onChange({ ...pending, description: e.target.value })}
              rows={3}
              placeholder="Breve descrição do conteúdo, escopo ou finalidade do documento."
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!pending.name.trim()}
            className="rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-5 py-2 text-xs text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="font-display text-2xl mt-2">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: KnowledgeDocument["status"] }) {
  const cls =
    status === "ativo"
      ? "bg-emerald-400/10 text-emerald-300"
      : status === "processando"
        ? "bg-sky-400/10 text-sky-300"
        : "bg-red-400/10 text-red-300";
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " + cls}>
      {status === "processando" && <Loader2 className="h-3 w-3 animate-spin" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ResetModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [text, setText] = useState("");
  const ok = text.trim() === "CONFIRMAR RESET";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--navy-deep)]/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[color:var(--navy)] p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-red-300" />
          <h3 className="font-display text-lg">Resetar Base Oficial</h3>
        </div>
        <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed mb-4">
          Esta ação remove todos os documentos indexados deste workspace. Não
          pode ser desfeita. Para continuar, digite{" "}
          <span className="font-mono text-[color:var(--foreground)]">CONFIRMAR RESET</span>.
        </p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="CONFIRMAR RESET"
          className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-4 py-3 text-sm outline-none focus:border-red-400/50"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!ok}
            onClick={onConfirm}
            className="rounded-full border border-red-400/50 bg-red-400/10 px-4 py-2 text-xs text-red-300 hover:bg-red-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Resetar
          </button>
        </div>
      </div>
    </div>
  );
}