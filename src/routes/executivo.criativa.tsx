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
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import {
  getSession,
  canManageCreativeTemplates,
  type ExecutiveSession,
} from "@/lib/executive-auth";
import { CREATIVE_MODEL_LABEL } from "@/lib/creative/brand";
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

/** A IA Criativa trabalha exclusivamente com o Modelo A — Institucional. */
const MODEL = "institucional" as const;

function unitName(form: FormState): string {
  return `Velox ${form.city}${form.state ? ` — ${form.state}` : ""}`.trim();
}

function CriativaPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [art, setArt] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ src: string; file: string } | null>(null);
  const [template, setTemplate] = useState<CreativeTemplate | null>(null);
  const [reference, setReference] = useState<CreativeReference | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  /** Fotografia enviada pelo usuário (obrigatória). */
  const [manualPhoto, setManualPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  /** Etapa 2 do fluxo: envio obrigatório da fotografia da cidade. */
  const [photoStep, setPhotoStep] = useState(false);
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<Diagnostic[] | null>(null);
  const canManageTemplates = session ? canManageCreativeTemplates(session.activeRole) : false;

  useEffect(() => {
    void (async () => {
      setTemplate((await getTemplate(MODEL)) ?? null);
      setReference(getReference(MODEL) ?? null);
    })();
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
  }, [navigate]);

  /** Fotografia manual: upload, arrastar ou CTRL + V. */
  function readPhoto(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () =>
      setManualPhoto({ name: file.name || "foto colada", dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  async function sendTemplate(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setTemplate(await uploadTemplate(MODEL, file, session?.userId));
    } catch (err) {
      const saved = await getTemplate(MODEL);
      if (saved) setTemplate(saved);
      setError(err instanceof Error ? err.message : "Falha ao enviar o template.");
    } finally {
      setUploading(false);
    }
  }

  /** Modelo Padronizado: referência visual, nunca usada como template. */
  async function sendReference(file: File | undefined) {
    if (!file) return;
    setUploadingRef(true);
    setError(null);
    try {
      setReference(await uploadReference(MODEL, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar o modelo padronizado.");
    } finally {
      setUploadingRef(false);
    }
  }

  /** Prévia de validação: não gera arte definitiva nem grava histórico. */
  async function runTest() {
    setTesting(true);
    setError(null);
    try {
      const result = await testTemplate(MODEL, { guide: true });
      setReport(result.report);
      setZoom({
        src: `data:image/png;base64,${result.preview}`,
        file: `teste-${MODEL}-${slugify(`${TEST_CITY}-${TEST_STATE}`)}.png`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao testar o template.");
    } finally {
      setTesting(false);
    }
  }

  /** Etapa 1: Cidade + UF › abre o envio da fotografia. */
  function startGeneration() {
    const city = form.city.trim();
    const state = form.state.trim().toUpperCase();
    if (!city || state.length !== 2) {
      setError("Informe a cidade e a UF (duas letras) para gerar a arte.");
      return;
    }
    setError(null);
    setPhotoStep(true);
  }

  async function generate() {
    if (busy) return;
    const city = form.city.trim();
    const state = form.state.trim().toUpperCase();
    if (!city || state.length !== 2) {
      setError("Informe a cidade e a UF (duas letras) para gerar a arte.");
      return;
    }
    if (!manualPhoto) {
      setError("Cole, arraste ou envie a imagem da cidade para gerar a arte.");
      return;
    }
    setBusy(true);
    setError(null);
    setArt(null);
    try {
      const institucional = await composeFromTemplate({
        model: MODEL,
        city,
        state,
        photoDataUrl: manualPhoto.dataUrl,
      });
      setArt(institucional);
      recordCreative({
        userId: session?.userId ?? "",
        category: "unidade",
        model: MODEL,
        unit: unitName({ city, state }),
        city,
        state,
        fileName: fileName(city, state),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar a arte agora.");
    } finally {
      setBusy(false);
      setPhotoStep(false);
    }
  }

  const fileName = (city: string, state: string) =>
    `velox-${MODEL}-${slugify(`${city}-${state}`)}.png`;

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
              onClick={startGeneration}
              disabled={busy}
              className="mt-auto inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {busy ? "Gerando…" : "Gerar arte"}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </section>

        {/* Etapa 2 — envio da fotografia da cidade. */}
        {photoStep ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">
                Fotografia de {form.city.trim()} - {form.state.trim().toUpperCase()}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Envie a imagem que será aplicada na área reservada do template oficial.
              </p>
              <div className="mt-4">
                <ImageDropzone
                  title="Cole a imagem com CTRL + V"
                  hint="Cole (CTRL + V), arraste ou envie a imagem da cidade."
                  uploadLabel="Enviar imagem da cidade"
                  note="A imagem entra exatamente na área reservada do template oficial."
                  preview={manualPhoto?.dataUrl ?? null}
                  onFile={(file) => readPhoto(file)}
                />
              </div>
              {manualPhoto ? (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={manualPhoto.dataUrl}
                    alt="Miniatura da fotografia enviada"
                    className="h-14 w-20 rounded-md border border-border object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {manualPhoto.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setManualPhoto(null)}
                    className="cursor-pointer text-xs font-semibold text-muted-foreground underline underline-offset-2"
                  >
                    Trocar
                  </button>
                </div>
              ) : null}
              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoStep(false)}
                  className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy || !manualPhoto}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {busy ? "Gerando…" : "Gerar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Área administrativa — somente Administrador e Gestora. */}
        {canManageTemplates ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {CREATIVE_MODEL_LABEL[MODEL]}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {template
                  ? template.builtIn
                    ? "Utilizando o template oficial padrão."
                    : `Em uso: ${template.fileName}`
                  : "Nenhum template enviado."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Enviar Template Institucional
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    void sendTemplate(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted">
                {uploadingRef ? (
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
                    void sendReference(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void runTest()}
                disabled={!template || testing}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
                Testar Template
              </button>
            </div>
            <p className="text-xs">
              <span className="text-muted-foreground">Status: </span>
              {template ? (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Template carregado
                  {template.config ? ` · ${template.config.width}×${template.config.height} px` : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Nenhum template</span>
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {template ? (
                <figure>
                  <img
                    src={template.dataUrl}
                    alt="Template Institucional"
                    className="h-32 w-full rounded-lg border border-border object-contain"
                  />
                  <figcaption className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Template oficial · onde editar
                  </figcaption>
                </figure>
              ) : null}
              {reference ? (
                <figure>
                  <img
                    src={reference.dataUrl}
                    alt="Modelo padronizado — Institucional"
                    className="h-32 w-full rounded-lg border border-dashed border-border object-contain"
                  />
                  <figcaption className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Modelo padronizado · referência ({reference.width}×{reference.height})
                  </figcaption>
                </figure>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border p-2 text-center text-[10px] text-muted-foreground">
                  Modelo padronizado não enviado — referência apenas visual, nunca utilizada como
                  template.
                </div>
              )}
            </div>
            {report ? (
              <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                {report.map((d, i) => (
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
          </section>
        ) : null}

        <section>
          <article className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-foreground">
                {CREATIVE_MODEL_LABEL[MODEL]}
              </h3>
            </header>
            <div className="p-5">
              {art ? (
                <button
                  type="button"
                  onClick={() =>
                    setZoom({
                      src: `data:image/png;base64,${art}`,
                      file: fileName(form.city, form.state),
                    })
                  }
                  className="block w-full cursor-pointer overflow-hidden rounded-xl border border-border transition hover:opacity-90"
                >
                  <img
                    src={`data:image/png;base64,${art}`}
                    alt={`Arte institucional — ${form.city}`}
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
                {CREATIVE_MODEL_LABEL[MODEL]}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadBase64(zoom.src.split(",")[1] ?? "", zoom.file)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(null)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"
                >
                  <X className="h-4 w-4" /> Fechar
                </button>
              </div>
            </header>
            <div className="overflow-auto p-5">
              <img src={zoom.src} alt={CREATIVE_MODEL_LABEL[MODEL]} className="w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </ExecutiveShell>
  );
}
