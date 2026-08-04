import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Wand2,
  Loader2,
  Download,
  CloudUpload,
  Lock,
  Trash2,
  X,
  HardDrive,
  Crop,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import { CREATIVE_MODEL_LABEL, type CreativeModel } from "@/lib/creative/brand";
import { downloadBase64, slugify } from "@/lib/creative/render";
import { recordCreative } from "@/lib/creative/history";
import { composeInstitutionalArt } from "@/lib/creative/compose";
import {
  defaultTextField,
  isLayoutReady,
  parseLayout,
  FIELD_LABEL,
  type LayoutFieldKey,
  type OfficialLayout,
  type Rect,
} from "@/lib/creative/layout";
import {
  saveOfficialModel,
  getOfficialModel,
  deleteOfficialModel,
  checkDriveIntegration,
  getInstitutionalSource,
  generateMarketingArt,
  saveOfficialModelLayout,
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
  const [arts, setArts] = useState<Partial<Record<CreativeModel, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState(0);
  const [zoom, setZoom] = useState<{ model: CreativeModel; src: string; file: string } | null>(
    null,
  );

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
  }, [navigate]);

  async function generate() {
    if (busy) return;
    if (!form.city.trim() || form.state.trim().length !== 2) {
      setError("Informe a cidade e a UF (duas letras) para gerar as artes.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    // Nova geração sempre substitui as artes anteriores.
    setArts({});
    setZoom(null);
    const city = form.city.trim();
    const state = form.state.trim().toUpperCase();
    const problems: string[] = [];
    try {
      const [institucional, marketing] = await Promise.allSettled([
        // MODELO A — edição automatizada do arquivo oficial, sem IA generativa.
        (async () => {
          const source = await getInstitutionalSource({ data: { city, state } });
          const layout = parseLayout(source.layout);
          if (!isLayoutReady(layout)) {
            throw new Error(
              "Mapeie os campos variáveis do Modelo Oficial (cidade, UF e fotografia) para liberar o Modelo A.",
            );
          }
          return composeInstitutionalArt({
            officialDataUrl: source.officialDataUrl,
            layout,
            city,
            state,
            photoDataUrl: source.photoDataUrl,
          });
        })(),
        // MODELO B — releitura criativa por IA.
        generateMarketingArt({ data: { city, state } }).then((r) => r.base64),
      ]);

      const next: Partial<Record<CreativeModel, string>> = {};
      if (institucional.status === "fulfilled") next.institucional = institucional.value;
      else
        problems.push(
          institucional.reason instanceof Error
            ? institucional.reason.message
            : "Não foi possível editar o Modelo Oficial agora.",
        );
      if (marketing.status === "fulfilled") next.marketing = marketing.value;
      else
        problems.push(
          marketing.reason instanceof Error
            ? marketing.reason.message
            : "Não foi possível gerar o Modelo B agora.",
        );

      setArts(next);
      if (problems.length) setNotice(problems.join(" "));
      if (!next.institucional && !next.marketing) setError(problems[0] ?? null);
    } finally {
      setBusy(false);
    }
  }

  /** Ao remover ou substituir o Modelo Oficial a tela volta ao estado inicial. */
  const resetArts = useCallback(() => {
    setArts({});
    setZoom(null);
    setNotice(null);
    setError(null);
    setModelVersion((v) => v + 1);
  }, []);

  const models = useMemo(
    () => (["institucional", "marketing"] as CreativeModel[]).filter((m) => arts[m]),
    [arts],
  );

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="IA Criativa">
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
        <aside className="space-y-5">
          <NewUnitForm
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onGenerate={generate}
            busy={busy}
            error={error}
          />
          <OfficialModelUpload onChanged={resetArts} />
          <OfficialModelMapper key={modelVersion} />
          <DriveDiagnostics />
        </aside>

        <section className="space-y-5">
          {notice ? (
            <p className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-5 py-3 text-xs text-[color:var(--muted-foreground)]">
              {notice}
            </p>
          ) : null}
          {models.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {models.map((model) => (
                <ArtCard
                  key={model}
                  model={model}
                  png={arts[model]!}
                  fileBase={`${slugify(unitName(form))}-${model}`}
                  session={session}
                  unit={unitName(form)}
                  city={form.city}
                  state={form.state}
                  onOpen={setZoom}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/30 p-12 text-center">
              <p className="font-display text-xl">Nenhuma arte gerada ainda.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-foreground)]">
                Informe a cidade e a UF. O Modelo A (Institucional) é o próprio
                arquivo oficial editado — apenas cidade, UF e fotografia mudam.
                O Modelo B (Marketing) é a releitura criativa da mesma peça.
              </p>
            </div>
          )}
        </section>
      </div>
      {zoom ? <ArtModal art={zoom} onClose={() => setZoom(null)} /> : null}
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
function OfficialModelUpload({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [current, setCurrent] = useState<{
    fileName: string;
    uploadedAt: string;
  } | null>(null);

  // O Modelo Oficial persiste no banco corporativo: ao reabrir a tela o
  // arquivo enviado continua registrado.
  useEffect(() => {
    void getOfficialModel({ data: {} })
      .then((m) => setCurrent(m ? { fileName: m.fileName, uploadedAt: m.uploadedAt } : null))
      .catch(() => undefined);
  }, []);

  async function upload(file: File) {
    if (!ACCEPTED_EXT.test(file.name)) {
      setStatus("Formato não aceito. Envie um arquivo PNG, JPG, JPEG ou PDF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus("Arquivo muito grande. Envie um arquivo de até 8 MB.");
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
      const saved = await saveOfficialModel({
        data: {
          name: file.name,
          contentBase64: base64,
          mimeType: guessMime(file.name, file.type),
        },
      });
      setCurrent({ fileName: saved.fileName, uploadedAt: saved.uploadedAt });
      onChanged();
      setStatus("✔ Modelo Oficial carregado. Mapeie os campos variáveis abaixo.");
    } catch {
      setStatus("Não foi possível carregar o Modelo Oficial agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  /** Remoção total: arquivo, cache e artes geradas. */
  async function remove() {
    if (removing) return;
    setRemoving(true);
    setStatus(null);
    try {
      await deleteOfficialModel({ data: undefined });
      setCurrent(null);
      onChanged();
      setStatus("Modelo Oficial removido. A tela voltou ao estado inicial.");
    } catch {
      setStatus("Não foi possível remover o Modelo Oficial agora. Tente novamente.");
    } finally {
      setRemoving(false);
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
      {current ? (
        <div className="space-y-2">
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            ✓ Modelo Oficial carregado: <strong>{current.fileName}</strong> ·{" "}
            {new Date(current.uploadedAt).toLocaleString("pt-BR")}
          </p>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={removing}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--destructive)] hover:border-[color:var(--destructive)]/50 disabled:opacity-60 transition"
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remover Modelo Oficial
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-[color:var(--muted-foreground)]">
          Nenhum Modelo Oficial salvo até o momento.
        </p>
      )}
    </section>
  );
}

/** Validação da pasta corporativa do Drive — acesso, gravação e leitura. */
function DriveDiagnostics() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await checkDriveIntegration({ data: undefined });
      setResult({ ok: res.ok, message: res.message });
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof Error ? err.message : "Falha ao validar a integração com o Drive.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-[color:var(--gold)]" />
        <h3 className="font-display text-base">Pasta corporativa</h3>
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
        Verifica acesso, gravação e leitura na pasta oficial do Drive.
      </p>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--muted-foreground)] hover:border-[color:var(--gold)]/50 hover:text-[color:var(--foreground)] disabled:opacity-60 transition"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {busy ? "Validando integração…" : "Validar integração"}
      </button>
      {result ? (
        <p
          className={`text-[11px] leading-relaxed ${result.ok ? "text-[color:var(--gold)]" : "text-[color:var(--muted-foreground)]"}`}
        >
          {result.ok ? "✓ " : "• "}
          {result.message}
        </p>
      ) : null}
    </section>
  );
}

function ArtCard({
  model,
  png,
  fileBase,
  session,
  unit,
  city,
  state,
  onOpen,
}: {
  model: CreativeModel;
  png: string;
  fileBase: string;
  session: ExecutiveSession;
  unit: string;
  city: string;
  state: string;
  onOpen: (art: { model: CreativeModel; src: string; file: string }) => void;
}) {
  const preview = useMemo(() => `data:image/png;base64,${png}`, [png]);
  const fileName = `${fileBase}.png`;

  /** Registro interno da peça — sem download nem abertura automática. */
  useEffect(() => {
    recordCreative({
      userId: session.userId,
      category: "unidade",
      model,
      unit,
      city,
      state,
      fileName,
      driveLink: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [png, fileName]);

  return (
    <button
      type="button"
      onClick={() => onOpen({ model, src: preview, file: fileName })}
      className="text-left rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 overflow-hidden flex flex-col hover:border-[color:var(--gold)]/60 transition"
    >
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
      <footer className="mt-auto border-t border-[color:var(--border)] px-5 py-3 text-xs text-[color:var(--muted-foreground)]">
        Clique para ampliar
      </footer>
    </button>
  );
}

/** Visualização ampliada na própria página — download apenas manual. */
function ArtModal({
  art,
  onClose,
}: {
  art: { model: CreativeModel; src: string; file: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={CREATIVE_MODEL_LABEL[art.model]}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-3xl overflow-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
          <h3 className="font-display text-base">{CREATIVE_MODEL_LABEL[art.model]}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">
          <img
            src={art.src}
            alt={`Arte ampliada — ${CREATIVE_MODEL_LABEL[art.model]}`}
            className="w-full rounded-xl border border-[color:var(--border)]"
          />
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={() => downloadBase64(art.src.split(",")[1] ?? "", art.file)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-4 py-2 text-xs hover:border-[color:var(--gold)] transition"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-4 py-2 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
          >
            <X className="h-3.5 w-3.5" /> Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
