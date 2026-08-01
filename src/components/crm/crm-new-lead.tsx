import { useRef, useState } from "react";
import { Upload, Sparkles, UserPlus, X, Loader2 } from "lucide-react";
import { extractLeadFromImage } from "@/lib/crm/lead-import.functions";
import { createCrmLead, type CrmLeadInput } from "@/lib/crm/lead-intake";

/**
 * Novo Lead (DF 2.4.5) — duas formas permanentes de criação:
 * Importador Inteligente (print do CRM externo) e Cadastro Manual.
 * O CRM funciona integralmente sem qualquer integração externa.
 */

const EMPTY: CrmLeadInput = { name: "", whatsapp: "", email: "", city: "" };

export function CrmNewLeadButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-2 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
    >
      <UserPlus className="h-3.5 w-3.5" />
      Novo Lead
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[color:var(--crm-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
      />
    </label>
  );
}

export function CrmNewLeadDialog({
  ownerId,
  onClose,
  onCreated,
}: {
  ownerId: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [tab, setTab] = useState<"importador" | "manual">("importador");
  const [fields, setFields] = useState<CrmLeadInput>(EMPTY);
  const [executive, setExecutive] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof CrmLeadInput) => (v: string) =>
    setFields((prev) => ({ ...prev, [k]: v }));

  async function handleFile(file: File) {
    setError(null);
    setReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });
      setPreview(dataUrl);
      const result = await extractLeadFromImage({ data: { imageDataUrl: dataUrl } });
      setFields({
        name: result.name,
        whatsapp: result.whatsapp,
        email: result.email,
        city: result.city,
      });
      setExecutive(result.executive);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a imagem.");
    } finally {
      setReading(false);
    }
  }

  function submit() {
    const lead = createCrmLead({ fields, source: tab, ownerId });
    onCreated(lead.name);
    onClose();
  }

  const canSubmit =
    tab === "manual"
      ? fields.name.trim().length > 1
      : Boolean(preview) && !reading;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Novo Lead"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[color:var(--crm-border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Novo Lead</h2>
            <p className="mt-0.5 text-xs text-[color:var(--crm-muted)]">
              Crie o relacionamento a partir de um print ou pelo cadastro manual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-[color:var(--crm-muted)] hover:bg-[color:var(--crm-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex gap-1 border-b border-[color:var(--crm-border)] px-5 pt-3">
          {(
            [
              ["importador", "Importador Inteligente"],
              ["manual", "Cadastro manual"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "rounded-t-lg px-3 py-2 text-xs font-medium transition-colors",
                tab === key
                  ? "border-b-2 border-[color:var(--crm-accent)] text-[color:var(--crm-accent)]"
                  : "text-[color:var(--crm-muted)] hover:bg-[color:var(--crm-hover)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 px-5 py-4">
          {tab === "importador" ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[color:var(--crm-border)] px-4 py-6 text-center transition-colors hover:bg-[color:var(--crm-hover)]"
              >
                {reading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[color:var(--crm-accent)]" />
                ) : (
                  <Upload className="h-5 w-5 text-[color:var(--crm-muted)]" />
                )}
                <span className="text-sm">
                  {reading ? "Lendo a imagem…" : "Enviar print da tela do CRM"}
                </span>
                <span className="text-[11px] text-[color:var(--crm-muted)]">
                  A leitura identifica apenas nome, WhatsApp, e-mail, cidade e executivo.
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
              {preview ? (
                <img
                  src={preview}
                  alt="Print enviado para leitura"
                  className="max-h-32 w-full rounded-lg border border-[color:var(--crm-border)] object-cover"
                />
              ) : null}
              {error ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
              ) : null}
              {preview ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--crm-muted)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Confira os dados identificados antes de confirmar. Campos vazios viram “—”.
                  </p>
                  <Field label="Nome" value={fields.name} onChange={set("name")} />
                  <Field label="WhatsApp" value={fields.whatsapp} onChange={set("whatsapp")} />
                  <Field label="E-mail" value={fields.email} onChange={set("email")} />
                  <Field label="Cidade" value={fields.city} onChange={set("city")} />
                  <Field
                    label="Executivo responsável identificado"
                    value={executive}
                    onChange={setExecutive}
                    placeholder="—"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <Field label="Nome" value={fields.name} onChange={set("name")} />
              <Field label="WhatsApp" value={fields.whatsapp} onChange={set("whatsapp")} />
              <Field label="E-mail" value={fields.email} onChange={set("email")} type="email" />
              <Field label="Cidade" value={fields.city} onChange={set("city")} />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--crm-border)] px-5 py-3.5">
          <p className="text-[11px] text-[color:var(--crm-muted)]">
            Lead particular do Executivo — fora da redistribuição automática.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[color:var(--crm-border)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--crm-hover)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="rounded-lg bg-[color:var(--crm-accent)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {tab === "manual" ? "Salvar Lead" : "Confirmar importação"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Redistribuição manual — exclusiva da Gestora/Administrador. */
export function CrmRedistributeRow({
  executives,
  currentOwnerId,
  onRedistribute,
}: {
  executives: { id: string; name: string }[];
  currentOwnerId: string;
  onRedistribute: (executiveId: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-2.5 py-2 text-xs outline-none"
      >
        <option value="">Selecionar novo Executivo…</option>
        {executives
          .filter((e) => e.id !== currentOwnerId)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
      </select>
      <button
        type="button"
        disabled={!value}
        onClick={() => {
          onRedistribute(value);
          setValue("");
        }}
        className="w-full rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-2 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Redistribuir Lead
      </button>
    </div>
  );
}
