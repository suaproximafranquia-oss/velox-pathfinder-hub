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
  LAYOUT_FIELD_KEYS,
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
    try {
      // Edição automatizada do arquivo oficial — nenhuma IA gera a arte.
      const source = await getInstitutionalSource({ data: { city, state } });
      const layout = parseLayout(source.layout);
      if (!isLayoutReady(layout)) {
        setError(
          "Mapeie os campos variáveis do Modelo Oficial (cidade, UF e fotografia) antes de gerar a arte.",
        );
        return;
      }
      const png = await composeInstitutionalArt({
        officialDataUrl: source.officialDataUrl,
        layout,
        city,
        state,
        photoDataUrl: source.photoDataUrl,
      });
      setArts({ institucional: png });
      if (!source.photoDataUrl) {
        setNotice(
          "Nenhuma fotografia da cidade foi localizada: a imagem original do Modelo Oficial foi mantida.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível editar o Modelo Oficial agora.",
      );
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
    () => (["institucional"] as CreativeModel[]).filter((m) => arts[m]),
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
            <div className="grid gap-5">
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
                Informe a cidade e a UF. A arte gerada é o próprio arquivo
                oficial editado: apenas o nome da cidade, a UF e a fotografia de
                fundo mudam. Todo o restante permanece idêntico.
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

/**
 * MAPEAMENTO DO MODELO OFICIAL.
 *
 * O Modelo A não interpreta a arte: ele edita o arquivo enviado. Para
 * isso o administrador marca, uma única vez, onde ficam os campos
 * variáveis — fotografia, cidade e UF. Nada fora dessas áreas é tocado.
 */
function OfficialModelMapper() {
  const [source, setSource] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [layout, setLayout] = useState<OfficialLayout>({});
  const [field, setField] = useState<LayoutFieldKey>("photo");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void getOfficialModel({ data: { withContent: true } })
      .then((m) => {
        if (m && m.contentBase64 && m.mimeType.startsWith("image/")) {
          setSource({
            dataUrl: `data:${m.mimeType};base64,${m.contentBase64}`,
            fileName: m.fileName,
          });
          setLayout(parseLayout(m.layout));
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  function point(e: React.PointerEvent): { x: number; y: number } {
    const box = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  }

  function apply(rect: Rect) {
    setLayout((prev) => {
      if (field === "photo" || field === "badge") return { ...prev, [field]: rect };
      const current = prev[field];
      return { ...prev, [field]: current ? { ...current, rect } : defaultTextField(rect) };
    });
  }

  function onDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = point(e);
  }
  function onMove(e: React.PointerEvent) {
    const start = dragRef.current;
    if (!start) return;
    const now = point(e);
    apply({
      x: Math.min(start.x, now.x),
      y: Math.min(start.y, now.y),
      w: Math.abs(now.x - start.x),
      h: Math.abs(now.y - start.y),
    });
  }
  function onUp() {
    dragRef.current = null;
  }

  function patchText(patch: Partial<ReturnType<typeof defaultTextField>>) {
    setLayout((prev) => {
      if (field === "photo" || field === "badge") return prev;
      const current = prev[field];
      if (!current) return prev;
      return { ...prev, [field]: { ...current, ...patch } };
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      await saveOfficialModelLayout({ data: { layout } });
      setStatus("✔ Mapeamento salvo. O Modelo A passará a editar essas áreas.");
    } catch {
      setStatus("Não foi possível salvar o mapeamento agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const active =
    field === "photo" || field === "badge" ? layout[field] : layout[field]?.rect;
  const text = field === "photo" || field === "badge" ? null : layout[field];
  const control =
    "rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/60 px-2 py-1 text-[11px] outline-none";

  if (loading) return null;

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Crop className="h-4 w-4 text-[color:var(--gold)]" />
        <h3 className="font-display text-base">Campos variáveis</h3>
      </div>
      {!source ? (
        <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
          Envie um Modelo Oficial em PNG ou JPG para mapear cidade, UF e a
          fotografia principal.
        </p>
      ) : (
        <>
          <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
            Selecione o campo e arraste sobre a arte para marcar a área. A
            fotografia da cidade preenche toda a área marcada e recebe
            automaticamente a película azul do template, fundindo-se ao fundo
            institucional. Marque em “Selo” o carimbo “Vem Aí — Nova Unidade”
            (com uma folga em volta) para que ele seja preservado sobre a foto.
            O restante do arquivo permanece idêntico.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LAYOUT_FIELD_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setField(key)}
                className={`rounded-full border px-3 py-1 text-[11px] transition ${
                  field === key
                    ? "border-[color:var(--gold)] text-[color:var(--foreground)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
                }`}
              >
                {FIELD_LABEL[key]}
              </button>
            ))}
          </div>

          <div
            ref={boxRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="relative w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-[color:var(--border)] select-none"
          >
            <img
              src={source.dataUrl}
              alt={`Modelo Oficial ${source.fileName}`}
              className="pointer-events-none w-full"
              draggable={false}
            />
            {LAYOUT_FIELD_KEYS.map((key) => {
              const rect =
                key === "photo" || key === "badge" ? layout[key] : layout[key]?.rect;
              if (!rect) return null;
              return (
                <span
                  key={key}
                  className={`pointer-events-none absolute border-2 ${
                    key === field
                      ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15"
                      : "border-white/60"
                  }`}
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.w * 100}%`,
                    height: `${rect.h * 100}%`,
                  }}
                />
              );
            })}
          </div>

          {text ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                Cor do texto
                <input
                  type="color"
                  value={text.color}
                  onChange={(e) => patchText({ color: e.target.value })}
                  className="h-6 w-10 rounded border border-[color:var(--border)] bg-transparent"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                Cobrir fundo
                <input
                  type="color"
                  value={text.cover || "#0B1B33"}
                  onChange={(e) => patchText({ cover: e.target.value })}
                  className="h-6 w-10 rounded border border-[color:var(--border)] bg-transparent"
                />
              </label>
              <button
                type="button"
                onClick={() => patchText({ cover: "" })}
                className="rounded-lg border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted-foreground)]"
              >
                Sem cobertura
              </button>
              <select
                className={control}
                value={text.align}
                onChange={(e) => patchText({ align: e.target.value as "left" })}
              >
                <option value="left">Alinhar à esquerda</option>
                <option value="center">Centralizar</option>
                <option value="right">Alinhar à direita</option>
              </select>
              <select
                className={control}
                value={String(text.weight)}
                onChange={(e) => patchText({ weight: Number(e.target.value) })}
              >
                <option value="400">Regular</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">Extra bold</option>
              </select>
              <label className="flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={text.uppercase}
                  onChange={(e) => patchText({ uppercase: e.target.checked })}
                />
                Maiúsculas
              </label>
            </div>
          ) : null}

          {active ? null : (
            <p className="text-[11px] text-[color:var(--muted-foreground)]">
              Área ainda não marcada para “{FIELD_LABEL[field]}”.
            </p>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-3 py-2 text-xs disabled:opacity-60 transition"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? "Salvando mapeamento…" : "Salvar mapeamento"}
          </button>
          {status ? (
            <p className="text-[11px] text-[color:var(--muted-foreground)]">{status}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
