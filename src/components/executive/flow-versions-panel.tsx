/**
 * BLOCO 4 — ADMINISTRAÇÃO DE FLUXOS.
 *
 * Aqui se define QUAIS etapas participam de um fluxo, em que ORDEM e com
 * que PRAZO. A Biblioteca continua dona do conteúdo. Uma versão
 * publicada é imutável: para mudar, cria-se uma nova versão.
 *
 * Nada nesta tela envia mensagem nem altera ciclo em andamento.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GitBranch, Plus, Save, Send, Trash2 } from "lucide-react";
import {
  criarRascunhoFluxo,
  detalharVersaoFluxo,
  etapasDisponiveis,
  listarFluxos,
  publicarVersaoFluxo,
  salvarRascunhoFluxo,
} from "@/lib/relationship/flows.functions";

type VersionRow = {
  id: string;
  flowKey: string;
  version: number;
  status: "rascunho" | "publicada" | "arquivada";
  publishedAt: string | null;
};

type DraftStep = { stepKey: string; businessDaysAfterReference: number; active: boolean };

export function FlowVersionsPanel() {
  const fetchFlows = useServerFn(listarFluxos);
  const fetchDetail = useServerFn(detalharVersaoFluxo);
  const fetchSteps = useServerFn(etapasDisponiveis);
  const createDraft = useServerFn(criarRascunhoFluxo);
  const saveDraft = useServerFn(salvarRascunhoFluxo);
  const publish = useServerFn(publicarVersaoFluxo);

  const [flows, setFlows] = useState<Array<{ flowKey: string; versions: VersionRow[] }>>([]);
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<VersionRow | null>(null);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [library, setLibrary] = useState<Array<{ stepKey: string; title: string | null }>>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isDraft = selectedVersion?.status === "rascunho";

  async function reload(flowKey?: string | null) {
    const list = (await fetchFlows()) as Array<{ flowKey: string; versions: VersionRow[] }>;
    setFlows(list);
    const flow = flowKey ?? activeFlow ?? list[0]?.flowKey ?? null;
    setActiveFlow(flow);
    const versions = list.find((f) => f.flowKey === flow)?.versions ?? [];
    const preferred = versions.find((v) => v.status === "rascunho") ?? versions[0] ?? null;
    setSelectedVersion(preferred);
    if (preferred) await openVersion(preferred);
    else setSteps([]);
  }

  async function openVersion(version: VersionRow) {
    setSelectedVersion(version);
    const detail = (await fetchDetail({ data: { versionId: version.id } })) as any;
    setSteps(
      (detail?.steps ?? []).map((s: any) => ({
        stepKey: s.stepKey,
        businessDaysAfterReference: s.businessDaysAfterReference,
        active: s.active,
      })),
    );
  }

  useEffect(() => {
    void (async () => {
      await reload();
      setLibrary((await fetchSteps()) as Array<{ stepKey: string; title: string | null }>);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unused = useMemo(
    () => library.filter((m) => !steps.some((s) => s.stepKey === m.stepKey)),
    [library, steps],
  );

  function move(from: number, to: number) {
    if (from === to) return;
    setSteps((prev) => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function handleNewDraft() {
    if (!activeFlow) return;
    setBusy(true);
    try {
      const draft = (await createDraft({
        data: { flow: activeFlow, copyFromVersionId: selectedVersion?.id ?? null },
      })) as any;
      toast.success(`Rascunho v${draft.version} pronto para edição.`);
      await reload(activeFlow);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!selectedVersion) return;
    setBusy(true);
    try {
      await saveDraft({ data: { versionId: selectedVersion.id, steps } });
      toast.success("Rascunho salvo.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!selectedVersion) return;
    setBusy(true);
    try {
      await saveDraft({ data: { versionId: selectedVersion.id, steps } });
      await publish({ data: { versionId: selectedVersion.id } });
      toast.success("Versão publicada. Vale apenas para novos ciclos.");
      await reload(activeFlow);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const versions = flows.find((f) => f.flowKey === activeFlow)?.versions ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {flows.map((flow) => (
          <button
            key={flow.flowKey}
            type="button"
            onClick={() => void reload(flow.flowKey)}
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              activeFlow === flow.flowKey
                ? "border-[color:var(--gold)] text-[color:var(--gold)]"
                : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
            }`}
          >
            {flow.flowKey}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
            Versões
          </p>
          {versions.length === 0 ? (
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Nenhuma versão configurada. Os ciclos seguem a configuração atual do motor.
            </p>
          ) : null}
          {versions.map((version) => (
            <button
              key={version.id}
              type="button"
              onClick={() => void openVersion(version)}
              className={`w-full rounded-md border px-3 py-2 text-left text-[12px] ${
                selectedVersion?.id === version.id
                  ? "border-[color:var(--gold)]"
                  : "border-[color:var(--border)]"
              }`}
            >
              <span className="font-medium">v{version.version}</span>{" "}
              <span className="text-[10px] uppercase text-[color:var(--muted-foreground)]">
                {version.status}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={busy || !activeFlow}
            onClick={() => void handleNewDraft()}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[color:var(--border)] px-3 py-2 text-[11px]"
          >
            <Plus className="h-3 w-3" /> Nova versão (rascunho)
          </button>
        </aside>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[color:var(--gold)]" />
            <p className="text-[12px] text-[color:var(--muted-foreground)]">
              {isDraft
                ? "Rascunho editável. Arraste para reordenar e defina o prazo em dias úteis."
                : "Versão publicada ou arquivada: somente leitura. Crie uma nova versão para alterar."}
            </p>
          </div>

          <ul className="space-y-2">
            {steps.map((step, index) => (
              <li
                key={step.stepKey}
                draggable={isDraft}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                className="flex items-center gap-3 rounded-md border border-[color:var(--border)] px-3 py-2"
              >
                <span className="w-6 text-[11px] text-[color:var(--muted-foreground)]">
                  {index + 1}
                </span>
                <span className="flex-1 text-[13px] font-medium">{step.stepKey}</span>
                <label className="flex items-center gap-1 text-[11px] text-[color:var(--muted-foreground)]">
                  dias úteis
                  <input
                    type="number"
                    min={0}
                    disabled={!isDraft}
                    value={step.businessDaysAfterReference}
                    onChange={(event) =>
                      setSteps((prev) =>
                        prev.map((s, i) =>
                          i === index
                            ? { ...s, businessDaysAfterReference: Number(event.target.value) }
                            : s,
                        ),
                      )
                    }
                    className="w-16 rounded border border-[color:var(--border)] bg-transparent px-2 py-1 text-[12px]"
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-[color:var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={step.active}
                    onChange={(event) =>
                      setSteps((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, active: event.target.checked } : s,
                        ),
                      )
                    }
                  />
                  ativa
                </label>
                {isDraft ? (
                  <button
                    type="button"
                    aria-label={`Remover ${step.stepKey}`}
                    onClick={() => setSteps((prev) => prev.filter((_, i) => i !== index))}
                    className="text-[color:var(--muted-foreground)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {isDraft ? (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
                Etapas da Biblioteca fora deste fluxo
              </p>
              <div className="flex flex-wrap gap-2">
                {unused.map((message) => (
                  <button
                    key={message.stepKey}
                    type="button"
                    onClick={() =>
                      setSteps((prev) => [
                        ...prev,
                        { stepKey: message.stepKey, businessDaysAfterReference: 0, active: true },
                      ])
                    }
                    className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px]"
                  >
                    + {message.stepKey}
                  </button>
                ))}
                {unused.length === 0 ? (
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">
                    Todas as etapas da Biblioteca já participam deste fluxo.
                  </span>
                ) : null}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSave()}
                  className="flex items-center gap-1 rounded-md border border-[color:var(--border)] px-3 py-2 text-[12px]"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar rascunho
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handlePublish()}
                  className="flex items-center gap-1 rounded-md bg-[color:var(--gold)] px-3 py-2 text-[12px] text-[color:var(--background)]"
                >
                  <Send className="h-3.5 w-3.5" /> Publicar versão
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
