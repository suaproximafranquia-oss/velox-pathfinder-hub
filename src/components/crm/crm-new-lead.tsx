import { useEffect, useState } from "react";
import { Sparkles, UserPlus, X } from "lucide-react";
import { ImageDropzone } from "@/components/shared/image-dropzone";
import { extractLeadFromImage } from "@/lib/crm/lead-import.functions";
import { createCrmLead, type CrmLeadInput } from "@/lib/crm/lead-intake";
import { nextRoundRobinOwner } from "@/lib/crm/round-robin";
import {
  matchExecutive,
  officialExecutives,
  type ExecutiveOption,
} from "@/lib/crm/executive-match";

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
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-2 text-[11px] font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 hover:shadow-sm active:translate-y-0"
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
  onCreated: (name: string, duplicated?: boolean) => void;
}) {
  const [tab, setTab] = useState<"importador" | "manual">("importador");
  const [fields, setFields] = useState<CrmLeadInput>(EMPTY);
  const [executive, setExecutive] = useState("");
  // Proprietário do Lead identificado no print — o usuário logado nunca
  // define a propriedade, apenas executa a importação.
  const [ownerFromOcr, setOwnerFromOcr] = useState<ExecutiveOption | null>(null);
  const [ownerIssue, setOwnerIssue] = useState<string | null>(null);
  const [ownerChoices, setOwnerChoices] = useState<ExecutiveOption[]>([]);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof CrmLeadInput) => (v: string) =>
    setFields((prev) => ({ ...prev, [k]: v }));

  async function handleFile(file: File) {
    setError(null);
    setReading(true);
    setPasted(false);
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
      const match = matchExecutive(result.executive);
      if (match.confident) {
        setOwnerFromOcr(match.executive);
        setExecutive(match.executive.name);
        setOwnerIssue(null);
        setOwnerChoices([]);
      } else {
        setOwnerFromOcr(null);
        setOwnerIssue(match.reason);
        setOwnerChoices(
          match.candidates.length > 0 ? match.candidates : officialExecutives(),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a imagem.");
    } finally {
      setReading(false);
    }
  }

  /**
   * CTRL + V direto no diálogo: o print copiado da área de transferência é
   * lido imediatamente, sem passar pelo explorador de arquivos. O upload
   * manual continua disponível normalmente.
   */
  useEffect(() => {
    if (tab !== "importador") return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            setPasted(true);
            void handleFile(file);
          }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function submit() {
    // Importação: o proprietário é sempre o Executivo da tabela oficial.
    const resolvedOwner = tab === "importador" ? ownerFromOcr?.id : ownerId;
    if (!resolvedOwner) return;
    const lead = createCrmLead({ fields, source: tab, ownerId: resolvedOwner });
    onCreated(lead.name, lead.duplicated);
    onClose();
  }

  const canSubmit =
    tab === "manual"
      ? fields.name.trim().length > 1
      : Boolean(preview) && !reading && Boolean(ownerFromOcr);

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
          className="cursor-pointer rounded-lg p-1.5 text-[color:var(--crm-muted)] transition-colors duration-150 hover:bg-[color:var(--crm-hover)] hover:text-[color:var(--crm-foreground)]"
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
                "cursor-pointer rounded-t-lg px-3 py-2 text-xs font-medium transition-colors duration-150",
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
              <ImageDropzone
                variant="crm"
                pasteEnabled={false}
                title="Cole o print com CTRL + V"
                hint="Copie a tela (CTRL + C ou Print Screen) e cole aqui. Também é possível arrastar a imagem ou enviar um arquivo."
                uploadLabel="Enviar print da tela do CRM"
                readingLabel={pasted ? "Lendo o print colado…" : "Lendo a imagem…"}
                note="A leitura identifica apenas nome, WhatsApp, e-mail, cidade e executivo."
                reading={reading}
                preview={preview}
                onFile={(file) => void handleFile(file)}
              />
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
                  <div>
                    <span className="text-[11px] font-medium text-[color:var(--crm-muted)]">
                      Executivo responsável identificado
                    </span>
                    {ownerFromOcr ? (
                      <p className="mt-1 rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-3 py-2 text-sm">
                        {ownerFromOcr.name}
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                          {ownerIssue ??
                            "Não foi possível identificar o Executivo com segurança."}{" "}
                          Selecione manualmente o Executivo responsável para concluir.
                          {executive ? ` Texto lido: “${executive}”.` : ""}
                        </p>
                        <select
                          value=""
                          onChange={(e) => {
                            const found = ownerChoices.find((c) => c.id === e.target.value);
                            if (found) {
                              setOwnerFromOcr(found);
                              setExecutive(found.name);
                            }
                          }}
                          className="mt-2 w-full cursor-pointer rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--crm-accent)]"
                        >
                          <option value="">Selecionar Executivo responsável…</option>
                          {ownerChoices.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
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
              className="cursor-pointer rounded-lg border border-[color:var(--crm-border)] px-3 py-2 text-xs font-medium transition-colors duration-150 hover:bg-[color:var(--crm-hover)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="cursor-pointer rounded-lg bg-[color:var(--crm-accent)] px-3 py-2 text-xs font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              {tab === "manual" ? "Salvar Lead" : "Confirmar importação"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Redistribuição automática (Round Robin) — exclusiva da Gestora e do
 * Administrador. Nenhum usuário escolhe o Executivo: apenas confirma.
 */
export function CrmRedistributeRow({
  currentOwnerId,
  onRedistribute,
}: {
  currentOwnerId: string;
  onRedistribute: (executiveId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const next = nextRoundRobinOwner(currentOwnerId);
  if (!next) return null;
  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-background)] px-2.5 py-2">
          <p className="text-[11px] leading-relaxed text-[color:var(--crm-muted)]">
            Confirmar a redistribuição automática deste Lead para{" "}
            <span className="font-semibold text-[color:var(--crm-foreground)]">{next.name}</span>?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 cursor-pointer rounded-lg border border-[color:var(--crm-border)] px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150 hover:bg-[color:var(--crm-hover)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onRedistribute(next.id);
                setConfirming(false);
              }}
              className="flex-1 cursor-pointer rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-y-0"
            >
              Confirmar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full cursor-pointer rounded-lg bg-[color:var(--crm-accent)] px-2.5 py-2 text-[11px] font-medium text-white transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 hover:shadow-sm active:translate-y-0"
        >
          Redistribuir Lead
        </button>
      )}
    </div>
  );
}
