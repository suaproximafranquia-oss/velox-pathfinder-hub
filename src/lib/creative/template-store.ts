/**
 * TEMPLATES DA IA CRIATIVA — armazenamento por modelo.
 *
 * Cada modelo possui o seu próprio template gráfico, totalmente
 * independente: substituir o template do Modelo A nunca altera o do
 * Modelo B. O arquivo enviado pelo administrador é guardado na nuvem
 * (tabela `creative_templates`) e replicado em cache local para leitura
 * imediata. Enquanto o Modelo A não recebe upload, o template oficial
 * embutido continua valendo.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CreativeModel } from "./brand";
import { OFFICIAL_TEMPLATE_URL } from "./official-template";
import { buildConfig, type TemplateConfig } from "./calibration";

export type CreativeTemplate = {
  model: CreativeModel;
  fileName: string;
  dataUrl: string;
  updatedAt: string;
  builtIn?: boolean;
  /** Configuração própria do template (calibração automática). */
  config?: TemplateConfig;
};

const CACHE_KEY = "velox.creative.templates.v2";

type Cache = Partial<Record<CreativeModel, CreativeTemplate>>;

function readCache(): Cache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}") as Cache;
  } catch {
    return {};
  }
}

function writeCache(model: CreativeModel, template: CreativeTemplate | null) {
  if (typeof window === "undefined") return;
  const cache = readCache();
  if (template) cache[model] = template;
  else delete cache[model];
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* cache é apenas conveniência */
  }
}

/** Template em uso por um modelo (nuvem → cache → oficial embutido). */
export async function getTemplate(model: CreativeModel): Promise<CreativeTemplate | null> {
  try {
    const { data } = await supabase
      .from("creative_templates")
      .select("model, file_name, data_url, updated_at, config, width, height")
      .eq("model", model)
      .maybeSingle();
    if (data?.data_url) {
      const stored = (data.config ?? null) as TemplateConfig | null;
      const config =
        stored && stored.width
          ? stored
          : await calibrateFrom(model, data.data_url, data.width, data.height);
      const template: CreativeTemplate = {
        model,
        fileName: data.file_name,
        dataUrl: data.data_url,
        updatedAt: data.updated_at,
        ...(config ? { config } : {}),
      };
      writeCache(model, template);
      return template;
    }
    writeCache(model, null);
  } catch {
    const cached = readCache()[model];
    if (cached) return cached;
  }
  if (model === "institucional") {
    const config = await calibrateFrom(model, OFFICIAL_TEMPLATE_URL, null, null);
    return {
      model,
      fileName: "velox-template-oficial.png",
      dataUrl: OFFICIAL_TEMPLATE_URL,
      updatedAt: "",
      builtIn: true,
      ...(config ? { config } : {}),
    };
  }
  return null;
}

async function calibrateFrom(
  model: CreativeModel,
  dataUrl: string,
  width: number | null,
  height: number | null,
): Promise<TemplateConfig | null> {
  if (width && height) return buildConfig(model, width, height);
  if (typeof window === "undefined") return null;
  const size = await measure(dataUrl);
  if (!size.width || !size.height) return null;
  return buildConfig(model, size.width, size.height);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function measure(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

/** Envia (ou substitui) o template de UM modelo, sem tocar no outro. */
export async function uploadTemplate(
  model: CreativeModel,
  file: File,
  updatedBy?: string,
): Promise<CreativeTemplate> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie o template em imagem (PNG ou JPG).");
  }
  const dataUrl = await fileToDataUrl(file);
  const { width, height } = await measure(dataUrl);
  // Calibração automática: as áreas variáveis são recalculadas para a
  // resolução real do arquivo. O layout gráfico nunca é alterado.
  const config = buildConfig(model, width, height);
  const template: CreativeTemplate = {
    model,
    fileName: file.name,
    dataUrl,
    updatedAt: new Date().toISOString(),
    config,
  };
  writeCache(model, template);
  const { error } = await supabase.from("creative_templates").upsert(
    {
      model,
      file_name: file.name,
      content_type: file.type,
      data_url: dataUrl,
      width,
      height,
      config: config as unknown as Record<string, unknown>,
      updated_by: updatedBy ?? null,
      updated_at: template.updatedAt,
    },
    { onConflict: "model" },
  );
  if (error) {
    throw new Error(
      "O template foi aplicado neste navegador, mas não pôde ser publicado para a equipe.",
    );
  }
  return template;
}
