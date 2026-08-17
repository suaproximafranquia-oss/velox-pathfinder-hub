/**
 * Central de Templates — cadastro administrativo dos templates que já
 * existem e foram aprovados na Meta. O Portal não cria, não submete e
 * não aprova nada: apenas lê as capturas de tela e organiza.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutList,
  Loader2,
  Plus,
  Trash2,
  ClipboardPaste,
  ArrowLeft,
  ScanLine,
  AlertTriangle,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ensureCloudSession, getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  interpretMetaTemplateCaptures,
  listMetaTemplates,
  saveMetaTemplate,
  deleteMetaTemplate,
} from "@/lib/crm/meta-templates.functions";
import {
  TEMPLATE_PURPOSES,
  purposeLabel,
  display,
  PURPOSE_ORDER,
  isOperationalPurpose,
  type MetaTemplateReading,
  type MetaTemplateRecord,
  type MetaTemplatePurpose,
} from "@/lib/crm/meta-templates";
import { CRM_TEMPLATES } from "@/lib/crm/templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/executivo/templates")({
  head: () => ({
    meta: [
      { title: "Central de Templates — Atlas Platform" },
      {
        name: "description",
        content:
          "Cadastro dos templates aprovados na Meta por captura de tela, com finalidade comercial vinculada ao CRM.",
      },
      { property: "og:title", content: "Central de Templates — Atlas Platform" },
      {
        property: "og:description",
        content: "Importe templates da Meta por Ctrl + V e organize-os para o CRM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TemplatesPage,
});

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5";
const gold =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] bg-[color:var(--gold)]/10 px-4 py-2 text-xs text-[color:var(--gold)] hover:bg-[color:var(--gold)] hover:text-[color:var(--gold-foreground)] transition disabled:opacity-40";
const ghost =
  "inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/40 transition disabled:opacity-40";
const fieldCls =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/50";

type View = "lista" | "importar" | "conferencia" | "detalhe";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function TemplatesPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [view, setView] = useState<View>("lista");
  const [items, setItems] = useState<MetaTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [captureOne, setCaptureOne] = useState<string | null>(null);
  const [captureTwo, setCaptureTwo] = useState<string | null>(null);
  const [slot, setSlot] = useState<1 | 2>(1);
  const [reading, setReading] = useState<MetaTemplateReading | null>(null);
  const [purpose, setPurpose] = useState<MetaTemplatePurpose>("outro");
  const [duplicate, setDuplicate] = useState<MetaTemplateRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<MetaTemplateRecord | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
  }, [navigate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await ensureCloudSession();
      setItems(await listMetaTemplates());
    } catch {
      setStatus("Não foi possível carregar a Central de Templates agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  const receiveImage = useCallback(
    (dataUrl: string) => {
      if (slot === 1 || !captureOne) {
        setCaptureOne(dataUrl);
        setSlot(2);
      } else {
        setCaptureTwo(dataUrl);
      }
    },
    [slot, captureOne],
  );

  useEffect(() => {
    if (view !== "importar") return;
    const onPaste = async (event: Event) => {
      const clipboard = (event as ClipboardEvent).clipboardData;
      for (const item of Array.from(clipboard?.items ?? [])) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            receiveImage(await readFile(file));
          }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [view, receiveImage]);

  const resetImport = () => {
    setCaptureOne(null);
    setCaptureTwo(null);
    setSlot(1);
    setReading(null);
    setPurpose("outro");
    setDuplicate(null);
  };

  const interpret = async () => {
    if (!captureOne) return;
    setBusy(true);
    setStatus(null);
    try {
      await ensureCloudSession();
      const result = await interpretMetaTemplateCaptures({
        data: { captureOne, captureTwo },
      });
      setReading(result);
      setView("conferencia");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao interpretar as capturas.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (overwrite = false) => {
    if (!reading?.name) {
      setStatus("Nome do template não identificado. Revise antes de salvar.");
      return;
    }
    setBusy(true);
    try {
      await ensureCloudSession();
      const res = await saveMetaTemplate({
        data: {
          name: reading.name,
          metaId: reading.metaId,
          language: reading.language,
          category: reading.category,
          status: reading.status,
          metaUpdatedAt: reading.metaUpdatedAt,
          header: reading.header,
          body: reading.body,
          footer: reading.footer,
          variables: reading.variables,
          buttons: reading.buttons,
          purpose,
          createdByName: session?.name ?? "",
          overwrite,
        },
      });
      if (!res.ok) {
        setDuplicate(res.existing);
        return;
      }
      resetImport();
      setView("lista");
      setStatus(
        "Template cadastrado na Central de Templates e disponível no CRM de Relacionamento (nenhuma mensagem foi enviada).",
      );
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao salvar o template.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await ensureCloudSession();
      await deleteMetaTemplate({ data: { id } });
      setView("lista");
      setDetail(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="Central de Templates">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
            <LayoutList className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-xl">Central de Templates</h1>
            <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
              A Meta continua sendo a autoridade do template. Aqui apenas registramos,
              organizamos e damos finalidade comercial aos modelos já aprovados lá.
            </p>
          </div>
        </div>
        {view === "lista" ? (
          <button
            type="button"
            className={gold}
            onClick={() => {
              resetImport();
              setStatus(null);
              setView("importar");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Template
          </button>
        ) : (
          <button
            type="button"
            className={ghost}
            onClick={() => {
              setView("lista");
              setDetail(null);
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para a lista
          </button>
        )}
      </div>

      {status ? (
        <p className="mb-4 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 px-4 py-2 text-xs text-[color:var(--gold)]">
          {status}
        </p>
      ) : null}

      {view === "lista" ? (
        <section className={cn(card, "mb-4")}>
          <h2 className="font-display text-base">Estrutura operacional</h2>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            Apenas quatro templates ficam disponíveis para uso manual do Executivo: o
            primeiro contato e as três aberturas de conversa. As etapas de relacionamento
            (E1, E3, E4, E12, R1, R2, R3, V3, V4) pertencem ao motor e não aparecem aqui.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[color:var(--muted-foreground)]">
                <tr>
                  <th className="py-2 pr-4 font-normal">Nome</th>
                  <th className="py-2 pr-4 font-normal">Finalidade</th>
                  <th className="py-2 pr-4 font-normal">Status</th>
                  <th className="py-2 pr-4 font-normal">Versão</th>
                  <th className="py-2 pr-4 font-normal">ID Meta</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {CRM_TEMPLATES.map((t) => {
                  const record = items.find((i) => i.purpose === t.metaPurpose) ?? null;
                  return (
                    <tr key={t.id} className="border-t border-[color:var(--border)]/60 align-top">
                      <td className="py-2 pr-4">{t.label}</td>
                      <td className="py-2 pr-4 text-[color:var(--muted-foreground)]">
                        {t.purpose}
                      </td>
                      <td className="py-2 pr-4">
                        {record ? display(record.status) : "Não cadastrado na Meta"}
                      </td>
                      <td className="py-2 pr-4">{record ? "1" : "—"}</td>
                      <td className="py-2 pr-4 font-mono text-[11px]">
                        {record ? display(record.metaId) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className={ghost}
                          disabled={!record}
                          onClick={() => {
                            if (!record) return;
                            setDetail(record);
                            setView("detalhe");
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === "lista" ? (
        <section className={card}>
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando templates…
            </p>
          ) : items.length === 0 ? (
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Nenhum template cadastrado. Use “Novo Template” e cole as capturas da Meta.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[color:var(--muted-foreground)]">
                  <tr>
                    <th className="py-2 pr-4 font-normal">Finalidade</th>
                    <th className="py-2 pr-4 font-normal">Template Meta</th>
                    <th className="py-2 pr-4 font-normal">Idioma</th>
                    <th className="py-2 pr-4 font-normal">Categoria</th>
                    <th className="py-2 pr-4 font-normal">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...items]
                    .sort(
                      (a, b) =>
                        (PURPOSE_ORDER[a.purpose] ?? 99) - (PURPOSE_ORDER[b.purpose] ?? 99),
                    )
                    .map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-[color:var(--border)]/60 hover:bg-[color:var(--accent)]/40"
                    >
                      <td className="py-2 pr-4">
                        {purposeLabel(t.purpose)}
                        {isOperationalPurpose(t.purpose) ? null : (
                          <span className="ml-1 text-[10px] text-[color:var(--muted-foreground)]">
                            (fora de operação)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-[11px]">{display(t.name)}</td>
                      <td className="py-2 pr-4">{display(t.language)}</td>
                      <td className="py-2 pr-4">{display(t.category)}</td>
                      <td className="py-2 pr-4">{display(t.status)}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className={ghost}
                          onClick={() => {
                            setDetail(t);
                            setView("detalhe");
                          }}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {view === "importar" ? (
        <section className={cn(card, "space-y-5")}>
          <div>
            <h2 className="font-display text-base">Importar template da Meta</h2>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              Para cadastrar um template já criado na Meta, copie as telas de informações do
              modelo e cole aqui usando <strong>Ctrl + V</strong>.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                [1, "Captura 1 — Informações do modelo", "Cole aqui a tela de informações/Insights do modelo", captureOne],
                [2, "Captura 2 — Edição do modelo", "Cole aqui a tela de edição do modelo", captureTwo],
              ] as [1 | 2, string, string, string | null][]
            ).map(([index, title, hint, image]) => (
              <button
                key={index}
                type="button"
                onClick={() => setSlot(index)}
                className={cn(
                  "flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-center transition",
                  slot === index
                    ? "border-[color:var(--gold)] bg-[color:var(--gold)]/5"
                    : "border-[color:var(--border)] hover:border-[color:var(--gold)]/40",
                )}
              >
                {image ? (
                  <>
                    <img
                      src={image}
                      alt={title}
                      className="max-h-56 w-full rounded-lg border border-[color:var(--border)] object-contain"
                    />
                    <span className="text-[11px] text-[color:var(--muted-foreground)]">
                      {title} — clique e cole novamente para substituir
                    </span>
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="h-5 w-5 text-[color:var(--gold)]" />
                    <span className="text-sm">{title}</span>
                    <span className="text-[11px] text-[color:var(--muted-foreground)]">{hint}</span>
                  </>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={gold} disabled={!captureOne || busy} onClick={interpret}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
              Interpretar template
            </button>
            <button type="button" className={ghost} onClick={resetImport} disabled={busy}>
              Limpar capturas
            </button>
          </div>
        </section>
      ) : null}

      {view === "conferencia" && reading ? (
        <section className={cn(card, "space-y-5")}>
          <h2 className="font-display text-base">Template identificado</h2>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Nada foi salvo ainda. O que não estiver visível nas capturas aparece como
            “Não identificado” — nenhuma informação é inventada.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                ["Nome Meta", reading.name],
                ["ID Meta", reading.metaId],
                ["Categoria", reading.category],
                ["Idioma", reading.language],
                ["Status", reading.status],
                ["Última atualização", reading.metaUpdatedAt],
              ] as [string, string | null][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[color:var(--border)] p-3">
                <p className="text-[10px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
                  {label}
                </p>
                <p className="mt-1 break-words text-xs">{display(value)}</p>
              </div>
            ))}
          </div>

          <TemplateContent reading={reading} />

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
              Finalidade operacional
            </p>
            <select
              className={fieldCls}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as MetaTemplatePurpose)}
            >
              {TEMPLATE_PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {duplicate ? (
            <div className="rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5 p-4 text-xs">
              <p className="flex items-center gap-2 text-[color:var(--gold)]">
                <AlertTriangle className="h-3.5 w-3.5" /> Este template já está cadastrado.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={ghost}
                  onClick={() => {
                    setDetail(duplicate);
                    setView("detalhe");
                  }}
                >
                  Visualizar existente
                </button>
                <button
                  type="button"
                  className={gold}
                  disabled={busy}
                  onClick={() => void confirm(true)}
                >
                  Atualizar informações
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={ghost}
              disabled={busy}
              onClick={() => setView("importar")}
            >
              Cancelar
            </button>
            <button type="button" className={gold} disabled={busy} onClick={() => void confirm(false)}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirmar cadastro
            </button>
          </div>
        </section>
      ) : null}

      {view === "detalhe" && detail ? (
        <section className={cn(card, "space-y-5")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base">{display(detail.name)}</h2>
              <p className="mt-1 text-[11px] text-[color:var(--muted-foreground)]">
                Finalidade: {purposeLabel(detail.purpose)} · ID Meta: {display(detail.metaId)} ·{" "}
                {display(detail.language)} · {display(detail.category)} · {display(detail.status)}
              </p>
            </div>
            <button
              type="button"
              className={ghost}
              disabled={busy}
              onClick={() => void remove(detail.id)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover cadastro
            </button>
          </div>
          <TemplateContent reading={detail} />
        </section>
      ) : null}
    </ExecutiveShell>
  );
}

function TemplateContent({ reading }: { reading: MetaTemplateReading }) {
  return (
    <div className="space-y-4">
      {reading.header ? (
        <Block title="Cabeçalho">
          <p className="text-xs">{reading.header}</p>
        </Block>
      ) : null}

      <Block title="Corpo">
        <p className="whitespace-pre-wrap text-xs">{display(reading.body)}</p>
      </Block>

      <Block title="Variáveis">
        {reading.variables.length === 0 ? (
          <p className="text-xs text-[color:var(--muted-foreground)]">Não identificado</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[color:var(--muted-foreground)]">
              <tr>
                <th className="py-1 pr-4 font-normal">Variável</th>
                <th className="py-1 font-normal">Exemplo</th>
              </tr>
            </thead>
            <tbody>
              {reading.variables.map((v) => (
                <tr key={v.name} className="border-t border-[color:var(--border)]/60">
                  <td className="py-1 pr-4 font-mono text-[11px]">{v.name}</td>
                  <td className="py-1">{display(v.sample)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <Block title="Rodapé">
        <p className="text-xs">{display(reading.footer)}</p>
      </Block>

      <Block title="Botões">
        {reading.buttons.length === 0 ? (
          <p className="text-xs text-[color:var(--muted-foreground)]">Não identificado</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {reading.buttons.map((b, index) => (
              <li key={index} className="rounded-lg border border-[color:var(--border)] p-2">
                <p>Texto: {display(b.text)}</p>
                <p>Ação: {display(b.type)}</p>
                <p>Tipo de URL: {display(b.urlType)}</p>
                <p className="break-all">URL: {display(b.url)}</p>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] p-3">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {title}
      </p>
      {children}
    </div>
  );
}