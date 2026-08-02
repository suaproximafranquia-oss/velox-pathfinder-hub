/**
 * DEF 3.0.1 §1 — Sistema oficial de temas do CRM.
 *
 * Cinco temas homologados. O Atlas Clássico é o padrão de todos os
 * usuários. A preferência é salva no perfil do usuário e aplicada
 * instantaneamente, sem recarregar a página.
 */
import type { CrmBranding } from "@/lib/crm/theme";
import { notifySync } from "@/lib/sync-bus";

import tema1 from "@/assets/crm-themes/tema-1.png.asset.json";
import tema2 from "@/assets/crm-themes/tema-2.png.asset.json";
import tema3 from "@/assets/crm-themes/tema-3.png.asset.json";
import tema4 from "@/assets/crm-themes/tema-4.png.asset.json";
import tema5 from "@/assets/crm-themes/tema-5.png.asset.json";

export type CrmThemeId =
  | "atlas_classico"
  | "atlas_tech"
  | "atlas_premium"
  | "atlas_light"
  | "atlas_white";

export type CrmTheme = {
  id: CrmThemeId;
  label: string;
  description: string;
  /** Miniatura oficial exibida em Meu Perfil › Personalização do CRM. */
  thumbnail: string;
  colors: CrmBranding["colors"];
};

export const CRM_THEMES: CrmTheme[] = [
  {
    id: "atlas_classico",
    label: "Atlas Clássico",
    description: "Tema padrão do sistema. Elegância e autoridade.",
    thumbnail: tema1.url,
    colors: {
      primary: "#d8a93a",
      primaryForeground: "#0a0a0a",
      secondary: "#6b5a28",
      secondaryForeground: "#f5e9c8",
      background: "#08080a",
      surface: "#111112",
      foreground: "#f2ead6",
      muted: "#9a917c",
      border: "#2a2418",
      accent: "#d8a93a",
      accentSoft: "#2a2110",
      hover: "#1a1710",
    },
  },
  {
    id: "atlas_tech",
    label: "Atlas Tech",
    description: "Interface tecnológica com acento azul luminoso.",
    thumbnail: tema2.url,
    colors: {
      primary: "#2f80ff",
      primaryForeground: "#ffffff",
      secondary: "#1b3a6b",
      secondaryForeground: "#dbe9ff",
      background: "#040812",
      surface: "#0a1120",
      foreground: "#e6efff",
      muted: "#8299bd",
      border: "#15243f",
      accent: "#3d9bff",
      accentSoft: "#0f2murmur",
      hover: "#101c31",
    },
  },
  {
    id: "atlas_premium",
    label: "Atlas Premium",
    description: "Ambiente escuro com acento esmeralda.",
    thumbnail: tema3.url,
    colors: {
      primary: "#1fbf72",
      primaryForeground: "#04140c",
      secondary: "#12archives",
      secondaryForeground: "#d6ffe9",
      background: "#03110a",
      surface: "#08190f",
      foreground: "#e2f7ea",
      muted: "#84a993",
      border: "#123c26",
      accent: "#28d982",
      accentSoft: "#0c2c1b",
      hover: "#0d2417",
    },
  },
  {
    id: "atlas_light",
    label: "Atlas Light",
    description: "Superfícies claras sobre fundo grafite suave.",
    thumbnail: tema4.url,
    colors: {
      primary: "#16306b",
      primaryForeground: "#ffffff",
      secondary: "#5b6274",
      secondaryForeground: "#ffffff",
      background: "#c9ccd2",
      surface: "#f3f4f6",
      foreground: "#1b2130",
      muted: "#5f6675",
      border: "#d7dae0",
      accent: "#1d3f8f",
      accentSoft: "#e3e8f4",
      hover: "#e9ebef",
    },
  },
  {
    id: "atlas_white",
    label: "Atlas White",
    description: "Interface branca, limpa e de leitura máxima.",
    thumbnail: tema5.url,
    colors: {
      primary: "#1d4ed8",
      primaryForeground: "#ffffff",
      secondary: "#64748b",
      secondaryForeground: "#ffffff",
      background: "#f7f8fa",
      surface: "#ffffff",
      foreground: "#111827",
      muted: "#64748b",
      border: "#e5e7eb",
      accent: "#2563eb",
      accentSoft: "#e8f0ff",
      hover: "#f1f3f7",
    },
  },
];

export const DEFAULT_CRM_THEME: CrmThemeId = "atlas_classico";

export function findCrmTheme(id: string | null | undefined): CrmTheme {
  return CRM_THEMES.find((t) => t.id === id) ?? CRM_THEMES[0]!;
}

const KEY = "crm.theme.preference.v1";

type Store = Record<string, CrmThemeId>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

/** Tema salvo no perfil do usuário — Atlas Clássico quando ausente. */
export function getUserCrmTheme(userId: string | null | undefined): CrmThemeId {
  if (!userId) return DEFAULT_CRM_THEME;
  return read()[userId] ?? DEFAULT_CRM_THEME;
}

/** Salva automaticamente e avisa todas as telas abertas na mesma hora. */
export function setUserCrmTheme(userId: string, theme: CrmThemeId): void {
  if (typeof window === "undefined") return;
  const store = read();
  store[userId] = theme;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* armazenamento indisponível */
  }
  notifySync("theme");
}