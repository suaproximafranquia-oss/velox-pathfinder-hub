import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Wand2,
  Loader2,
  Download,
  CloudUpload,
  Eye,
  Check,
  FolderTree,
  Lock,
} from "lucide-react";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { getSession, type ExecutiveSession } from "@/lib/executive-auth";
import {
  CREATIVE_CATEGORIES,
  CREATIVE_MODEL_LABEL,
  type CreativeModel,
} from "@/lib/creative/brand";
import { renderTemplate, type UnitBrief } from "@/lib/creative/templates";
import {
  officialLogoHref,
  svgToDataUrl,
  svgToPngBase64,
  downloadBase64,
  slugify,
} from "@/lib/creative/render";
import { listCreativeHistory, recordCreative } from "@/lib/creative/history";
import {
  generateCreativeCopy,
  saveCreativeArt,
  saveBrandAsset,
  type BrandAssetKind,
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
type FormState = {
  city: string;
  state: string;
};

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
  const [logo, setLogo] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (!s) return void navigate({ to: "/executivo" });
    setSession(s);
    void officialLogoHref().then(setLogo);
  }, [navigate]);

  const history = useMemo(() => {
    void historyTick;
    return session ? listCreativeHistory(session.userId).slice(0, 8) : [];
  }, [session, historyTick]);

  const arts = useMemo(() => {
    if (!copy) return null;
    const base = {
      unit: unitName(form),
      city: form.city,
      state: form.state,
    };
    const build = (model: CreativeModel): { svg: string; brief: UnitBrief } => {
      const brief: UnitBrief = { ...base, ...copy[model] };
      return { svg: renderTemplate(model, brief, logo), brief };
    };
    return {
      institucional: build("institucional"),
      marketing: build("marketing"),
    };
  }, [copy, form, logo]);

  async function generate() {
    if (busy) return;
    if (!form.unit.trim() || !form.city.trim()) {
      setError("Informe ao menos o nome da unidade e a cidade.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await generateCreativeCopy({
        data: {
          unit: form.unit.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          address: form.address.trim() || undefined,
          openingDate: form.openingDate.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      setCopy(res);
    } catch {
      setError("Não foi possível gerar as peças agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return null;

  return (
    <ExecutiveShell session={session} title="IA Criativa">
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
        <BriefForm
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onGenerate={generate}
          busy={busy}
          error={error}
          history={history}
        />

        <section className="space-y-5">
          <header className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-6 py-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[color:var(--gold)]" />
              <h2 className="font-display text-lg">Padrão oficial da marca</h2>
            </div>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)] leading-relaxed">
              A IA Criativa opera exclusivamente dentro da identidade visual
              aprovada — cores, tipografia, logotipo e templates oficiais. Ela
              nunca cria uma identidade nova; apenas aplica o padrão Velox.
            </p>
          </header>

          {arts ? (
            <div className="grid gap-5 md:grid-cols-2">
              <ArtCard
                model="institucional"
                svg={arts.institucional.svg}
                fileBase={`${slugify(form.unit)}-institucional`}
                session={session}
                unit={form.unit}
                city={form.city}
                onSaved={() => setHistoryTick((v) => v + 1)}
              />
              <ArtCard
                model="marketing"
                svg={arts.marketing.svg}
                fileBase={`${slugify(form.unit)}-marketing`}
                session={session}
                unit={form.unit}
                city={form.city}
                onSaved={() => setHistoryTick((v) => v + 1)}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)]/30 p-12 text-center">
              <p className="font-display text-xl">Nenhuma peça gerada ainda.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-foreground)]">
                Informe os dados da nova unidade. As duas versões oficiais —
                Institucional e Marketing — serão apresentadas lado a lado.
              </p>
            </div>
          )}

          <CategoriesRoadmap />
        </section>
      </div>
    </ExecutiveShell>
  );
}

