import { useState } from "react";
import { AlertTriangle, Clock3, Users } from "lucide-react";
import {
  CRM_INTAKE_LABEL,
  CRM_INTAKE_DOT,
  canDistribute,
  formatRemaining,
  remainingSyncMs,
  getDistributionConfig,
  setSyncWaitHours,
  type CrmIntakeLead,
} from "@/lib/crm/distribution";
import { formatCrmTimestamp } from "@/lib/crm/timeline";
import { CrmRecordRow } from "@/components/crm/crm-conversation";

export function CrmIntakeItem({
  lead,
  active,
  onSelect,
  now,
}: {
  lead: CrmIntakeLead;
  active: boolean;
  onSelect: () => void;
  now: number;
}) {
  const remaining = remainingSyncMs(lead, now);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={[
        "flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors",
        active ? "bg-[color:var(--crm-accent-soft)]" : "hover:bg-[color:var(--crm-hover)]",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{lead.name}</span>
        {lead.conflict ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
        ) : null}
      </span>
      <span className="truncate text-xs text-[color:var(--crm-muted)]">{lead.phone}</span>
      <span className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${CRM_INTAKE_DOT[lead.status]}`} aria-hidden />
        <span className="truncate text-[11px] text-[color:var(--crm-muted)]">
          {CRM_INTAKE_LABEL[lead.status]}
          {lead.status === "aguardando_sincronizacao"
            ? ` · restam ${formatRemaining(remaining)}`
            : ""}
        </span>
      </span>
    </button>
  );
}

export function CrmIntakeDetail({
  lead,
  now,
  executives,
  ownerName,
  canManage,
  onAssign,
  onChangeWait,
}: {
  lead: CrmIntakeLead;
  now: number;
  executives: { id: string; name: string }[];
  ownerName: string;
  canManage: boolean;
  onAssign: (executiveId: string) => void;
  onChangeWait: (hours: number) => void;
}) {
  const [target, setTarget] = useState("");
  const [hours, setHours] = useState(String(getDistributionConfig().syncWaitHours));
  const waiting = lead.status === "aguardando_sincronizacao";
  const remaining = remainingSyncMs(lead, now);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {lead.conflict ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-900">
            Este investidor já possui relacionamento ativo. Responsável: {ownerName}.
            A sincronização tardia do GreenSales foi registrada em{" "}
            {formatCrmTimestamp(lead.conflict.at)} e o responsável foi mantido.
            O acesso às informações privadas permanece bloqueado ao novo Executivo.
          </p>
        </div>
      ) : null}

      <section className="rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-4">
        <h3 className="text-sm font-medium">{lead.name}</h3>
        <div className="mt-2 space-y-1.5">
          <CrmRecordRow label="Telefone" value={lead.phone} />
          <CrmRecordRow label="E-mail" value={lead.email || "—"} />
          <CrmRecordRow label="Origem" value={lead.origin} />
          <CrmRecordRow label="Contato recebido" value={formatCrmTimestamp(lead.receivedAt)} />
          <CrmRecordRow label="Situação" value={CRM_INTAKE_LABEL[lead.status]} />
          <CrmRecordRow label="Responsável" value={lead.ownerId ? ownerName : "Ainda não atribuído"} />
        </div>
      </section>

      {waiting ? (
        <section className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p className="text-xs leading-relaxed text-sky-900">
            Sincronização em andamento — aguardando retorno do GreenSales.
            Tempo restante: {formatRemaining(remaining)}. O Lead não pode ser
            distribuído enquanto este período estiver ativo.
          </p>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] p-4">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-[color:var(--crm-muted)]" /> Distribuição
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={!canDistribute(lead)}
              className="min-w-48 rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none disabled:opacity-50"
            >
              <option value="">Selecione o Executivo</option>
              {executives.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!canDistribute(lead) || !target}
              onClick={() => target && onAssign(target)}
              className="rounded-lg bg-[color:var(--crm-accent)] px-3 py-2 text-sm text-white transition-opacity disabled:opacity-40"
            >
              Distribuir Lead
            </button>
          </div>
          {!canDistribute(lead) ? (
            <p className="mt-2 text-xs text-[color:var(--crm-muted)]">
              {waiting
                ? "Disponível para distribuição somente após o término da espera."
                : "Este Lead já possui responsável oficial."}
            </p>
          ) : null}

          <div className="mt-4 border-t border-[color:var(--crm-border)] pt-3">
            <label className="text-xs text-[color:var(--crm-muted)]">
              Janela de espera pela sincronização (horas)
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-24 rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => onChangeWait(Number(hours))}
                className="rounded-lg border border-[color:var(--crm-border)] px-3 py-2 text-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </section>
      ) : (
        <p className="text-xs text-[color:var(--crm-muted)]">
          A distribuição de novos Leads é realizada pelo Gestor.
        </p>
      )}
    </div>
  );
}
