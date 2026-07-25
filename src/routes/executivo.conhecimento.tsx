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
  extractTextFromFile,
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
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [visibility, setVisibility] = useState<DocumentVisibility>("publico");
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    if (!canManageKnowledge(s.activeRole)) return void navigate({ to: "/executivo/home" });
    setSession(s);
    setDocs(listDocuments(s.workspaceId));
  }, [navigate]);

  if (!session) return null;

  function refresh() {
    setDocs(listDocuments(session!.workspaceId));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setFlash(null);
    for (const file of Array.from(files)) {
      const id = newDocumentId();
      const now = new Date().toISOString();
      const provisional: KnowledgeDocument = {
        id,
        workspaceId: session!.workspaceId,
        name: file.name,
        type: file.name.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : file.name.toLowerCase().endsWith(".docx")
            ? "docx"
            : "txt",
        visibility,
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
        const { text, type } = await extractTextFromFile(file);
        const chunks = chunkText(text);
        updateDocument(id, { chunks, type, status: chunks.length ? "ativo" : "erro" });
        refresh();
      } catch (e) {
        updateDocument(id, { status: "erro" });
        refresh();
        setFlash({
          type: "err",
          msg: `Falha ao processar "${file.name}": ${(e as Error).message}`,
        });
      }
    }
    setBusy(false);
    setFlash((f) => f ?? { type: "ok", msg: "Documento(s) indexado(s) com sucesso." });
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleRemove(id: string) {
    removeDocument(id);
    refresh();
  }

  const stats = useMemo(() => {
    return {
      total: docs.length,
      ativos: docs.filter((d) => d.status === "ativo").length,
      publicos: docs.filter((d) => d.visibility === "publico").length,
      restritos: docs.filter((d) => d.visibility === "restrito").length,
    };
  }, [docs]);

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
          Formatos aceitos: PDF, Word (.docx), TXT. Antes de enviar, defina a
          visibilidade.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] mb-2">
              Visibilidade
            </label>
            <div className="flex gap-2">
              {(["publico", "restrito"] as const).map((v) => {
                const active = visibility === v;
                const Icon = v === "publico" ? Eye : EyeOff;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
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
              {visibility === "publico"
                ? "Disponível para Investidores, Colaboradores, Gestores e Administradores."
                : "Disponível apenas para Colaboradores, Gestores e Administradores."}
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              disabled={busy}
              onChange={(e) => handleFiles(e.target.files)}
              className="block text-xs text-[color:var(--muted-foreground)] file:mr-4 file:rounded-full file:border file:border-[color:var(--gold)]/50 file:bg-[color:var(--gold)]/10 file:px-4 file:py-2 file:text-xs file:font-medium file:text-[color:var(--gold)] hover:file:bg-[color:var(--gold)]/20"
            />
          </div>
        </div>

        {busy && (
          <div className="mt-4 flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processando e indexando…
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
    </ExecutiveShell>
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