function BriefForm({
  form,
  onChange,
  onGenerate,
  busy,
  error,
  history,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onGenerate: () => void;
  busy: boolean;
  error: string | null;
  history: ReturnType<typeof listCreativeHistory>;
}) {
  const field =
    "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 px-3 py-2 text-sm outline-none focus:border-[color:var(--gold)]/60 transition";
  const label =
    "text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]";
  return (
    <aside className="space-y-5">
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-[color:var(--gold)]" />
          <h2 className="font-display text-lg">Nova unidade</h2>
        </div>

        <div className="space-y-1.5">
          <span className={label}>Unidade</span>
          <input
            className={field}
            value={form.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="Velox São José do Rio Preto"
          />
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
        <div className="space-y-1.5">
          <span className={label}>Endereço</span>
          <input
            className={field}
            value={form.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Av. Brasil, 1200 — Centro"
          />
        </div>
        <div className="space-y-1.5">
          <span className={label}>Inauguração</span>
          <input
            className={field}
            value={form.openingDate}
            onChange={(e) => onChange({ openingDate: e.target.value })}
            placeholder="12 de agosto"
          />
        </div>
        <div className="space-y-1.5">
          <span className={label}>Contato</span>
          <input
            className={field}
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="(17) 99772-7337"
          />
        </div>
        <div className="space-y-1.5">
          <span className={label}>Observações</span>
          <textarea
            className={`${field} min-h-[84px] resize-y`}
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Informações adicionais aprovadas para a peça."
          />
        </div>

        {error ? (
          <p className="text-xs text-[color:var(--destructive)]">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--accent)] px-4 py-2.5 text-sm text-[color:var(--foreground)] hover:border-[color:var(--gold)] disabled:opacity-60 transition"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {busy ? "Gerando peças oficiais…" : "Gerar Modelos A e B"}
        </button>
      </section>

      {history.length > 0 ? (
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
          <h3 className="font-display text-base">Histórico recente</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate text-[color:var(--muted-foreground)]">
                  {h.unit} — {CREATIVE_MODEL_LABEL[h.model].replace("Modelo ", "")}
                </span>
                {h.driveLink ? (
                  <a
                    href={h.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-[color:var(--gold)] hover:underline"
                  >
                    Drive
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function ArtCard({
  model,
  svg,
  fileBase,
  session,
  unit,
  city,
  onSaved,
}: {
  model: CreativeModel;
  svg: string;
  fileBase: string;
  session: ExecutiveSession;
  unit: string;
  city: string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const preview = useMemo(() => svgToDataUrl(svg), [svg]);
  const fileName = `${fileBase}.png`;

  async function download() {
    const png = await svgToPngBase64(svg);
    downloadBase64(png, fileName);
    recordCreative({
      userId: session.userId,
      category: "unidade",
      model,
      unit,
      city,
      fileName,
    });
    onSaved();
  }

  async function saveToDrive() {
    if (saving) return;
    setSaving(true);
    setFailed(null);
    try {
      const png = await svgToPngBase64(svg);
      const res = await saveCreativeArt({
        data: { name: fileName, contentBase64: png, mimeType: "image/png" },
      });
      setSaved(res.webViewLink ?? "");
      recordCreative({
        userId: session.userId,
        category: "unidade",
        model,
        unit,
        city,
        fileName,
        driveLink: res.webViewLink,
      });
      onSaved();
    } catch {
      setFailed("Conecte sua conta corporativa nas Configurações para salvar no Drive.");
    } finally {
      setSaving(false);
    }
  }

  const action =
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--gold)]/50 transition";

  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 overflow-hidden flex flex-col">
      <header className="border-b border-[color:var(--border)] px-5 py-3">
        <h3 className="font-display text-base">{CREATIVE_MODEL_LABEL[model]}</h3>
        <p className="text-xs text-[color:var(--muted-foreground)]">
          {model === "institucional"
            ? "Comunicação oficial, elegância e credibilidade."
            : "Impacto visual e foco em divulgação comercial."}
        </p>
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
        <a href={preview} target="_blank" rel="noreferrer" className={action}>
          <Eye className="h-3.5 w-3.5" /> Visualizar
        </a>
        <button type="button" onClick={() => void download()} className={action}>
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <button type="button" onClick={() => void saveToDrive()} className={action} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved !== null ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          {saved !== null ? "Salvo no Drive" : "Salvar no Drive"}
        </button>
        {failed ? (
          <p className="w-full text-[11px] text-[color:var(--muted-foreground)]">{failed}</p>
        ) : null}
      </footer>
    </article>
  );
}

function CategoriesRoadmap() {
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6">
      <div className="flex items-center gap-2">
        <FolderTree className="h-4 w-4 text-[color:var(--gold)]" />
        <h2 className="font-display text-lg">Categorias da biblioteca</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CREATIVE_CATEGORIES.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{c.label}</span>
              <span
                className={
                  c.status === "ativo"
                    ? "rounded-full border border-[color:var(--gold)]/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--gold)]"
                    : "rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]"
                }
              >
                {c.status === "ativo" ? "Ativo" : "Previsto"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)] leading-relaxed">
              {c.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}