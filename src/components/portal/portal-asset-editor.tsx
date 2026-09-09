/**
 * MODO EDITOR DAS IMAGENS DO PORTAL.
 *
 * Mesmo Portal, dois modos: navegador (somente leitura, o que o
 * investidor vê) e editor (`?modo=editor`), liberado apenas para quem o
 * SERVIDOR autoriza. No editor, trocar uma imagem altera apenas a tela;
 * nada é publicado antes de "Salvar alterações". Remover a substituição
 * devolve a imagem original do Portal.
 */
import { useEffect, useState } from "react";
import { Loader2, Upload, RotateCcw, X } from "lucide-react";
import {
  PORTAL_ASSET_SLOTS,
  discardPortalAssetChanges,
  hasPendingPortalAssetChanges,
  pendingPortalAssetChanges,
  portalAssetUrl,
  portalSlotOriginal,
  setSavedPortalAssets,
  stagePortalAsset,
  stagePortalAssetRemoval,
  subscribePortalAssets,
} from "@/lib/portal/asset-overrides";
import {
  fetchPortalAssetOverrides,
  removePortalAssetOverrideFn,
  savePortalAssetOverrideFn,
} from "@/lib/portal/asset-overrides.functions";

type Staged = { fileName: string; mimeType: string; base64: string };

export function PortalAssetEditor({ unit }: { unit: string }) {
  const [, force] = useState(0);
  const [open, setOpen] = useState(true);
  const [files, setFiles] = useState<Record<string, Staged>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => subscribePortalAssets(() => force((v) => v + 1)), []);

  async function pick(key: string, file: File) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      reader.readAsDataURL(file);
    });
    setFiles((prev) => ({
      ...prev,
      [key]: { fileName: file.name, mimeType: file.type || "image/jpeg", base64 },
    }));
    /** Pré-visualização imediata, ainda não publicada. */
    stagePortalAsset(key, URL.createObjectURL(file));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const { updates, removals } = pendingPortalAssetChanges();
      for (const item of updates) {
        const staged = files[item.key];
        if (!staged) continue;
        await savePortalAssetOverrideFn({
          data: { unit, assetKey: item.key, ...staged },
        });
      }
      for (const key of removals) {
        await removePortalAssetOverrideFn({ data: { unit, assetKey: key } });
      }
      const fresh = await fetchPortalAssetOverrides({ data: { unit } });
      setSavedPortalAssets(fresh);
      setFiles({});
      setMessage("Alterações salvas.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = hasPendingPortalAssetChanges();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[70] rounded-full bg-[color:var(--gold)] px-4 py-2 text-xs font-medium text-black shadow-lg"
      >
        Editar imagens
      </button>
    );
  }

  return (
    <aside className="fixed bottom-5 right-5 z-[70] w-[330px] max-h-[80vh] overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-2xl">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Imagens do Portal</p>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            As trocas só valem depois de salvar.
          </p>
        </div>
        <button type="button" aria-label="Fechar" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <ul className="space-y-2">
        {PORTAL_ASSET_SLOTS.map((slot) => (
          <li
            key={slot.key}
            className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] p-2"
          >
            <img
              src={portalAssetUrl(slot.key, portalSlotOriginal(slot.key))}
              alt=""
              className="h-10 w-14 rounded-md object-cover bg-black/20"
            />
            <span className="flex-1 text-[11px] leading-tight">{slot.label}</span>
            <label className="cursor-pointer rounded-full border border-[color:var(--border)] p-1.5">
              <Upload className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">Substituir imagem de {slot.label}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void pick(slot.key, file);
                }}
              />
            </label>
            <button
              type="button"
              title="Voltar à imagem original"
              aria-label={`Voltar à imagem original de ${slot.label}`}
              onClick={() => stagePortalAssetRemoval(slot.key)}
              className="rounded-full border border-[color:var(--border)] p-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {message && (
        <p className="mt-3 text-[11px] text-[color:var(--muted-foreground)]">{message}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="flex-1 rounded-full bg-[color:var(--gold)] px-3 py-2 text-xs font-medium text-black disabled:opacity-50"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
            </span>
          ) : (
            "Salvar alterações"
          )}
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => {
            discardPortalAssetChanges();
            setFiles({});
          }}
          className="rounded-full border border-[color:var(--border)] px-3 py-2 text-xs disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    </aside>
  );
}
