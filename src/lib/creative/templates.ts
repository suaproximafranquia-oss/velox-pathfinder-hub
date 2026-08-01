/**
 * Templates OFICIAIS da IA Criativa.
 *
 * Cada template é uma composição vetorial fechada, construída apenas com
 * os tokens de `brand.ts`. A IA fornece o texto; o layout, as cores e a
 * tipografia permanecem sempre dentro do padrão aprovado da marca.
 */
import { BRAND, type CreativeModel } from "./brand";

export type UnitBrief = {
  /** Nome da unidade (ex.: "Velox São José do Rio Preto"). */
  unit: string;
  city: string;
  state: string;
  address?: string;
  openingDate?: string;
  phone?: string;
  /** Textos produzidos pela IA dentro do padrão institucional. */
  headline: string;
  subheadline: string;
  supporting: string;
  /** Fotografia institucional da cidade (data URI). Campo variável. */
  photo?: string | null;
};

const W = 1080;
const H = 1350;

function esc(v: string): string {
  return (v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Quebra um texto em linhas com um limite aproximado de caracteres. */
function wrap(text: string, max: number, limit = 4): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
      if (lines.length === limit) break;
    } else {
      line = `${line} ${w}`;
    }
  }
  if (lines.length < limit && line.trim()) lines.push(line.trim());
  return lines.filter(Boolean);
}

function tspans(lines: string[], x: number, y: number, lineHeight: number): string {
  return lines
    .map((l, i) => `<tspan x="${x}" y="${y + i * lineHeight}">${esc(l)}</tspan>`)
    .join("");
}

function logoBlock(logoHref: string | null, x: number, y: number, h: number): string {
  if (logoHref) {
    return `<image href="${logoHref}" x="${x}" y="${y}" height="${h}" preserveAspectRatio="xMinYMid meet"/>`;
  }
  return `<text x="${x}" y="${y + h * 0.75}" font-family="${BRAND.displayFont}" font-size="${h}" letter-spacing="6" fill="${BRAND.white}">VELOX</text>`;
}

/**
 * Camada fotográfica — único elemento visual variável da arte. A
 * fotografia entra sempre sob o mesmo véu institucional, preservando
 * integralmente cores, contraste e legibilidade do padrão oficial.
 */
function photoLayer(photo: string | null | undefined, veil: string): string {
  if (!photo) return "";
  return `<g clip-path="url(#frame)">
    <image href="${photo}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect width="${W}" height="${H}" fill="${veil}" fill-opacity="0.84"/>
  </g>`;
}

const CLIP = `<clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>`;

/** MODELO A — Institucional: sóbrio, corporativo, credibilidade. */
function institucional(brief: UnitBrief, logoHref: string | null): string {
  const head = wrap(brief.headline, 22, 3);
  const sub = wrap(brief.subheadline, 44, 3);
  const support = wrap(brief.supporting, 52, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND.navy}"/>
      <stop offset="100%" stop-color="${BRAND.navyDeep}"/>
    </linearGradient>
    ${CLIP}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgA)"/>
  ${photoLayer(brief.photo, BRAND.navyDeep)}
  <rect x="52" y="52" width="${W - 104}" height="${H - 104}" fill="none" stroke="${BRAND.gold}" stroke-opacity="0.45" stroke-width="2"/>
  ${logoBlock(logoHref, 104, 116, 68)}
  <text x="104" y="236" font-family="${BRAND.bodyFont}" font-size="22" letter-spacing="7" fill="${BRAND.gold}">COMUNICADO OFICIAL</text>
  <line x1="104" y1="278" x2="${W - 104}" y2="278" stroke="${BRAND.gold}" stroke-opacity="0.35" stroke-width="1"/>
  <text font-family="${BRAND.displayFont}" font-size="82" fill="${BRAND.white}">${tspans(head, 104, 400, 96)}</text>
  <text font-family="${BRAND.bodyFont}" font-size="34" fill="${BRAND.goldSoft}">${tspans(sub, 104, 400 + head.length * 96 + 40, 46)}</text>
  <text font-family="${BRAND.bodyFont}" font-size="26" fill="${BRAND.gray}">${tspans(support, 104, 400 + head.length * 96 + 40 + sub.length * 46 + 60, 40)}</text>
  <rect x="104" y="${H - 300}" width="${W - 208}" height="1" fill="${BRAND.gold}" fill-opacity="0.35"/>
  <text x="104" y="${H - 240}" font-family="${BRAND.bodyFont}" font-size="30" fill="${BRAND.white}">${esc(brief.unit)}</text>
  <text x="104" y="${H - 196}" font-family="${BRAND.bodyFont}" font-size="26" fill="${BRAND.gray}">${esc([brief.city, brief.state].filter(Boolean).join(" — "))}</text>
  ${brief.address ? `<text x="104" y="${H - 156}" font-family="${BRAND.bodyFont}" font-size="24" fill="${BRAND.gray}">${esc(brief.address)}</text>` : ""}
  ${brief.openingDate ? `<text x="104" y="${H - 116}" font-family="${BRAND.bodyFont}" font-size="24" fill="${BRAND.goldSoft}">Início das operações: ${esc(brief.openingDate)}</text>` : ""}
  <text x="${W - 104}" y="${H - 116}" text-anchor="end" font-family="${BRAND.bodyFont}" font-size="24" letter-spacing="3" fill="${BRAND.gold}">${esc(brief.phone || BRAND.site)}</text>
