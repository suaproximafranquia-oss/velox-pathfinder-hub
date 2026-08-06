import { useEffect, useState } from "react";
import { Pencil, Save, X, User } from "lucide-react";
import { CrmRecordSection, CrmRecordRow, CrmCopyRow } from "@/components/crm/crm-conversation";
import { readLeadFicha, saveLeadFicha, type LeadFicha } from "@/lib/workspace-lead-edit";

/**
 * Dados gerais da Ficha do Investidor — editáveis na própria ficha.
 *
 * Nome, WhatsApp, E-mail e Cidade podem ser corrigidos a qualquer
 * momento sem sair do CRM. A gravação usa a base ÚNICA de Leads
 * (`saveLeadFicha`), propagando para Workspace, Timeline e Auditoria.
 */
export function CrmLeadFicha({
  investorId,
  name,
  phone,
  email,
  city,
  privateOk,
  actor,
  onSaved,
}: {
  investorId: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  privateOk: boolean;
  actor: { userId: string; name: string; role?: string };
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name, whatsapp: phone ?? "", email: email ?? "", city: city ?? "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setError(null);
    setDraft({ name, whatsapp: phone ?? "", email: email ?? "", city: city ?? "" });
  }, [investorId, name, phone, email, city]);

  function save() {
    const base: LeadFicha | null = readLeadFicha(investorId);
    if (!base) {
      setError("Este contato ainda não possui ficha na base de Leads.");
      return;
    }
    saveLeadFicha({
      investorId,
      ficha: {
        ...base,
        name: draft.name,
        whatsapp: draft.whatsapp,
        email: draft.email,
        city: draft.city,
      },
      actorId: actor.userId,
      actorName: actor.name,
      ...(actor.role ? { actorRole: actor.role } : {}),
    });
    setEditing(false);
    setError(null);
    onSaved();
  }

  return (
    <CrmRecordSection title="Dados gerais" tone="azul" icon={User}>
      {editing ? (
        <div className="space-y-2">
          {(
            [
              ["name", "Nome"],
              ["whatsapp", "WhatsApp"],
              ["email", "E-mail"],
              ["city", "Cidade"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3">
              <span className="shrink-0 text-xs text-[color:var(--crm-muted)]">{label}</span>
              <input
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-2 py-1 text-xs outline-none focus:border-[color:var(--crm-accent)]"
              />
            </label>
          ))}
          {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:opacity-90"
            >
              <Save className="h-3.5 w-3.5" /> Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
                setDraft({ name, whatsapp: phone ?? "", email: email ?? "", city: city ?? "" });
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--crm-muted)] transition hover:text-[color:var(--crm-accent)]"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <CrmRecordRow label="Nome" value={name} />
          <CrmCopyRow label="WhatsApp" value={privateOk ? phone : undefined} />
          <CrmRecordRow label="E-mail" value={privateOk ? email : undefined} />
          <CrmRecordRow label="Cidade" value={privateOk ? city : undefined} />
          {privateOk ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-[1px] hover:border-[color:var(--crm-accent)] hover:text-[color:var(--crm-accent)] active:translate-y-0"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          ) : null}
        </>
      )}
    </CrmRecordSection>
  );
}
