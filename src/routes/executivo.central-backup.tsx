/**
 * Central de Backup — proteção, histórico e recuperação integral.
 *
 * O Portal não trabalha com backups por módulo: um ponto de restauração
 * representa o estado completo dos dados persistidos. Toda restauração
 * é precedida, obrigatoriamente, de um Backup de Segurança do estado
 * atual. Área exclusiva do Administrador.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  DatabaseBackup,
  ShieldCheck,
  RotateCcw,
  Clock,
  HardDrive,
  MessagesSquare,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { isCrmAdministrator } from "@/lib/crm/permissions";
import { listBackups, createBackupNow, restorePortalBackup } from "@/lib/backup.functions";
import type { BackupSummary, RestoreLogEntry } from "@/lib/backup.functions";
import {
  captureLocalState,
  applyLocalState,
  formatBytes,
  BACKUP_ORIGIN_LABEL,
  BACKUP_KIND_LABEL,
  AUTO_BACKUP_INTERVAL_MINUTES,
} from "@/lib/backup/local-state";
import { logAudit } from "@/lib/audit-log";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/central-backup")({
  head: () => ({
    meta: [
      { title: "Central de Backup — Atlas Platform" },
      {
        name: "description",
        content:
          "Pontos de restauração do estado integral do Portal Velox, com backup automático contínuo e restauração protegida.",
      },
      { property: "og:title", content: "Central de Backup — Atlas Platform" },
      {
        property: "og:description",
        content: "Proteção, histórico e recuperação integral dos dados do Portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BackupCenterPage,
});

function formatMoment(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextRun(lastIso: string | null): string {
  const base = lastIso ? Date.parse(lastIso) : Date.now();
  const next = base + AUTO_BACKUP_INTERVAL_MINUTES * 60_000;
  const delta = Math.max(0, Math.round((next - Date.now()) / 60_000));
  return `${formatMoment(new Date(next).toISOString())} · em ${delta} min`;
}

function BackupCenterPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [restores, setRestores] = useState<RestoreLogEntry[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "erro"; text: string } | null>(null);
  const [pending, setPending] = useState<BackupSummary | null>(null);

  const fetchAll = useServerFn(listBackups);
  const createNow = useServerFn(createBackupNow);
  const restoreNow = useServerFn(restorePortalBackup);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  const isAdmin = session ? isCrmAdministrator(session.activeRole) : false;

  const reload = useCallback(async () => {
    try {
      const result = await fetchAll();
      setBackups(result.backups);
      setRestores(result.restores);
      setTotalBytes(result.totalBytes);
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "erro",
        text: error instanceof Error ? error.message : "Não foi possível carregar os backups.",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    if (isAdmin) void reload();
    else setLoading(false);
  }, [isAdmin, reload]);

  const full = useMemo(() => backups.filter((b) => b.kind === "completo"), [backups]);
  const conversations = useMemo(() => backups.filter((b) => b.kind === "conversas"), [backups]);
  const lastFull = full[0] ?? null;

  async function handleCreate(kind: "completo" | "conversas") {
    if (!session) return;
    setBusy(kind);
    setFeedback(null);
    try {
      const record = await createNow({
        data: {
          kind,
          actorName: session.name,
          localState: captureLocalState(kind === "conversas" ? "conversas" : "completo"),
        },
      });
      logAudit({
        actorId: session.userId,
        actorName: session.name,
        actorRole: session.activeRole,
        module: "administracao",
        action: "Criação de ponto de restauração",
        target: BACKUP_KIND_LABEL[kind],
        details: `Identificador ${record.id} · ${formatBytes(record.sizeBytes)}`,
        severity: "success",
      });
      setFeedback({ tone: "ok", text: "Ponto de restauração criado com sucesso." });
      await reload();
    } catch (error) {
      setFeedback({
        tone: "erro",
        text: error instanceof Error ? error.message : "Falha ao criar o backup.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore(record: BackupSummary) {
    if (!session) return;
    setBusy(record.id);
    setFeedback(null);
    const scope = record.kind === "conversas" ? "conversas" : "completo";
    try {
      const result = await restoreNow({
        data: {
          backupId: record.id,
          actorName: session.name,
          localState: captureLocalState(scope),
        },
      });
      if (result.localState) applyLocalState(result.localState, scope);
      logAudit({
        actorId: session.userId,
        actorName: session.name,
        actorRole: session.activeRole,
        module: "administracao",
        action: "Restauração do Portal",
        target: `${record.label} · ${formatMoment(record.createdAt)}`,
        details: `Backup de Segurança ${result.safetyBackupId} criado antes da restauração.`,
        severity: "critical",
      });
      setFeedback({
        tone: "ok",
        text: "Restauração concluída. O estado anterior ficou preservado no Backup de Segurança.",
      });
      setPending(null);
      await reload();
    } catch (error) {
      setFeedback({
        tone: "erro",
        text: error instanceof Error ? error.message : "Falha na restauração.",
      });
    } finally {
      setBusy(null);
    }
  }

  if (!session) return null;

  if (!isAdmin) {
    return (
      <ExecutiveShell session={session} title="Central de Backup">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 text-sm text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mb-3 h-5 w-5 text-[color:var(--gold)]" />
          Área restrita. A Central de Backup e a função de restauração são
          exclusivas de Administradores autorizados.
        </div>
      </ExecutiveShell>
    );
  }

  return (
    <ExecutiveShell session={session} title="Central de Backup">
      <div className="space-y-8">
        {feedback ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
              feedback.tone === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300",
            )}
          >
            {feedback.tone === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4" />
            )}
            <span>{feedback.text}</span>
          </div>
        ) : null}

        {/* Backup Completo do Portal */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <DatabaseBackup className="h-5 w-5 text-[color:var(--gold)]" />
              <div>
                <h2 className="text-lg font-semibold">Backup Completo do Portal</h2>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  Cada ponto representa o estado integral dos dados do Portal —
                  CRM, leads, workspace, documentos, reuniões, KPIs, usuários,
                  permissões, configurações e integrações.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCreate("completo")}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--gold)]/20 disabled:opacity-50"
            >
              {busy === "completo" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DatabaseBackup className="h-4 w-4" />
              )}
              Criar Backup Agora
            </button>
          </header>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Último backup" value={lastFull ? formatMoment(lastFull.createdAt) : "—"} icon={Clock} />
            <Stat label="Próximo backup" value={nextRun(lastFull?.createdAt ?? null)} icon={Clock} />
            <Stat label="Status" value={loading ? "Carregando…" : "Rotina ativa · 15 min"} icon={ShieldCheck} />
            <Stat label="Pontos disponíveis" value={String(full.length)} icon={DatabaseBackup} />
            <Stat label="Armazenamento" value={formatBytes(totalBytes)} icon={HardDrive} />
          </dl>
        </section>

        {/* Fila automática — leitura */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="text-lg font-semibold">Execuções Automáticas por Hora</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Cada hora cheia gera uma solicitação. Uma chamada interrompida não
            perde a hora: a solicitação permanece na fila e é retomada no ciclo
            seguinte.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
                <tr>
                  <th className="py-2">Hora de referência</th>
                  <th className="py-2">Situação</th>
                  <th className="py-2">Tentativas</th>
                  <th className="py-2">Concluída em</th>
                  <th className="py-2">Último erro</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-[color:var(--muted-foreground)]">
                      {loading ? "Carregando fila…" : "Nenhuma solicitação registrada ainda."}
                    </td>
                  </tr>
                ) : (
                  queue.map((item) => (
                    <tr key={item.id} className="border-t border-[color:var(--border)]/60">
                      <td className="py-2">{formatMoment(item.referenceHour)}</td>
                      <td className="py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            item.status === "concluido"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : item.status === "falha"
                                ? "bg-red-500/10 text-red-300"
                                : "bg-[color:var(--accent)] text-[color:var(--muted-foreground)]",
                          )}
                        >
                          {QUEUE_STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="py-2">{item.attempts}</td>
                      <td className="py-2">
                        {item.completedAt ? formatMoment(item.completedAt) : "—"}
                      </td>
                      <td className="py-2 text-[color:var(--muted-foreground)]">
                        {item.lastError ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Histórico de pontos de restauração */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="text-lg font-semibold">Histórico de Pontos de Restauração</h2>
          <BackupTable
            rows={full}
            busy={busy}
            empty={
              loading
                ? "Carregando pontos de restauração…"
                : "Nenhum ponto de restauração registrado até o momento."
            }
            onRestore={setPending}
          />
        </section>


        {/* Backup de Conversas */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MessagesSquare className="h-5 w-5 text-[color:var(--gold)]" />
              <div>
                <h2 className="text-lg font-semibold">Backup de Conversas</h2>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  Categoria separada por volume e natureza própria. Não
                  substitui nem fragmenta o Backup Completo do Portal.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleCreate("conversas")}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm transition hover:bg-[color:var(--accent)] disabled:opacity-50"
            >
              {busy === "conversas" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessagesSquare className="h-4 w-4" />
              )}
              Criar Backup de Conversas
            </button>
          </header>
          <BackupTable
            rows={conversations}
            busy={busy}
            empty="Nenhum backup de conversas registrado."
            onRestore={setPending}
          />
        </section>

        {/* Auditoria das restaurações */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="text-lg font-semibold">Restaurações Realizadas</h2>
          {restores.length === 0 ? (
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              Nenhuma restauração executada.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {restores.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-[color:var(--border)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatMoment(r.createdAt)}</span>
                    <span className="text-[color:var(--muted-foreground)]">
                      · {r.performedByName} · {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    Ponto {r.backupId ?? "—"} · Backup de Segurança {r.safetyBackupId ?? "—"}
                    {r.details ? ` · ${r.details}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
            <h3 className="text-lg font-semibold">Confirmar restauração</h3>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              O Portal será restaurado para o estado registrado neste ponto.
              Antes da restauração, o estado atual será preservado
              automaticamente em um Backup de Segurança, permitindo desfazer a
              operação caso necessário.
            </p>
            <p className="mt-3 rounded-xl border border-[color:var(--border)] px-4 py-3 text-sm">
              {pending.label} — {formatMoment(pending.createdAt)}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy !== null}
                className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRestore(pending)}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy === pending.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Restaurar com proteção
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ExecutiveShell>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] px-4 py-3">
      <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function BackupTable({
  rows,
  busy,
  empty,
  onRestore,
}: {
  rows: BackupSummary[];
  busy: string | null;
  empty: string;
  onRestore: (record: BackupSummary) => void;
}) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">{empty}</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[color:var(--muted-foreground)]">
          <tr>
            <th className="py-2 pr-4">Data e hora</th>
            <th className="py-2 pr-4">Tipo</th>
            <th className="py-2 pr-4">Origem</th>
            <th className="py-2 pr-4">Identificador</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Tamanho</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-[color:var(--border)]">
              <td className="py-3 pr-4">{formatMoment(b.createdAt)}</td>
              <td className="py-3 pr-4">{BACKUP_KIND_LABEL[b.kind] ?? b.kind}</td>
              <td className="py-3 pr-4">{BACKUP_ORIGIN_LABEL[b.origin] ?? b.origin}</td>
              <td className="py-3 pr-4 font-mono text-xs">{b.id.slice(0, 8)}</td>
              <td className="py-3 pr-4 capitalize">{b.status}</td>
              <td className="py-3 pr-4">{formatBytes(b.sizeBytes)}</td>
              <td className="py-3">
                <button
                  type="button"
                  onClick={() => onRestore(b)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs transition hover:bg-[color:var(--accent)] disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}