</svg>`;
}

/** MODELO B — Marketing: impacto visual, destaque comercial. */
function marketing(brief: UnitBrief, logoHref: string | null): string {
  const head = wrap(brief.headline, 16, 3);
  const sub = wrap(brief.subheadline, 34, 2);
  const support = wrap(brief.supporting, 44, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.navyDeep}"/>
      <stop offset="55%" stop-color="${BRAND.navy}"/>
      <stop offset="100%" stop-color="${BRAND.navyDeep}"/>
    </linearGradient>
    <linearGradient id="goldB" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${BRAND.gold}"/>
      <stop offset="100%" stop-color="${BRAND.goldSoft}"/>
    </linearGradient>
    ${CLIP}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgB)"/>
  ${photoLayer(brief.photo, BRAND.navy)}
  <circle cx="${W - 60}" cy="180" r="320" fill="${BRAND.gold}" fill-opacity="0.10"/>
  <circle cx="60" cy="${H - 120}" r="260" fill="${BRAND.gold}" fill-opacity="0.07"/>
  <rect x="0" y="0" width="14" height="${H}" fill="url(#goldB)"/>
  ${logoBlock(logoHref, 96, 110, 76)}
  <rect x="96" y="240" width="290" height="56" rx="28" fill="url(#goldB)"/>
  <text x="241" y="278" text-anchor="middle" font-family="${BRAND.bodyFont}" font-size="24" font-weight="700" letter-spacing="4" fill="${BRAND.navyDeep}">NOVA UNIDADE</text>
  <text font-family="${BRAND.displayFont}" font-size="112" font-weight="700" fill="${BRAND.white}">${tspans(head, 96, 440, 122)}</text>
  <text font-family="${BRAND.bodyFont}" font-size="42" font-weight="600" fill="${BRAND.goldSoft}">${tspans(sub, 96, 440 + head.length * 122 + 40, 56)}</text>
  <text font-family="${BRAND.bodyFont}" font-size="28" fill="${BRAND.white}" fill-opacity="0.82">${tspans(support, 96, 440 + head.length * 122 + 40 + sub.length * 56 + 60, 42)}</text>
  <rect x="96" y="${H - 268}" width="${W - 192}" height="120" rx="18" fill="${BRAND.white}" fill-opacity="0.06" stroke="${BRAND.gold}" stroke-opacity="0.4"/>
  <text x="130" y="${H - 208}" font-family="${BRAND.bodyFont}" font-size="30" font-weight="600" fill="${BRAND.white}">${esc([brief.city, brief.state].filter(Boolean).join(" / "))}</text>
  <text x="130" y="${H - 168}" font-family="${BRAND.bodyFont}" font-size="24" fill="${BRAND.gray}">${esc(brief.address || brief.unit)}</text>
  <text x="${W - 130}" y="${H - 188}" text-anchor="end" font-family="${BRAND.bodyFont}" font-size="30" font-weight="700" fill="${BRAND.gold}">${esc(brief.phone || BRAND.site)}</text>
  ${brief.openingDate ? `<text x="96" y="${H - 92}" font-family="${BRAND.bodyFont}" font-size="26" letter-spacing="3" fill="${BRAND.goldSoft}">INAUGURAÇÃO ${esc(brief.openingDate.toUpperCase())}</text>` : ""}
</svg>`;
}

export function renderTemplate(
  model: CreativeModel,
  brief: UnitBrief,
  logoHref: string | null,
): string {
  return model === "institucional"
    ? institucional(brief, logoHref)
    : marketing(brief, logoHref);
}