import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Wand2, Loader2, Download, CloudUpload, Eye, Check, Lock } from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { CREATIVE_MODEL_LABEL, type CreativeModel } from "@/lib/creative/brand";
import { renderTemplate, type UnitBrief } from "@/lib/creative/templates";
import {
  officialLogoHref,
  svgToDataUrl,
  svgToPngBase64,
  downloadBase64,
  openBase64InNewTab,
  slugify,
} from "@/lib/creative/render";
import { recordCreative } from "@/lib/creative/history";
import {
  generateCreativeCopy,
  getCityPhoto,
  saveCreativeArt,
  saveOfficialModel,
  type CreativeCopyPair,
} from "@/lib/creative.functions";

export const Route = createFileRoute("/executivo/criativa")({
  head: () => ({
    meta: [
      { title: "IA Criativa — Atlas Platform" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CriativaPage,
});

/** Somente cidade e UF variam: todo o restante é padrão oficial fixo. */
type FormState = { city: string; state: string };

const EMPTY: FormState = { city: "", state: "" };

/** Nome institucional derivado — a unidade nunca é digitada. */
function unitName(form: FormState): string {
  return `Velox ${form.city}${form.state ? ` — ${form.state}` : ""}`.trim();
}

function CriativaPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<CreativeCopyPair | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
    void officialLogoHref().then(setLogo);
  }, [navigate]);

  const arts = useMemo(() => {
    if (!copy) return null;
    const base = { unit: unitName(form), city: form.city, state: form.state, photo };
    const build = (model: CreativeModel): { svg: string; brief: UnitBrief } => {
      const brief: UnitBrief = { ...base, ...copy[model] };
      return { svg: renderTemplate(model, brief, logo), brief };
    };
    return { institucional: build("institucional"), marketing: build("marketing") };
  }, [copy, form, logo, photo]);

  async function generate() {
    if (busy) return;
    if (!form.city.trim() || form.state.trim().length !== 2) {
      setError("Informe a cidade e a UF (duas letras) para gerar as artes.");
      return;
    }
    setError(null);
    setBusy(true);
    const city = form.city.trim();
    const state = form.state.trim().toUpperCase();
    try {
      const [res, picture] = await Promise.all([
        generateCreativeCopy({ data: { unit: unitName(form), city, state } }),
        getCityPhoto({ data: { city, state } }).catch(() => ({ dataUrl: null })),
      ]);
      setPhoto(picture.dataUrl ?? null);
      setCopy(res);
    } catch {
      setError("Não foi possível gerar as artes agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="IA Criativa">
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
        <aside className="space-y-5">
          <NewUnitForm
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onGenerate={generate}
            busy={busy}
            error={error}
          />
          <OfficialModelUpload />
        </aside>

        <section className="space-y-5">
          {arts ? (
            <div className="grid gap-5 md:grid-cols-2">
              <ArtCard
                model="institucional"
                svg={arts.institucional.svg}
                fileBase={`${slugify(unitName(form))}-institucional`}
                session={session}
                unit={unitName(form)}
                city={form.city}
                state={form.state}
              />
              <ArtCard
                model="marketing"
                svg={arts.marketing.svg}
                fileBase={`${slugify(unitName(form))}-marketing`}
                session={session}
                unit={unitName(form)}
                city={form.city}
                state={form.state}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/30 p-12 text-center">
              <p className="font-display text-xl">Nenhuma arte gerada ainda.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-foreground)]">
                Informe a cidade e a UF. As duas peças oficiais — Modelo A
                (Institucional) e Modelo B (Marketing) — serão geradas a partir
                do Modelo Oficial aprovado.
              </p>
            </div>
          )}
        </section>
      </div>
    </ExecutiveShell>
  );
}

function NewUnitForm({
  form,
  onChange,
  onGenerate,
  busy,
  error,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onGenerate: () => void;
  busy: boolean;
  error: string | null;
}) {
  const field =
    "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60 transition";
  const label =
    "text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]";
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-[color:var(--gold)]" />
        <h2 className="font-display text-lg">Nova unidade</h2>
      </div>

      <div className="grid grid-cols-[1fr_88px] gap-3">
        <div className="space-y-1.5">
          <span className={label}>Cidade</span>
          <input
            className={field}
            value={form.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="São José do Rio Preto"
          />
        </div>
        <div className="space-y-1.5">
          <span className={label}>UF</span>
          <input
            className={field}
            value={form.state}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="SP"
          />
        </div>
      </div>

      {error ? <p className="text-xs text-[color:var(--destructive)]">{error}</p> : null}

      <button
        type="button"
        onClick={onGenerate}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-4 py-2.5 text-sm text-[color:var(--foreground)] hover:border-[color:var(--gold)] disabled:opacity-60 transition"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {busy ? "Gerando artes oficiais…" : "Gerar artes"}
      </button>
    </section>
  );
}

/** Extensões aceitas no Modelo Oficial. */
const ACCEPTED_EXT = /\.(png|jpe?g|pdf)$/i;

/** Alguns navegadores não informam o MIME: derivamos pela extensão. */
function guessMime(name: string, type: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "pdf") return "application/pdf";
  return type || "application/octet-stream";
}

