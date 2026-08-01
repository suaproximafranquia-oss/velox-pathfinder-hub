/**
 * Backup de Conversas (DEF 2.4.9) — Central Corporativa.
 *
 * Módulo exclusivamente de consulta: cada relacionamento gera um registro
 * permanente. Nenhuma função operacional é oferecida aqui. A abertura de
 * qualquer backup exige motivo declarado e gera log permanente.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Lock,
  Search,
  ShieldCheck,
  Clock,
  X,
  Share2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  listConversationBackups,
  getBackupDetail,
  type CrmBackupRecord,
} from "@/lib/crm/backups";
import {
  BACKUP_REASONS,
  recordBackupAccess,
  listBackupAccessLog,
  grantBackupToSupervisor,
  revokeBackupGrant,
  backupGrantFor,
  formatGrantRemaining,
} from "@/lib/crm/backup-access";
import { CRM_TIMELINE_LABEL, formatCrmTimestamp } from "@/lib/crm/timeline";
import { isCrmAdministrator, isCrmSupervisor } from "@/lib/crm/permissions";
import { restoreRelationship } from "@/lib/crm/commercial";

/** Abas oficiais da Central única de Backup (DEF 2.4.11). */
const BACKUP_TABS = ["GreenSales", "Portal"] as const;
type BackupTab = (typeof BACKUP_TABS)[number];

export const Route = createFileRoute("/executivo/backups")({
  head: () => ({
    meta: [
      { title: "Backup de Conversas — Atlas Platform" },
      {
        name: "description",
        content:
          "Registro permanente e somente leitura dos relacionamentos do CRM, com controle de motivo e log de abertura.",
      },
      { property: "og:title", content: "Backup de Conversas — Atlas Platform" },
      {
        property: "og:description",
        content: "Consulta corporativa dos relacionamentos, em modo somente leitura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BackupsPage,
});

function BackupsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState<CrmBackupRecord | null>(null);
  const [open, setOpen] = useState<CrmBackupRecord | null>(null);
  const [tab, setTab] = useState<BackupTab>("GreenSales");

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/executivo" });
      return;
    }
    setSession(s);
  }, [navigate]);

  // Arquivamento, restauração e auditoria refletem na hora.
  useEffect(() => onSync(() => setTick((v) => v + 1)), []);

  const isAdmin = session ? isCrmAdministrator(session.activeRole) : false;
  const isSupervisor = session ? isCrmSupervisor(session.activeRole) : false;

  const records = useMemo(() => {
    if (!session) return [];
    const all = listConversationBackups().filter((r) =>
      tab === "GreenSales"
        ? r.workspaceKind === "green_sales" && !r.archived
        : r.workspaceKind === "portal" && r.archived,
    );
    // A Gestora nunca vê conversas automaticamente: apenas as cópias
    // temporárias autorizadas pelo Administrador (24 horas).
    const scoped =
      tab === "Portal"
        ? // Backup Portal pertence ao Executivo responsável — restauração
          // operacional, sem justificativa.
          isAdmin
          ? all
          : all.filter((r) => r.executiveId === session.userId)
        : isAdmin
          ? all
          : isSupervisor
            ? all.filter((r) => Boolean(backupGrantFor(r.investorId)))
            : all.filter((r) => r.executiveId === session.userId);
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.executiveName.toLowerCase().includes(q) ||
        r.workspaceLabel.toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isAdmin, isSupervisor, query, tick, tab]);

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Backup de Conversas">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
            <Archive className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-xl">Backup de Conversas</h1>
            <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
              Central única de backup. A aba GreenSales é corporativa e somente
              leitura, com motivo obrigatório e auditoria permanente. A aba
              Portal pertence ao Executivo responsável e permite restauração
              operacional das conversas arquivadas.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/40 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por investidor ou Executivo"
            className="w-56 bg-transparent text-xs outline-none placeholder:text-[color:var(--muted-foreground)]"
          />
        </label>
      </div>

      <nav className="mb-5 flex gap-1 border-b border-[color:var(--border)]">
        {BACKUP_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "cursor-pointer rounded-t-lg px-4 py-2 text-xs transition",
              tab === t
                ? "border-b-2 border-[color:var(--gold)] text-[color:var(--foreground)]"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </nav>

      {records.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/30 p-12 text-center">
          <p className="font-display text-lg">Nenhum backup disponível.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-foreground)]">
            {tab === "Portal"
              ? "As conversas arquivadas do Portal aparecem aqui, prontas para restauração."
              : isSupervisor
              ? "As conversas dos Executivos só aparecem aqui mediante autorização temporária do Administrador."
              : "Os relacionamentos registrados no CRM aparecem automaticamente nesta Central."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {records.map((r) => (
            <BackupCard
              key={r.investorId}
              record={r}
              isAdmin={isAdmin}
              adminId={session.userId}
              portalTab={tab === "Portal"}
              onOpen={() => (tab === "Portal" ? setOpen(r) : setPending(r))}
              onRestore={() => {
                restoreRelationship({
                  investorId: r.investorId,
                  investorName: r.name,
                  actorId: session.userId,
                  actorName: session.name,
                  actorRole: session.activeRole,
                  ownerId: r.executiveId,
                  origin: r.originLabel,
                });
                setTick((v) => v + 1);
              }}
              onShareChanged={() => setTick((v) => v + 1)}
            />
          ))}
        </div>
      )}

      {pending ? (
        <ReasonDialog
          record={pending}
          onCancel={() => setPending(null)}
          onConfirm={(reason) => {
            recordBackupAccess({
              investorId: pending.investorId,
              investorName: pending.name,
              userId: session.userId,
              userName: session.name,
              userRole: session.activeRole,
              reason,
            });
            setOpen(pending);
            setPending(null);
          }}
        />
      ) : null}

      {open ? <BackupReader record={open} onClose={() => setOpen(null)} /> : null}
    </ExecutiveShell>
  );
}

