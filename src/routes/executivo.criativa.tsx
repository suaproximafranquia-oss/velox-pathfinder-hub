import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wand2,
  Loader2,
  Download,
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  ImagePlus,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import {
  getSession,
  canManageCreativeTemplates,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { CREATIVE_MODEL_LABEL, type CreativeModel } from "@/lib/creative/brand";
import { downloadBase64, slugify } from "@/lib/creative/render";
import { recordCreative } from "@/lib/creative/history";
import { composeFromTemplate } from "@/lib/creative/compose";
import {
  getTemplate,
  uploadTemplate,
  getReference,
  uploadReference,
  type CreativeTemplate,
  type CreativeReference,
} from "@/lib/creative/template-store";
import { generateCreativeCopy, getCityPhoto } from "@/lib/creative.functions";
import { testTemplate, TEST_CITY, TEST_STATE } from "@/lib/creative/template-test";
import type { Diagnostic } from "@/lib/creative/calibration";

export const Route = createFileRoute("/executivo/criativa")({
  head: () => ({
    meta: [{ title: "IA Criativa — Atlas Platform" }, { name: "robots", content: "noindex" }],
  }),
  component: CriativaPage,
});

/** Somente cidade e UF variam: todo o restante é padrão oficial fixo. */
type FormState = { city: string; state: string };

const EMPTY: FormState = { city: "", state: "" };

const TEMPLATE_LABEL: Record<CreativeModel, string> = {
  institucional: "Template Institucional",
  marketing: "Template Marketing",
};

const MODEL_HINT: Record<CreativeModel, string> = {
  institucional:
    "Preenchimento do Template Oficial: fotografia da cidade, nome da cidade e UF. Nenhum outro elemento é alterado.",
  marketing:
    "Preenchimento do Template Marketing: fotografia da cidade, cidade, UF e os textos publicitários da IA. O layout do template é preservado.",
};

function unitName(form: FormState): string {
  return `Velox ${form.city}${form.state ? ` — ${form.state}` : ""}`.trim();
}

/**
 * Fotografias já utilizadas por cidade. Sempre que a mesma cidade é
 * solicitada novamente, tentamos uma imagem diferente da anterior.
 */
const PHOTO_HISTORY_KEY = "velox.creative.photos.v1";

function photoHistory(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(window.localStorage.getItem(PHOTO_HISTORY_KEY) || "{}");
    const list = (all as Record<string, unknown>)[key];
    return Array.isArray(list) ? (list as string[]) : [];
  } catch {
    return [];
  }
}

function rememberPhoto(key: string, credit: string | null) {
  if (typeof window === "undefined" || !credit) return;
  try {
    const all = JSON.parse(window.localStorage.getItem(PHOTO_HISTORY_KEY) || "{}") as Record<
      string,
      string[]
    >;
    const list = Array.isArray(all[key]) ? all[key]! : [];
    // Guarda as últimas 6: garante rotação sem esgotar as opções.
    all[key] = [credit, ...list.filter((c) => c !== credit)].slice(0, 6);
    window.localStorage.setItem(PHOTO_HISTORY_KEY, JSON.stringify(all));
  } catch {
    /* histórico é apenas conveniência */
  }
}

function CriativaPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arts, setArts] = useState<Partial<Record<CreativeModel, string>>>({});
  const [zoom, setZoom] = useState<{ model: CreativeModel; src: string; file: string } | null>(
    null,
  );
  const [templates, setTemplates] = useState<Partial<Record<CreativeModel, CreativeTemplate>>>({});
  const [references, setReferences] = useState<Partial<Record<CreativeModel, CreativeReference>>>(
    {},
  );
  const [uploading, setUploading] = useState<CreativeModel | null>(null);
  const [uploadingRef, setUploadingRef] = useState<CreativeModel | null>(null);
  /** Modo Manual: fotografia escolhida pelo usuário (opcional). */
  const [manualPhoto, setManualPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [testing, setTesting] = useState<CreativeModel | null>(null);
  const [report, setReport] = useState<Partial<Record<CreativeModel, Diagnostic[]>>>({});
  const canManageTemplates = session ? canManageCreativeTemplates(session.activeRole) : false;

  useEffect(() => {
    void (async () => {
      const [institucional, marketing] = await Promise.all([
        getTemplate("institucional"),
        getTemplate("marketing"),
      ]);
      setTemplates({
        ...(institucional ? { institucional } : {}),
        ...(marketing ? { marketing } : {}),
      });
      const refA = getReference("institucional");
      const refB = getReference("marketing");
      setReferences({ ...(refA ? { institucional: refA } : {}), ...(refB ? { marketing: refB } : {}) });
    })();
  }, []);

  /** Fotografia manual: upload, arrastar ou CTRL + V. */
  function readPhoto(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setManualPhoto({ name: file.name || "foto colada", dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            readPhoto(file);
          }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  /** Cada modelo possui o seu próprio template: um upload nunca afeta o outro. */
  async function sendTemplate(model: CreativeModel, file: File | undefined) {
    if (!file) return;
    setUploading(model);
    setError(null);
    try {
      const saved = await uploadTemplate(model, file, session?.userId);
      setTemplates((t) => ({ ...t, [model]: saved }));
    } catch (err) {
      const saved = await getTemplate(model);
      if (saved) setTemplates((t) => ({ ...t, [model]: saved }));
      setError(err instanceof Error ? err.message : "Falha ao enviar o template.");
    } finally {
      setUploading(null);
    }
  }

  /** Modelo Padronizado: referência visual, nunca usada como template. */
  async function sendReference(model: CreativeModel, file: File | undefined) {
    if (!file) return;
    setUploadingRef(model);
    setError(null);
    try {
      const saved = await uploadReference(model, file);
      setReferences((r) => ({ ...r, [model]: saved }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o modelo padronizado.");
    } finally {
      setUploadingRef(null);
    }
  }

  /** Prévia de validação: não gera arte definitiva nem grava histórico. */
  async function runTest(model: CreativeModel) {
    setTesting(model);
    setError(null);
    try {
      // Guia tracejado da área da fotografia: só existe na prévia.
      const result = await testTemplate(model, { guide: true });
      setReport((r) => ({ ...r, [model]: result.report }));
      setZoom({
        model,
        src: `data:image/png;base64,${result.preview}`,
        file: `teste-${model}-${slugify(`${TEST_CITY}-${TEST_STATE}`)}.png`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao testar o template.");
    } finally {
      setTesting(null);
    }
  }

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
  }, [navigate]);

  async function generate() {
    if (busy) return;
    const city = form.city.trim();
    const state = form.state.trim().toUpperCase();
    if (!city || state.length !== 2) {
      setError("Informe a cidade e a UF (duas letras) para gerar as artes.");
      return;
    }
    setBusy(true);
    setError(null);
    setArts({});
    try {
      const historyKey = `${city.toLocaleLowerCase("pt-BR")}-${state}`;
      // Modo Manual: a fotografia escolhida substitui a busca automática.
      let photoDataUrl = manualPhoto?.dataUrl ?? null;
      if (!photoDataUrl) {
        const photo = await getCityPhoto({
          data: { city, state, exclude: photoHistory(historyKey) },
        });
        if (!photo.dataUrl) {
          throw new Error(
            `Nenhuma fotografia adequada foi encontrada para ${city} - ${state}. Selecione uma fotografia manualmente ou verifique a grafia da cidade.`,
          );
        }
        rememberPhoto(historyKey, photo.credit);
        photoDataUrl = photo.dataUrl;
      }

      // MODELO A — preenchimento determinístico do Template Institucional.
      const institucional = await composeFromTemplate({
        model: "institucional",
        city,
        state,
        photoDataUrl,
      });

      // MODELO B — mesmo motor, sobre o Template Marketing. A IA produz
      // apenas os textos publicitários; o layout vem do template.
      let marketing: string | undefined;
      {
        try {
          const copy = await generateCreativeCopy({
            data: { city, state, unit: unitName({ city, state }) },
          });
          marketing = await composeFromTemplate({
            model: "marketing",
            city,
            state,
            photoDataUrl,
            copy: {
              headline: copy.marketing.headline,
              subheadline: copy.marketing.subheadline,
              supporting: copy.marketing.supporting,
            },
          });
        } catch {
          /* o Modelo A é entregue mesmo se o Modelo B falhar */
        }
      }

      setArts({ institucional, ...(marketing ? { marketing } : {}) });
      for (const model of marketing
        ? (["institucional", "marketing"] as CreativeModel[])
        : (["institucional"] as CreativeModel[])) {
        recordCreative({
          userId: session?.userId ?? "",
          category: "unidade",
          model,
          unit: unitName({ city, state }),
          city,
          state,
          fileName: `velox-${model}-${slugify(`${city}-${state}`)}.png`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar as artes agora.");
    } finally {
      setBusy(false);
    }
  }

  const fileFor = (model: CreativeModel) =>
    `velox-${model}-${slugify(`${form.city}-${form.state}`)}.png`;

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="IA Criativa">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Nova unidade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe a cidade e a UF. O restante da peça segue o padrão oficial.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cidade
              </span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Volta Redonda"
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                UF
              </span>
              <input
                value={form.state}
                maxLength={2}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                placeholder="RJ"
                className="h-11 w-24 rounded-lg border border-input bg-background px-3 text-sm uppercase text-foreground outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {busy ? "Gerando…" : "Gerar artes"}
            </button>
          </div>

          {/* Modo Manual — fotografia opcional (upload, arrastar ou CTRL + V). */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              readPhoto(e.dataTransfer.files?.[0]);
            }}
            className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4"
          >
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted">
              <ImagePlus className="h-4 w-4" />
              📷 Selecionar Foto da Cidade (Opcional)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  readPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {manualPhoto ? (
              <>
                <img
                  src={manualPhoto.dataUrl}
                  alt="Fotografia selecionada"
                  className="h-12 w-20 rounded-md border border-border object-cover"
                />
                <span className="text-xs text-foreground">{manualPhoto.name}</span>
                <button
                  type="button"
                  onClick={() => setManualPhoto(null)}
                  className="text-xs font-semibold text-muted-foreground underline underline-offset-2"
                >
                  Remover
                </button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Arraste uma imagem, cole com CTRL + V ou faça o upload. Sem seleção, a busca
                automática continua sendo utilizada.
              </span>
            )}
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {(["institucional", "marketing"] as CreativeModel[]).map((model) => {
            const tpl = templates[model];
            const diags = report[model];
            return (
              <div
                key={model}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
              >
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {CREATIVE_MODEL_LABEL[model]}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tpl
                      ? tpl.builtIn
                        ? "Utilizando o template oficial padrão."
                        : `Em uso: ${tpl.fileName}`
                      : "Nenhum template enviado."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {canManageTemplates ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted">
                      {uploading === model ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Enviar {TEMPLATE_LABEL[model]}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          void sendTemplate(model, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Somente Administrador e Gestora podem alterar templates.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void runTest(model)}
                    disabled={!tpl || testing === model}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {testing === model ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FlaskConical className="h-4 w-4" />
                    )}
                    Testar Template
                  </button>
                </div>
                <p className="text-xs">
                  <span className="text-muted-foreground">Status: </span>
                  {tpl ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Template carregado
                      {tpl.config ? ` · ${tpl.config.width}×${tpl.config.height} px` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Nenhum template</span>
                  )}
                </p>
                {tpl ? (
                  <img
                    src={tpl.dataUrl}
                    alt={TEMPLATE_LABEL[model]}
                    className="h-32 w-full rounded-lg border border-border object-contain"
                  />
                ) : null}
                {diags ? (
                  <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                    {diags.map((d, i) => (
                      <li
                        key={i}
                        className={
                          "flex items-start gap-2 " +
                          (d.level === "warn" ? "text-amber-600" : "text-muted-foreground")
                        }
                      >
                        {d.level === "warn" ? (
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>{d.message}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          {(["institucional", "marketing"] as CreativeModel[]).map((model) => {
            const art = arts[model];
            return (
              <article
                key={model}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <header className="border-b border-border px-5 py-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    {CREATIVE_MODEL_LABEL[model]}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{MODEL_HINT[model]}</p>
                </header>
                <div className="p-5">
                  {art ? (
                    <button
                      type="button"
                      onClick={() =>
                        setZoom({
                          model,
                          src: `data:image/png;base64,${art}`,
                          file: fileFor(model),
                        })
                      }
                      className="block w-full overflow-hidden rounded-xl border border-border transition hover:opacity-90"
                    >
                      <img
                        src={`data:image/png;base64,${art}`}
                        alt={`${CREATIVE_MODEL_LABEL[model]} — ${form.city}`}
                        className="w-full"
                      />
                    </button>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                      {busy ? "Gerando…" : "Aguardando geração"}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {zoom ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6"
          onClick={() => setZoom(null)}
        >
          <div
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                {CREATIVE_MODEL_LABEL[zoom.model]}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadBase64(zoom.src.split(",")[1] ?? "", zoom.file)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(null)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"
                >
                  <X className="h-4 w-4" /> Fechar
                </button>
              </div>
            </header>
            <div className="overflow-auto p-5">
              <img src={zoom.src} alt={CREATIVE_MODEL_LABEL[zoom.model]} className="w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </ExecutiveShell>
  );
}
