/**
 * MAPEAMENTO DO MODELO OFICIAL.
 *
 * O Modelo A (Institucional) não é gerado por IA: ele é uma EDIÇÃO
 * automatizada do arquivo enviado pelo administrador. Para editar sem
 * interpretar, o sistema precisa saber apenas onde ficam os campos
 * variáveis — cidade, UF e fotografia principal. Nada além disso é tocado.
 *
 * Todas as coordenadas são frações (0 a 1) do arquivo original, de modo
 * que o mapeamento vale para qualquer resolução do Modelo Oficial.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type TextField = {
  rect: Rect;
  /** Cor do texto aplicado. */
  color: string;
  /** Cor usada para cobrir o texto antigo (vazio = não cobre). */
  cover: string;
  align: "left" | "center" | "right";
  weight: number;
  uppercase: boolean;
  /** Espaçamento entre letras, em fração da altura do bloco. */
  tracking: number;
  /** Família tipográfica do arquivo oficial. */
  font: string;
};

export type OfficialLayout = {
  photo?: Rect;
  /**
   * Selo gráfico do template que fica DENTRO da área da fotografia
   * (ex.: "Vem Aí — Nova Unidade"). É o único elemento do template
   * preservado sobre a foto; o restante da área é substituído.
   */
  badge?: Rect;
  city?: TextField;
  state?: TextField;
  /** A cidade e a UF aparecem duas vezes na arte oficial. */
  city2?: TextField;
  state2?: TextField;
};

export type LayoutFieldKey = "photo" | "badge" | "city" | "state" | "city2" | "state2";

export const LAYOUT_FIELD_KEYS: LayoutFieldKey[] = [
  "photo",
  "badge",
  "city",
  "state",
  "city2",
  "state2",
];

export const TEXT_FIELD_KEYS = ["city", "state", "city2", "state2"] as const;

/** Campos definidos apenas por área (sem tipografia). */
export const RECT_FIELD_KEYS = ["photo", "badge"] as const;

export const FIELD_LABEL: Record<LayoutFieldKey, string> = {
  photo: "Fotografia principal",
  badge: "Selo (preservar)",
  city: "Cidade (1)",
  state: "UF (1)",
  city2: "Cidade (2)",
  state2: "UF (2)",
};

export function defaultTextField(rect: Rect): TextField {
  return {
    rect,
    color: "#FFFFFF",
    cover: "",
    align: "center",
    weight: 700,
    uppercase: true,
    tracking: 0,
    font: "Inter, Helvetica, Arial, sans-serif",
  };
}

export function isRect(value: unknown): value is Rect {
  const r = value as Rect | undefined;
  return (
    !!r &&
    [r.x, r.y, r.w, r.h].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    r.w > 0 &&
    r.h > 0
  );
}

/** Um Modelo A editável exige, no mínimo, o campo Cidade mapeado. */
export function isLayoutReady(layout: OfficialLayout | null | undefined): boolean {
  return Boolean(layout && (isRect(layout.city?.rect) || isRect(layout.photo)));
}

export function parseLayout(value: unknown): OfficialLayout {
  if (!value || typeof value !== "object") return {};
  const raw = value as OfficialLayout;
  const out: OfficialLayout = {};
  if (isRect(raw.photo)) out.photo = raw.photo;
  if (isRect(raw.badge)) out.badge = raw.badge;
  for (const key of TEXT_FIELD_KEYS) {
    const field = raw[key];
    if (field && isRect(field.rect)) {
      out[key] = { ...defaultTextField(field.rect), ...field, rect: field.rect };
    }
  }
  return out;
}