function BackupCard({
  record,
  isAdmin,
  adminId,
  portalTab,
  onOpen,
  onRestore,
  onShareChanged,
}: {
  record: CrmBackupRecord;
  isAdmin: boolean;
  adminId: string;
  portalTab: boolean;
  onOpen: () => void;
  onRestore: () => void;
  onShareChanged: () => void;
}) {
  const grant = backupGrantFor(record.investorId);
  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/45 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-base">{record.name}</h2>
          <p className="mt-0.5 text-[11px] text-[color:var(--muted-foreground)]">
            {record.executiveName} · {record.workspaceLabel}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
          <Lock className="h-3 w-3" /> Somente leitura
        </span>
      </header>

      <dl className="mt-4 space-y-1.5 text-xs">
        <Row label="Status" value={record.stateLabel} />
        <Row label="Situação" value={record.statusLabel} />
        <Row label="Última movimentação" value={record.lastMovementLabel} />
        {record.archivedAtLabel ? (
          <Row label="Arquivado em" value={record.archivedAtLabel} />
        ) : null}
      </dl>

      {grant ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--gold)]/40 px-2 py-1 text-[10px] text-[color:var(--gold)]">
          <Clock className="h-3 w-3" />
          Cópia da Gestora expira em {formatGrantRemaining(grant.expiresAt)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {portalTab ? (
          <>
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-3 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Conversa
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Abrir backup
            </button>
          </>
        ) : (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-3 py-1.5 text-[11px] transition hover:border-[color:var(--gold)]"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Abrir backup
        </button>
        )}
        {isAdmin && !portalTab ? (
          <button
            type="button"
            onClick={() => {
              if (grant) revokeBackupGrant(record.investorId);
              else grantBackupToSupervisor(record.investorId, adminId);
              onShareChanged();
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
          >
            {grant ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Encerrar liberação
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" /> Liberar à Gestora (24h)
              </>
            )}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[color:var(--muted-foreground)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function ReasonDialog({
  record,
  onCancel,
  onConfirm,
}: {
  record: CrmBackupRecord;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string>("");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Motivo da abertura"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6"
      >
        <h2 className="font-display text-lg">Motivo da abertura</h2>
        <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
          O backup de <strong>{record.name}</strong> só pode ser aberto com um
          motivo declarado. Usuário, data, hora e motivo ficam registrados
          permanentemente.
        </p>
        <div className="mt-4 space-y-2">
          {BACKUP_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={[
                "w-full cursor-pointer rounded-xl border px-3 py-2 text-left text-xs transition",
                reason === r
                  ? "border-[color:var(--gold)] bg-[color:var(--accent)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--gold)]/50",
              ].join(" ")}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-full border border-[color:var(--border)] px-4 py-2 text-xs transition hover:text-[color:var(--foreground)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!reason}
            onClick={() => onConfirm(reason)}
            className="cursor-pointer rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-4 py-2 text-xs transition hover:border-[color:var(--gold)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar e abrir
          </button>
        </div>
      </div>
    </div>
  );
}

const TABS = ["Geral", "Jornada", "Linha do Tempo", "Reuniões", "Notas do Executivo"] as const;

function BackupReader({
  record,
  onClose,
}: {
  record: CrmBackupRecord;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Geral");
  const detail = useMemo(() => getBackupDetail(record), [record]);
  const accessLog = useMemo(() => listBackupAccessLog(record.investorId), [record]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Backup de ${record.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-4">
          <div>
            <h2 className="font-display text-lg">{record.name}</h2>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-[color:var(--muted-foreground)]">
              <Lock className="h-3 w-3" /> Backup somente leitura ·{" "}
              {record.executiveName} · {record.workspaceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer rounded-lg p-1.5 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-[color:var(--border)] px-6 pt-3">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "cursor-pointer rounded-t-lg px-3 py-2 text-xs transition",
                tab === t
                  ? "border-b-2 border-[color:var(--gold)] text-[color:var(--foreground)]"
                  : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm">
          {tab === "Geral" ? (
            <dl className="space-y-2 text-xs">
              <Row label="Nome" value={record.name} />
              <Row label="Executivo" value={record.executiveName} />
              <Row label="Workspace" value={record.workspaceLabel} />
              <Row label="Origem" value={record.originLabel} />
              <Row label="Status" value={record.stateLabel} />
              <Row label="Situação" value={record.statusLabel} />
              <Row label="Cidade" value={record.city || "—"} />
              <Row label="WhatsApp" value={record.phone || "—"} />
              <Row label="E-mail" value={record.email || "—"} />
              <Row label="Última movimentação" value={record.lastMovementLabel} />
              <div className="pt-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  Aberturas registradas
                </p>
                <ul className="mt-2 space-y-1.5">
                  {accessLog.map((a) => (
                    <li key={a.id} className="text-[11px] text-[color:var(--muted-foreground)]">
                      {formatCrmTimestamp(a.at)} · {a.userName} · {a.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </dl>
          ) : tab === "Jornada" ? (
            detail.journey ? (
              <dl className="space-y-2 text-xs">
                <Row label="Etapa" value={detail.journey.stageLabel} />
                <Row label="Módulo atual" value={detail.journey.currentModuleLabel} />
                <Row label="Progresso" value={`${detail.journey.percent}%`} />
                <Row label="Sessões" value={String(detail.journey.sessions)} />
                <Row label="Retornos" value={String(detail.journey.returns)} />
                <Row
                  label="Tempo efetivo"
                  value={`${detail.journey.effectiveMinutes} min`}
                />
                <p className="pt-3 leading-relaxed text-[color:var(--muted-foreground)]">
                  {detail.journey.autoSummary}
                </p>
              </dl>
            ) : (
              <Empty text="Nenhum registro de jornada para este relacionamento." />
            )
          ) : tab === "Linha do Tempo" ? (
            detail.timeline.length > 0 ? (
              <ul className="space-y-3">
                {detail.timeline.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-xl border border-[color:var(--border)] px-3 py-2.5"
                  >
                    <p className="text-xs">{CRM_TIMELINE_LABEL[e.event]}</p>
                    <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                      {formatCrmTimestamp(e.at)} · {e.origin} · {e.reason}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Nenhum evento registrado." />
            )
          ) : tab === "Reuniões" ? (
            detail.meetings.length > 0 ? (
              <ul className="space-y-3">
                {detail.meetings.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-[color:var(--border)] px-3 py-2.5"
                  >
                    <p className="text-xs">
                      {new Date(m.scheduledAt).toLocaleString("pt-BR")} · {m.status}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                      {m.executiveName}
                      {m.topic ? ` · ${m.topic}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Nenhuma reunião registrada." />
            )
          ) : detail.notes.length > 0 ? (
            <ul className="space-y-3">
              {detail.notes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-xl border border-[color:var(--border)] px-3 py-2.5"
                >
                  <p className="text-xs leading-relaxed">{n.body}</p>
                  <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                    {formatCrmTimestamp(n.createdAt)} · {n.authorName}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nenhuma nota registrada pelo Executivo." />
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[color:var(--border)] px-4 py-8 text-center text-xs text-[color:var(--muted-foreground)]">
      {text}
    </p>
  );
}