/**
 * MODELO OFICIAL — arquivo único e imutável de referência. Um novo envio
 * substitui automaticamente o anterior; não há versões nem histórico.
 */
function OfficialModelUpload() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function upload(file: File) {
    if (!ACCEPTED_EXT.test(file.name)) {
      setStatus("Formato não aceito. Envie um arquivo PNG, JPG, JPEG ou PDF.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("leitura"));
        reader.readAsDataURL(file);
      });
      await saveOfficialModel({
        data: {
          name: file.name,
          contentBase64: base64,
          mimeType: guessMime(file.name, file.type),
        },
      });
      setStatus("✔ Modelo Oficial carregado.");
    } catch {
      setStatus("Não foi possível carregar o Modelo Oficial agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-[color:var(--gold)]" />
        <h3 className="font-display text-base">Modelo Oficial</h3>
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
        Referência única e permanente das artes. Um novo envio substitui o
        anterior. Formatos aceitos: PNG, JPG, JPEG e PDF.
      </p>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/50 px-3 py-2 text-xs hover:border-[color:var(--gold)]/50 transition">
        <span className="text-[color:var(--muted-foreground)]">Enviar Modelo Oficial</span>
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--gold)]" />
        ) : (
          <CloudUpload className="h-3.5 w-3.5 text-[color:var(--gold)]" />
        )}
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {status ? (
        <p className="text-[11px] text-[color:var(--muted-foreground)]">{status}</p>
      ) : null}
    </section>
  );
}

function ArtCard({
  model,
  svg,
  fileBase,
  session,
  unit,
  city,
  state,
}: {
  model: CreativeModel;
  svg: string;
  fileBase: string;
  session: ExecutiveSession;
  unit: string;
  city: string;
  state: string;
}) {
  const [saving, setSaving] = useState(true);
  const [saved, setSaved] = useState(false);
  const preview = useMemo(() => svgToDataUrl(svg), [svg]);
  const fileName = `${fileBase}.png`;

  async function download() {
    const png = await svgToPngBase64(svg);
    downloadBase64(png, fileName);
  }

  async function view() {
    const png = await svgToPngBase64(svg);
    openBase64InNewTab(png);
  }

  /** Arquivamento automático na pasta corporativa — sem qualquer ação. */
  useEffect(() => {
    let alive = true;
    setSaving(true);
    setSaved(false);
    void (async () => {
      let driveLink: string | null = null;
      try {
        const png = await svgToPngBase64(svg);
        const res = await saveCreativeArt({
          data: { name: fileName, contentBase64: png, mimeType: "image/png" },
        });
        driveLink = res.webViewLink ?? null;
        if (alive) setSaved(true);
      } catch {
        /* a peça continua disponível para visualizar e baixar */
      }
      recordCreative({
        userId: session.userId,
        category: "unidade",
        model,
        unit,
        city,
        state,
        fileName,
        driveLink,
      });
      if (alive) setSaving(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, fileName]);

  const action =
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/50 transition";

  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 overflow-hidden flex flex-col">
      <header className="border-b border-[color:var(--border)] px-5 py-3">
        <h3 className="font-display text-base">{CREATIVE_MODEL_LABEL[model]}</h3>
      </header>
      <div className="p-5">
        <img
          src={preview}
          alt={`Pré-visualização ${CREATIVE_MODEL_LABEL[model]}`}
          className="w-full rounded-xl border border-[color:var(--border)]"
          loading="lazy"
        />
      </div>
      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] px-5 py-3">
        <button type="button" onClick={() => void view()} className={action}>
          <Eye className="h-3.5 w-3.5" /> Visualizar
        </button>
        <button type="button" onClick={() => void download()} className={action}>
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--muted-foreground)]">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          ) : null}
        </span>
      </footer>
    </article>
  );
}
