/**
 * EDIÇÃO DE IMAGEM DIRETAMENTE SOBRE A FOTO.
 *
 * O Portal continua sendo UM SÓ. No modo editor (autorizado pelo
 * SERVIDOR), cada imagem editável do conteúdo recebe dois controles
 * discretos no próprio canto superior direito:
 *
 *   [↑]  substituir a foto (fica pendente até salvar);
 *   [×]  remover a substituição e voltar à foto original.
 *
 * Não existe menu lateral de imagens: o administrador olha a foto, edita
 * a foto. Nada é publicado antes de "Salvar alterações", e remover uma
 * substituição nunca apaga o arquivo original do Portal.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Upload, RotateCcw } from "lucide-react";
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
type Spot = { key: string; label: string; rect: DOMRect };

/** Compara `src` exibido com a URL vigente do espaço editável. */
function sameImage(src: string | null, url: string): boolean {
  if (!src || !url) return false;
  if (src === url) return true;
  try {
    return new URL(src, window.location.href).href === new URL(url, window.location.href).href;
  } catch {
    return false;
  }
}

export function PortalInlineImageEditor({
  unit,
  /** Quais espaços deste documento podem ser editados aqui. */
  slotFilter,
}: {
  unit: string;
  slotFilter?: (key: string) => boolean;
}) {
  const [, force] = useState(0);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const filesRef = useRef<Record<string, Staged>>({});

  useEffect(() => subscribePortalAssets(() => force((v) => v + 1)), []);

  /** Localiza, no conteúdo real da página, cada imagem editável visível. */
  const scan = useCallback(() => {
    const slots = PORTAL_ASSET_SLOTS.filter((s) => (slotFilter ? slotFilter(s.key) : true));
    const wanted = slots.map((slot) => ({
      key: slot.key,
      label: slot.label,
      url: portalAssetUrl(slot.key, portalSlotOriginal(slot.key)),
    }));
    const images = Array.from(document.querySelectorAll<HTMLImageElement>("img"));
    const found: Spot[] = [];
    const used = new Set<HTMLImageElement>();
    for (const item of wanted) {
      const el = images.find(
        (img) => !used.has(img) && sameImage(img.getAttribute("src"), item.url),
      );
      if (!el) continue;
      used.add(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 40) continue;
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;
      /**
       * Ao abrir um módulo (overlay/iframe) por cima da página, as imagens
       * da tela anterior continuam no DOM embaixo da camada nova. Sem este
       * corte, os controles da página anterior ficavam "vazando" por cima
       * do módulo aberto. O controle só existe se a própria imagem é o
       * elemento visível no centro dela.
       */
      const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 1);
      const cy = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      if (!top || (top !== el && !el.contains(top))) continue;
      found.push({ key: item.key, label: item.label, rect });
    }
    setSpots(found);
  }, [slotFilter]);

  /** Os controles acompanham a própria imagem durante a rolagem. */
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    run();
    const timer = window.setInterval(run, 700);
    window.addEventListener("scroll", run, true);
    window.addEventListener("resize", run);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener("scroll", run, true);
      window.removeEventListener("resize", run);
    };
  }, [scan]);

  async function pick(key: string, file: File) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      reader.readAsDataURL(file);
    });
    filesRef.current[key] = {
      fileName: file.name,
      mimeType: file.type || "image/jpeg",
      base64,
    };
    /** Pré-visualização imediata, ainda não publicada. */
    stagePortalAsset(key, URL.createObjectURL(file));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const { updates, removals } = pendingPortalAssetChanges();
      for (const item of updates) {
        const staged = filesRef.current[item.key];
        if (!staged) continue;
        await savePortalAssetOverrideFn({ data: { unit, assetKey: item.key, ...staged } });
      }
      for (const key of removals) {
        await removePortalAssetOverrideFn({ data: { unit, assetKey: key } });
      }
      const fresh = await fetchPortalAssetOverrides({ data: { unit } });
      setSavedPortalAssets(fresh);
      filesRef.current = {};
      setMessage("Alterações salvas.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = hasPendingPortalAssetChanges();

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {spots.map((spot) => (
        <div
          key={spot.key}
          className="pointer-events-auto absolute flex gap-1.5 opacity-70 transition-opacity hover:opacity-100"
          style={{
            top: Math.max(spot.rect.top + 8, 8),
            left: spot.rect.right - 78,
          }}
        >
          <label
            title={`Substituir imagem — ${spot.label}`}
            className="cursor-pointer rounded-full bg-black/70 p-2 text-white shadow-lg backdrop-blur"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Substituir imagem de {spot.label}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(spot.key, file);
              }}
            />
          </label>
          <button
            type="button"
            title={`Excluir substituição — ${spot.label}`}
            aria-label={`Excluir substituição de ${spot.label}`}
            onClick={() => stagePortalAssetRemoval(spot.key)}
            className="rounded-full bg-black/70 p-2 text-white shadow-lg backdrop-blur"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}

      <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-black/80 px-4 py-2 text-white shadow-2xl backdrop-blur">
        <span className="text-[11px] text-white/70">
          {message ?? (dirty ? "Alterações pendentes" : "Modo editor de imagens")}
        </span>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="rounded-full bg-[color:var(--gold)] px-3 py-1.5 text-[11px] font-medium text-black disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar alterações"}
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => {
            discardPortalAssetChanges();
            filesRef.current = {};
          }}
          className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] disabled:opacity-40"
        >
          Descartar
        </button>
      </div>
    </div>,
    document.body,
  );
}
