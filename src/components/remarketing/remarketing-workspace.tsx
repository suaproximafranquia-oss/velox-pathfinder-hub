/**
 * CRM operacional de Remarketing — ambiente isolado.
 *
 * Fluxo: colar lista → normalizar → escolher Template oficial → criar
 * campanha → executar/pausar/cancelar. A execução acontece no servidor;
 * esta tela apenas acompanha. Nenhum dado do CRM de Relacionamento é
 * lido ou alterado aqui.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ListChecks, Pause, Play, Send, Trash2, X } from "lucide-react";
import { parsePhoneList, formatPhone } from "@/lib/remarketing/phone";
import {
  CAMPAIGN_STATUS_LABEL,
  CONTACT_STATUS_LABEL,
  canCancel,
  canPause,
  canStart,
  type RemarketingCampaign,
  type RemarketingContact,
} from "@/lib/remarketing/types";
import {
  createRemarketingCampaign,
  deleteRemarketingCampaign,
  listRemarketingCampaigns,
  listRemarketingContacts,
  updateRemarketingCampaignStatus,
} from "@/lib/remarketing.functions";
import { listCrmRelationshipTemplates } from "@/lib/crm/meta-templates.functions";
import type { CrmMetaTemplateOption } from "@/lib/crm/meta-templates";

const card =
  "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";
const ghost =
  "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] transition hover:border-[color:var(--gold)]/40 hover:text-[color:var(--foreground)] disabled:opacity-40";
const primary =
  "inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-4 py-2 text-xs font-medium text-[color:var(--navy-deep,#0b1220)] transition hover:opacity-90 disabled:opacity-40";
const field =
  "mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--gold)]/50";

export function RemarketingWorkspace({ operatorName }: { operatorName: string }) {
  const [campaigns, setCampaigns] = useState<RemarketingCampaign[]>([]);
  const [templates, setTemplates] = useState<CrmMetaTemplateOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [rawList, setRawList] = useState("");
  const [openContactsOf, setOpenContactsOf] = useState<string | null>(null);
  const [contacts, setContacts] = useState<RemarketingContact[]>([]);

  const parsed = useMemo(() => parsePhoneList(rawList), [rawList]);
  const template = templates.find((t) => t.id === templateId) ?? null;

  const refresh = useCallback(async () => {
    setCampaigns(await listRemarketingCampaigns());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [list, tpl] = await Promise.all([
          listRemarketingCampaigns(),
          listCrmRelationshipTemplates(),
        ]);
        setCampaigns(list);
        setTemplates(tpl as CrmMetaTemplateOption[]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Falha ao carregar.");
      }
    })();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void refresh().catch(() => undefined), 20_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const run = useCallback(
    async (action: () => Promise<void>, success: string) => {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        setMessage(success);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Operação não concluída.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return (
    <div className="space-y-6">
      {message && (
        <p className="rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 px-4 py-2 text-xs text-[color:var(--foreground)]">
          {message}
        </p>
      )}

      <section className={card}>
        <h2 className="font-display text-lg">Nova campanha</h2>
        <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
          Cole a lista de números em qualquer formato. O sistema normaliza,
          descarta inválidos e remove duplicados antes de criar a campanha.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs text-[color:var(--muted-foreground)]">
            Nome da campanha
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Reativação base setembro"
              className={field}
            />
          </label>
          <label className="text-xs text-[color:var(--muted-foreground)]">
            Template oficial
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={field}
              style={{ colorScheme: "dark" }}
            >
              <option value="" style={{ backgroundColor: "#0b1220", color: "#e5e7eb" }}>
                Selecionar template…
              </option>
              {templates.map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                  style={{ backgroundColor: "#0b1220", color: "#e5e7eb" }}
                >
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {template && (
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 p-3 text-xs text-[color:var(--muted-foreground)]">
            {template.body || "Template sem corpo cadastrado."}
          </pre>
        )}

        <label className="mt-4 block text-xs text-[color:var(--muted-foreground)]">
          Lista de números
          <textarea
            value={rawList}
            onChange={(e) => setRawList(e.target.value)}
            rows={7}
            placeholder={"(17) 99772-7337\n5517998887766\n11 3222-1000"}
            className={field + " font-mono"}
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[color:var(--muted-foreground)]">
          <span>Válidos: <strong className="text-[color:var(--foreground)]">{parsed.valid.length}</strong></span>
          <span>Duplicados: {parsed.duplicates.length}</span>
          <span>Inválidos: {parsed.invalid.length}</span>
        </div>

        {parsed.invalid.length > 0 && (
          <p className="mt-2 text-[11px] text-[color:var(--muted-foreground)]">
            Descartados: {parsed.invalid.slice(0, 8).map((i) => i.raw).join(", ")}
            {parsed.invalid.length > 8 ? "…" : ""}
          </p>
        )}

        <button
          type="button"
          className={primary + " mt-5"}
          disabled={busy || !name.trim() || !template || parsed.valid.length === 0}
          onClick={() =>
            void run(async () => {
              if (!template) return;
              await createRemarketingCampaign({
                data: {
                  name: name.trim(),
                  templateName: template.id,
                  templateLabel: template.label,
                  templateLanguage: template.language,
                  templateBody: template.body,
                  createdByName: operatorName,
                  contacts: parsed.valid,
                  invalidCount: parsed.invalid.length,
                  duplicateCount: parsed.duplicates.length,
                },
              });
              setName("");
              setRawList("");
              setTemplateId("");
              await refresh();
            }, "Campanha criada e pronta para execução.")
          }
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Criar campanha
        </button>
      </section>

      <section className={card}>
        <h2 className="font-display text-lg">Campanhas</h2>
        <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
          A execução roda no servidor, de 08:00 às 20:00, mesmo com esta aba fechada.
        </p>

        <div className="mt-4 space-y-3">
          {campaigns.length === 0 && (
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Nenhuma campanha criada até o momento.
            </p>
          )}
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[color:var(--border)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">{c.name}</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    {CAMPAIGN_STATUS_LABEL[c.status]} · {c.templateLabel || c.templateName} ·{" "}
                    {c.sentCount}/{c.validCount} enviados · {c.errorCount} erro(s) ·{" "}
                    {c.pendingCount} pendente(s)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy || !canStart(c.status)}
                    onClick={() =>
                      void run(async () => {
                        setCampaigns(
                          await updateRemarketingCampaignStatus({
                            data: { campaignId: c.id, status: "em_execucao" },
                          }),
                        );
                      }, "Campanha em execução.")
                    }
                  >
                    <Play className="h-3.5 w-3.5" /> Executar
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy || !canPause(c.status)}
                    onClick={() =>
                      void run(async () => {
                        setCampaigns(
                          await updateRemarketingCampaignStatus({
                            data: { campaignId: c.id, status: "pausada" },
                          }),
                        );
                      }, "Campanha pausada.")
                    }
                  >
                    <Pause className="h-3.5 w-3.5" /> Pausar
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy || !canCancel(c.status)}
                    onClick={() =>
                      void run(async () => {
                        if (!window.confirm(`Cancelar a campanha "${c.name}"? Os envios pendentes não serão feitos.`))
                          return;
                        setCampaigns(
                          await updateRemarketingCampaignStatus({
                            data: { campaignId: c.id, status: "cancelada" },
                          }),
                        );
                      }, "Campanha cancelada.")
                    }
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if (openContactsOf === c.id) {
                          setOpenContactsOf(null);
                          setContacts([]);
                          return;
                        }
                        setContacts(await listRemarketingContacts({ data: { campaignId: c.id } }));
                        setOpenContactsOf(c.id);
                      }, "")
                    }
                  >
                    <ListChecks className="h-3.5 w-3.5" /> Contatos
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    disabled={busy || c.status === "em_execucao"}
                    onClick={() =>
                      void run(async () => {
                        if (!window.confirm(`Excluir a campanha "${c.name}" e todos os seus contatos?`))
                          return;
                        setCampaigns(await deleteRemarketingCampaign({ data: { campaignId: c.id } }));
                      }, "Campanha excluída.")
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>

              {openContactsOf === c.id && (
                <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-[color:var(--border)]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-[color:var(--muted-foreground)]">
                      <tr>
                        <th className="px-3 py-2">Número</th>
                        <th className="px-3 py-2">Situação</th>
                        <th className="px-3 py-2">Detalhe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((ct) => (
                        <tr key={ct.id} className="border-t border-[color:var(--border)]">
                          <td className="px-3 py-1.5">{formatPhone(ct.phone)}</td>
                          <td className="px-3 py-1.5">{CONTACT_STATUS_LABEL[ct.status]}</td>
                          <td className="px-3 py-1.5 text-[color:var(--muted-foreground)]">
                            {ct.error ?? (ct.sentAt ? new Date(ct.sentAt).toLocaleString("pt-BR") : "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
