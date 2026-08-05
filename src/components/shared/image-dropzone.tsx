/**
 * COMPONENTE ÚNICO DE ENVIO DE IMAGEM (colar / arrastar / enviar).
 *
 * É o mesmo componente utilizado pelo Importador Inteligente do CRM e
 * pela IA Criativa. Só o texto muda — a interface, o comportamento e a
 * manutenção são compartilhados.
 */
import { useEffect, useRef } from "react";
import { ClipboardPaste, Loader2, Upload } from "lucide-react";

export type ImageDropzoneProps = {
  /** Texto da faixa de destaque (CTRL + V). */
  title?: string;
  /** Instrução complementar. */
  hint: string;
  /** Rótulo do botão de upload. */
  uploadLabel: string;
  /** Rótulo exibido durante a leitura. */
  readingLabel?: string;
  /** Observação abaixo do botão. */
  note?: string;
  reading?: boolean;
  /** Prévia da imagem já carregada. */
  preview?: string | null;
  /** Escuta CTRL + V enquanto verdadeiro. */
  pasteEnabled?: boolean;
  onFile: (file: File) => void;
  /** "crm" usa os tokens do CRM; "default" usa os tokens do Workspace. */
  variant?: "crm" | "default";
};

export function ImageDropzone({
  title = "Cole a imagem com CTRL + V",
  hint,
  uploadLabel,
  readingLabel = "Lendo a imagem…",
  note,
  reading = false,
  preview = null,
  pasteEnabled = true,
  onFile,
  variant = "default",
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const crm = variant === "crm";

  useEffect(() => {
    if (!pasteEnabled) return;
    const onPaste = (e: ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onFile(file);
          }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteEnabled, onFile]);

  const accent = crm ? "text-[color:var(--crm-accent)]" : "text-primary";
  const muted = crm ? "text-[color:var(--crm-muted)]" : "text-muted-foreground";
  const border = crm ? "border-[color:var(--crm-border)]" : "border-border";

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file?.type.startsWith("image/")) onFile(file);
        }}
        className={[
          "rounded-xl border border-dashed px-4 py-3 text-center",
          crm
            ? "border-[color:var(--crm-accent)]/40 bg-[color:var(--crm-accent-soft)]/50"
            : "border-primary/40 bg-muted/30",
        ].join(" ")}
      >
        <p className={`flex items-center justify-center gap-1.5 text-xs font-medium ${accent}`}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          {title}
        </p>
        <p className={`mt-1 text-[11px] leading-relaxed ${muted}`}>{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={[
          "flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors duration-150",
          border,
          crm
            ? "hover:border-[color:var(--crm-accent)] hover:bg-[color:var(--crm-hover)]"
            : "hover:border-primary hover:bg-muted/50",
        ].join(" ")}
      >
        {reading ? (
          <Loader2 className={`h-5 w-5 animate-spin ${accent}`} />
        ) : (
          <Upload className={`h-5 w-5 ${muted}`} />
        )}
        <span className="text-sm">{reading ? readingLabel : uploadLabel}</span>
        {note ? <span className={`text-[11px] ${muted}`}>{note}</span> : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      {preview ? (
        <img
          src={preview}
          alt="Imagem enviada"
          className={`max-h-32 w-full rounded-lg border object-cover ${border}`}
        />
      ) : null}
    </div>
  );
}
