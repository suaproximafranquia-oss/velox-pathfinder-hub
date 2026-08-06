import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Wand2,
  Loader2,
  Download,
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  Move,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ImageDropzone } from "@/components/shared/image-dropzone";
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
  /** Origem da fotografia: busca automática ou imagem enviada. */
  const [photoMode, setPhotoMode] = useState<"auto" | "manual">("auto");
  const [testing, setTesting] = useState<CreativeModel | null>(null);
  const [report, setReport] = useState<Partial<Record<CreativeModel, Diagnostic[]>>>({});
  /**
   * Dados da última geração — permitem recompor o Modelo B quando o
   * usuário reposiciona a fotografia dentro da máscara oficial.
   */
  const [lastRun, setLastRun] = useState<{
    city: string;
    state: string;
    photoDataUrl: string;
    copy: { headline: string; subheadline: string; supporting: string };
  } | null>(null);
  /** Modo de enquadramento do Modelo B (somente mover a fotografia). */
  const [framing, setFraming] = useState<{ offset: { x: number; y: number }; art: string } | null>(
    null,
  );
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
    if (photoMode === "manual" && !manualPhoto) {
      setError("Cole, arraste ou envie a imagem da cidade para gerar as artes.");
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
          setLastRun({
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
      setFraming(null);

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

  /** Arraste da fotografia (Modelo B) — único gesto de edição. */
  const dragRef = useRef<{ x: number; y: number; base: { x: number; y: number }; w: number } | null>(
    null,
  );
  const renderingRef = useRef(false);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  async function pumpFrame() {
    if (renderingRef.current) return;
    const next = pendingRef.current;
    if (!next) return;
    pendingRef.current = null;
    renderingRef.current = true;
    await recomposeMarketing(next);
    renderingRef.current = false;
    void pumpFrame();
  }

  /**
   * Recompõe o Modelo B com a fotografia deslocada. Nenhum outro
   * elemento é recalculado: o template oficial continua por cima.
   */
  async function recomposeMarketing(offset: { x: number; y: number }) {
    if (!lastRun) return;
    const art = await composeFromTemplate({
      model: "marketing",
      city: lastRun.city,
      state: lastRun.state,
      photoDataUrl: lastRun.photoDataUrl,
      copy: lastRun.copy,
      photoOffset: offset,
    }).catch(() => null);
    if (art) setFraming({ offset, art });
  }

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

          {/* Origem da fotografia — automática por padrão; manual é opcional. */}
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = photoMode === "manual" ? "auto" : "manual";
                  setPhotoMode(next);
                  if (next === "auto") setManualPhoto(null);
                }}
                className={[
                  "cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition",
                  photoMode === "manual"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                Usar imagem manual
              </button>
              <span className="text-xs text-muted-foreground">
                Sem imagem manual, a fotografia da cidade é buscada automaticamente.
              </span>
            </div>
            {photoMode === "manual" ? (
              <div className="mt-4">
                <ImageDropzone
                  title="Cole a imagem com CTRL + V"
                  hint="Cole (CTRL + V), arraste ou envie a imagem da cidade que deseja utilizar na arte oficial."
                  uploadLabel="Enviar imagem da cidade"
                  note="A imagem entra exatamente na área reservada do template oficial."
                  preview={manualPhoto?.dataUrl ?? null}
                  onFile={(file) => readPhoto(file)}
                />
                {manualPhoto ? (
                  <button
                    type="button"
                    onClick={() => setManualPhoto(null)}
                    className="mt-2 text-xs font-semibold text-muted-foreground underline underline-offset-2"
                  >
                    Remover imagem
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {(["institucional", "marketing"] as CreativeModel[]).map((model) => {
            const tpl = templates[model];
            const diags = report[model];
            const ref = references[model];
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
                {canManageTemplates ? (
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted">
                    {uploadingRef === model ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Enviar Modelo Padronizado
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        void sendReference(model, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
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
                <div className="grid grid-cols-2 gap-3">
                  {tpl ? (
                    <figure>
                      <img
                        src={tpl.dataUrl}
                        alt={TEMPLATE_LABEL[model]}
                        className="h-32 w-full rounded-lg border border-border object-contain"
                      />
                      <figcaption className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Template oficial · onde editar
                      </figcaption>
                    </figure>
                  ) : null}
                  {ref ? (
                    <figure>
                      <img
                        src={ref.dataUrl}
                        alt={`Modelo padronizado — ${CREATIVE_MODEL_LABEL[model]}`}
                        className="h-32 w-full rounded-lg border border-dashed border-border object-contain"
                      />
                      <figcaption className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Modelo padronizado · referência ({ref.width}×{ref.height})
                      </figcaption>
                    </figure>
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border p-2 text-center text-[10px] text-muted-foreground">
                      Modelo padronizado não enviado — referência apenas visual, nunca utilizada
                      como template.
                    </div>
                  )}
                </div>
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
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          model === "marketing" && lastRun
                            ? setFraming({ offset: { x: 0, y: 0 }, art })
                            : setZoom({
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
                      {model === "marketing" && lastRun ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFraming({ offset: { x: 0, y: 0 }, art })}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
                          >
                            <Move className="h-4 w-4" /> Ajustar enquadramento
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadBase64(art, fileFor(model))}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                          >
                            <Download className="h-4 w-4" /> Download
                          </button>
                        </div>
                      ) : null}
                    </div>
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

      {framing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6">
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Ajustar enquadramento</h3>
                <p className="text-xs text-muted-foreground">
                  Arraste a fotografia. Todo o restante da arte permanece bloqueado.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setArts((a) => ({ ...a, marketing: framing.art }));
                    setFraming(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <CheckCircle2 className="h-4 w-4" /> Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setFraming(null)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"
                >
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </header>
            <div className="overflow-auto p-5">
              <img
                src={`data:image/png;base64,${framing.art}`}
                alt="Ajuste de enquadramento — Modelo B"
                draggable={false}
                className="w-full cursor-grab touch-none select-none active:cursor-grabbing"
                onPointerDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  dragRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    base: framing.offset,
                    w: rect.width,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const drag = dragRef.current;
                  if (!drag || !drag.w) return;
                  pendingRef.current = {
                    x: drag.base.x + (e.clientX - drag.x) / drag.w,
                    y: drag.base.y + (e.clientY - drag.y) / drag.w,
                  };
                  void pumpFrame();
                }}
                onPointerUp={(e) => {
                  dragRef.current = null;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

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
