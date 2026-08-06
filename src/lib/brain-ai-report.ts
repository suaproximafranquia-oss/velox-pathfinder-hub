/**
 * RELATÓRIO INTELIGENTE — Brain Analytics.
 *
 * Gera um PDF executivo institucional (não um documento textual):
 * capa, cabeçalho, rodapé, cards de indicadores, funil, barras de
 * conversão, tabela comparativa, insights e a leitura da IA Executiva.
 * Todos os números vêm do Brain Analytics / KPI Manager.
 */
import { jsPDF } from "jspdf";
import { WORKSPACE } from "@/config/workspace";
import type { BrainAnalytics } from "./brain-analytics";
import type { BrainSnapshot } from "./brain-data";
import type { BrainReport } from "./brain-ai.functions";

const NAVY: [number, number, number] = [11, 27, 51];
const NAVY_DEEP: [number, number, number] = [6, 15, 31];
const GOLD: [number, number, number] = [201, 162, 39];
const TEXT: [number, number, number] = [38, 44, 58];
const MUTED: [number, number, number] = [124, 132, 148];
const LINE: [number, number, number] = [222, 225, 233];
const SOFT: [number, number, number] = [246, 247, 250];
const GREEN: [number, number, number] = [34, 122, 84];
const RED: [number, number, number] = [176, 58, 46];
const AMBER: [number, number, number] = [186, 118, 20];

const M = 16; // margem lateral
const TOP = 30;

type Ctx = { doc: jsPDF; w: number; h: number; title: string };

function header(c: Ctx) {
  const { doc, w } = c;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GOLD);
  doc.text("BRAIN ANALYTICS", M, 11, { charSpace: 1.6 });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(235, 238, 245);
  doc.text(c.title.toUpperCase().slice(0, 60), w - M, 11, { align: "right", charSpace: 0.8 });
}

function footer(c: Ctx, page: number) {
  const { doc, w, h } = c;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, h - 14, w - M, h - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(WORKSPACE.poweredBy, M, h - 9);
  doc.text(`Relatório Inteligente · página ${page}`, w - M, h - 9, { align: "right" });
}

function newPage(c: Ctx, state: { page: number }): number {
  footer(c, state.page);
  c.doc.addPage();
  state.page += 1;
  header(c);
  return TOP;
}

function room(c: Ctx, state: { page: number }, y: number, need: number): number {
  return y + need > c.h - 20 ? newPage(c, state) : y;
}

function sectionTitle(c: Ctx, state: { page: number }, y: number, eyebrow: string, title: string): number {
  y = room(c, state, y, 20);
  const { doc } = c;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD);
  doc.text(eyebrow.toUpperCase(), M, y, { charSpace: 1.6 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(title, M, y + 7);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(M, y + 10.5, M + 22, y + 10.5);
  return y + 18;
}

function paragraph(c: Ctx, state: { page: number }, y: number, text: string, size = 9.5): number {
  const { doc, w } = c;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...TEXT);
  const lines = doc.splitTextToSize(text, w - M * 2) as string[];
  for (const l of lines) {
    y = room(c, state, y, 6);
    doc.text(l, M, y);
    y += size * 0.52;
  }
  return y + 3;
}

const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const int = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

/* ----------------------------- blocos visuais ---------------------------- */

function kpiCards(c: Ctx, state: { page: number }, y: number, snapshot: BrainSnapshot): number {
  const { doc, w } = c;
  const cols = 3;
  const gap = 5;
  const cw = (w - M * 2 - gap * (cols - 1)) / cols;
  const ch = 25;
  snapshot.kpis.forEach((k, i) => {
    const col = i % cols;
    if (col === 0) y = room(c, state, y, ch + gap);
    const x = M + col * (cw + gap);
    // sombra suave
    doc.setFillColor(232, 235, 241);
    doc.roundedRect(x + 0.7, y + 0.9, cw, ch, 2.4, 2.4, "F");
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cw, ch, 2.4, 2.4, "FD");
    doc.setFillColor(...GOLD);
    doc.rect(x, y, 1.6, ch, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(k.label.toUpperCase(), x + 5.5, y + 7.5, { charSpace: 0.8 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14.5);
    doc.setTextColor(...NAVY);
    doc.text(String(k.value), x + 5.5, y + 16.5);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(x + 5.5, y + 18.6, x + cw - 5, y + 18.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...MUTED);
    doc.text((doc.splitTextToSize(k.description, cw - 9) as string[])[0] ?? "", x + 5.5, y + 22.3);
    if (col === cols - 1) y += ch + gap;
  });
  if (snapshot.kpis.length % cols !== 0) y += ch + gap;
  return y + 2;
}

/* --------------------- painel executivo (destaques) ---------------------- */

type Highlight = { label: string; value: string; note: string; tone: "good" | "warn" | "bad" };

function buildHighlights(a: BrainAnalytics, snapshot: BrainSnapshot): Highlight[] {
  const out: Highlight[] = [];
  const sorted = [...a.conversions].sort((x, y2) => y2.rate - x.rate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const leads = snapshot.funnel.find((s) => s.id !== "revenue");
  const sales = [...snapshot.funnel].reverse().find((s) => s.id !== "revenue");
  const revenue = snapshot.funnel.find((s) => s.id === "revenue");

  if (leads && sales && leads.value > 0) {
    const overall = sales.value / leads.value;
    out.push({
      label: "Conversão geral",
      value: pct(overall),
      note: `${int(leads.value)} → ${int(sales.value)}`,
      tone: overall >= 0.15 ? "good" : overall >= 0.07 ? "warn" : "bad",
    });
  }
  if (revenue) {
    out.push({
      label: "Receita do período",
      value: brl(revenue.value),
      note: a.monthLabel,
      tone: "good",
    });
  }
  if (best) {
    out.push({ label: "Melhor conversão", value: pct(best.rate), note: best.label, tone: "good" });
  }
  if (worst && worst !== best) {
    out.push({ label: "Principal gargalo", value: pct(worst.rate), note: worst.label, tone: "warn" });
  }
  const top = [...a.comparison.rows]
    .filter((r) => r.vsPrevious !== null)
    .sort((x, y2) => (y2.vsPrevious ?? 0) - (x.vsPrevious ?? 0))[0];
  if (top) {
    out.push({
      label: "Melhor indicador",
      value: `${(top.vsPrevious ?? 0) >= 0 ? "+" : "-"}${pct(Math.abs(top.vsPrevious ?? 0))}`,
      note: `${top.label} vs. ${a.comparison.previousLabel}`,
      tone: (top.vsPrevious ?? 0) >= 0 ? "good" : "bad",
    });
  }
  return out;
}

function highlightPanel(c: Ctx, state: { page: number }, y: number, items: Highlight[]): number {
  const { doc, w } = c;
  const cols = 3;
  const gap = 5;
  const cw = (w - M * 2 - gap * (cols - 1)) / cols;
  const ch = 27;
  items.forEach((it, i) => {
    const col = i % cols;
    if (col === 0) y = room(c, state, y, ch + gap);
    const x = M + col * (cw + gap);
    const tone = it.tone === "good" ? GREEN : it.tone === "warn" ? AMBER : RED;
    doc.setFillColor(...NAVY);
    doc.roundedRect(x, y, cw, ch, 2.4, 2.4, "F");
    doc.setFillColor(...tone);
    doc.circle(x + 6, y + 7, 1.7, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...GOLD);
    doc.text(it.label.toUpperCase(), x + 10, y + 8, { charSpace: 0.9 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(it.value, x + 6, y + 18.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(178, 188, 208);
    doc.text((doc.splitTextToSize(it.note, cw - 10) as string[])[0] ?? "", x + 6, y + 23.5);
    if (col === cols - 1) y += ch + gap;
  });
  if (items.length % cols !== 0) y += ch + gap;
  return y + 2;
}

/* ------------------- gráfico comparativo (barras duplas) ----------------- */

function comparisonChart(c: Ctx, state: { page: number }, y: number, a: BrainAnalytics): number {
  const { doc, w } = c;
  const full = w - M * 2;
  const rows = a.comparison.rows.filter((r) => r.unit !== "currency");
  if (!rows.length) return y;
  const max = Math.max(...rows.flatMap((r) => [r.current, r.previous]), 1);
  const track = full * 0.6;
  for (const r of rows) {
    y = room(c, state, y, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(r.label, M, y + 3);
    const v = r.vsPrevious;
    doc.setFontSize(7.6);
    doc.setTextColor(...(v === null ? MUTED : v >= 0 ? GREEN : RED));
    doc.text(v === null ? "—" : `${v >= 0 ? "+" : "-"}${pct(Math.abs(v))}`, w - M, y + 3, {
      align: "right",
    });
    const bars: [number, [number, number, number], string][] = [
      [r.current, NAVY, a.monthLabel],
      [r.previous, [168, 178, 196], a.comparison.previousLabel],
    ];
    let by = y + 5.5;
    for (const [val, color, lbl] of bars) {
      doc.setFillColor(...SOFT);
      doc.roundedRect(M, by, track, 4.2, 1, 1, "F");
      doc.setFillColor(...color);
      doc.roundedRect(M, by, Math.max(1.5, track * (val / max)), 4.2, 1, 1, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(...MUTED);
      doc.text(`${lbl} · ${int(val)}`, M + track + 3, by + 3.2);
      by += 5.6;
    }
    y = by + 2.4;
  }
  return y + 2;
}

/* -------------------------- plano de ação por prioridade ------------------ */

function actionPlan(c: Ctx, state: { page: number }, y: number, items: string[]): number {
  const { doc, w } = c;
  const full = w - M * 2;
  const groups: [string, [number, number, number], string[]][] = [
    ["Prioridade alta", RED, items.slice(0, 2)],
    ["Prioridade média", AMBER, items.slice(2, 4)],
    ["Prioridade baixa", GREEN, items.slice(4)],
  ];
  for (const [label, color, list] of groups) {
    if (!list.length) continue;
    y = room(c, state, y, 14);
    doc.setFillColor(...color);
    doc.roundedRect(M, y, 34, 6, 1.4, 1.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(label.toUpperCase(), M + 3, y + 4.1, { charSpace: 0.8 });
    y += 9;
    for (const item of list) {
      const lines = doc.splitTextToSize(item, full - 12) as string[];
      const ch = 4 + lines.length * 4.4;
      y = room(c, state, y, ch + 3);
      doc.setFillColor(...SOFT);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, full, ch, 2, 2, "FD");
      doc.setFillColor(...color);
      doc.rect(M, y, 1.6, ch, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(...TEXT);
      let ty = y + 5.6;
      for (const l of lines) {
        doc.text(l, M + 6, ty);
        ty += 4.4;
      }
      y += ch + 3;
    }
    y += 2;
  }
  return y + 2;
}

function funnelBlock(c: Ctx, state: { page: number }, y: number, snapshot: BrainSnapshot): number {
  const { doc, w } = c;
  const stages = snapshot.funnel.filter((s) => s.id !== "revenue");
  const max = Math.max(...stages.map((s) => s.value), 1);
  const full = w - M * 2;
  y = room(c, state, y, stages.length * 11 + 6);
  for (const s of stages) {
    const ratio = s.value / max;
    const barW = Math.max(full * 0.16, full * 0.62 * ratio);
    doc.setFillColor(...SOFT);
    doc.roundedRect(M, y, full * 0.62, 8, 1.5, 1.5, "F");
    doc.setFillColor(...NAVY);
    doc.roundedRect(M, y, barW, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.text(s.label.toUpperCase(), M + 3, y + 5.4, { charSpace: 0.5 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(int(s.value), M + full * 0.64, y + 5.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(pct(ratio), w - M, y + 5.8, { align: "right" });
    y += 11;
  }
  const revenue = snapshot.funnel.find((s) => s.id === "revenue");
  if (revenue) {
    y = room(c, state, y, 14);
    doc.setFillColor(...NAVY_DEEP);
    doc.roundedRect(M, y, full, 12, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text("FATURAMENTO DO PERÍODO", M + 4, y + 7.6, { charSpace: 1.2 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(brl(revenue.value), w - M - 4, y + 8, { align: "right" });
    y += 16;
  }
  return y;
}

function conversionBars(c: Ctx, state: { page: number }, y: number, a: BrainAnalytics): number {
  const { doc, w } = c;
  const full = w - M * 2;
  for (const conv of a.conversions) {
    y = room(c, state, y, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...NAVY);
    doc.text(conv.label, M, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...GOLD);
    doc.text(pct(conv.rate), w - M, y + 3, { align: "right" });
    doc.setFillColor(...SOFT);
    doc.roundedRect(M, y + 5, full, 4, 1, 1, "F");
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y + 5, Math.max(1.5, full * Math.min(conv.rate, 1)), 4, 1, 1, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(`${int(conv.from)} → ${int(conv.to)} · ${conv.hint}`, M, y + 13);
    y += 17;
  }
  return y;
}

function comparisonTable(c: Ctx, state: { page: number }, y: number, a: BrainAnalytics): number {
  const { doc, w } = c;
  const full = w - M * 2;
  const cols = [0.3, 0.18, 0.18, 0.17, 0.17];
  const head = ["Indicador", a.monthLabel, a.comparison.previousLabel, a.comparison.annualLabel, "Variação"];
  y = room(c, state, y, 16);
  doc.setFillColor(...NAVY);
  doc.rect(M, y, full, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  let x = M;
  head.forEach((hd, i) => {
    doc.text((doc.splitTextToSize(hd, full * cols[i] - 4) as string[])[0] ?? "", x + 2.5, y + 5.3);
    x += full * cols[i];
  });
  y += 8;
  a.comparison.rows.forEach((r, i) => {
    y = room(c, state, y, 9);
    if (i % 2 === 0) {
      doc.setFillColor(...SOFT);
      doc.rect(M, y, full, 8, "F");
    }
    const fmt = (n: number) => (r.unit === "currency" ? brl(n) : int(n));
    const cells = [r.label, fmt(r.current), fmt(r.previous), fmt(r.annualAverage)];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    x = M;
    cells.forEach((cell, ci) => {
      doc.setFont("helvetica", ci === 0 ? "bold" : "normal");
      doc.text(cell, x + 2.5, y + 5.4);
      x += full * cols[ci];
    });
    const v = r.vsPrevious;
    doc.setFont("helvetica", "bold");
    if (v === null) {
      doc.setTextColor(...MUTED);
      doc.text("—", x + 2.5, y + 5.4);
    } else {
      doc.setTextColor(...(v >= 0 ? GREEN : RED));
      doc.text(`${v >= 0 ? "+" : "-"}${pct(Math.abs(v))}`, x + 2.5, y + 5.4);
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y + 8, M + full, y + 8);
    y += 8;
  });
  return y + 6;
}

function insightCards(c: Ctx, state: { page: number }, y: number, a: BrainAnalytics): number {
  const { doc, w } = c;
  const full = w - M * 2;
  for (const ins of a.insights) {
    const body = doc.splitTextToSize(ins.detail, full - 12) as string[];
    const ch = 17 + body.length * 4.4;
    y = room(c, state, y, ch + 4);
    const accent = ins.tone === "positivo" ? GREEN : ins.tone === "atencao" ? AMBER : NAVY;
    const chip =
      ins.tone === "positivo" ? "DESTAQUE POSITIVO" : ins.tone === "atencao" ? "ATENÇÃO" : "OBSERVAÇÃO";
    doc.setFillColor(232, 235, 241);
    doc.roundedRect(M + 0.7, y + 0.9, full, ch, 2.4, 2.4, "F");
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, full, ch, 2.4, 2.4, "FD");
    doc.setFillColor(...accent);
    doc.rect(M, y, 1.8, ch, "F");
    doc.setFillColor(...accent);
    doc.circle(M + 8, y + 7, 1.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(ins.title, M + 12.5, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...accent);
    doc.text(chip, w - M - 4, y + 8, { align: "right", charSpace: 0.8 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...TEXT);
    let ty = y + 14.5;
    for (const l of body) {
      doc.text(l, M + 6.5, ty);
      ty += 4.4;
    }
    y += ch + 4;
  }
  return y + 2;
}

function bullets(c: Ctx, state: { page: number }, y: number, items: string[]): number {
  const { doc, w } = c;
  doc.setFontSize(9);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, w - M * 2 - 8) as string[];
    for (let i = 0; i < lines.length; i++) {
      y = room(c, state, y, 6);
      if (i === 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GOLD);
        doc.text("•", M + 1, y);
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT);
      doc.text(lines[i], M + 6, y);
      y += 4.8;
    }
    y += 1.6;
  }
  return y + 2;
}

/* --------------------------------- capa ---------------------------------- */

export function generateBrainExecutivePdf(input: {
  report: BrainReport;
  analytics: BrainAnalytics;
  snapshot: BrainSnapshot;
  request: string;
  actorName: string;
}): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const c: Ctx = { doc, w, h, title: input.report.title };
  const state = { page: 1 };
  const a = input.analytics;

  // Capa institucional
  doc.setFillColor(...NAVY_DEEP);
  doc.rect(0, 0, w, h, "F");
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 128, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 128, w, 1.2, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(M, 34, M + 28, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GOLD);
  doc.text("BRAIN ANALYTICS · RELATÓRIO INTELIGENTE", M, 29, { charSpace: 2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(input.report.title, w - M * 2) as string[];
  let ty = 68;
  for (const l of titleLines.slice(0, 3)) {
    doc.text(l, M, ty);
    ty += 13;
  }
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(M, ty + 1, M + 34, ty + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(214, 220, 234);
  const subLines = doc.splitTextToSize(input.report.subtitle, w - M * 2 - 10) as string[];
  let sy = ty + 10;
  for (const l of subLines.slice(0, 2)) {
    doc.text(l, M, sy);
    sy += 6;
  }

  const meta: [string, string][] = [
    ["Escopo", a.subjectLabel],
    ["Competência", a.monthLabel],
    ["Solicitação", input.request],
    ["Emitido por", input.actorName],
    ["Emitido em", new Date().toLocaleDateString("pt-BR")],
  ];
  let my = 152;
  for (const [k, v] of meta) {
    doc.setFillColor(...GOLD);
    doc.rect(M, my - 3.4, 1.2, 11, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text(k.toUpperCase(), M + 5, my, { charSpace: 1.2 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    const vl = doc.splitTextToSize(v, w - M * 2) as string[];
    doc.text(vl[0] ?? "", M + 5, my + 6);
    my += 16;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(160, 170, 190);
  doc.text(
    "Documento gerado a partir dos indicadores internos do Brain Analytics e do KPI Manager.",
    M,
    h - 22,
  );
  doc.text(WORKSPACE.poweredBy, M, h - 16);

  // Página 2 em diante
  let y = newPage(c, state);

  y = sectionTitle(c, state, y, "Painel executivo", "Destaques do período");
  y = highlightPanel(c, state, y, buildHighlights(a, input.snapshot));

  if (input.report.summary) {
    y = sectionTitle(c, state, y, "Resumo executivo", "Leitura do período");
    y = paragraph(c, state, y, input.report.summary, 10);
  }
  y = paragraph(c, state, y, a.headline, 9.5);

  y = sectionTitle(c, state, y, "Indicadores consolidados", "Painel do período");
  y = kpiCards(c, state, y, input.snapshot);

  y = sectionTitle(c, state, y, "Funil comercial", "Esteira ponta a ponta");
  y = funnelBlock(c, state, y, input.snapshot);

  y = sectionTitle(c, state, y, "Conversões", "Eficiência entre estágios");
  y = conversionBars(c, state, y, a);

  y = sectionTitle(c, state, y, "Comparativos", "Atual · anterior · média anual");
  y = comparisonTable(c, state, y, a);
  y = comparisonChart(c, state, y, a);

  for (const s of input.report.sections) {
    y = sectionTitle(c, state, y, "Análise da IA Executiva", s.title);
    for (const p of s.paragraphs) y = paragraph(c, state, y, p);
    if (s.bullets.length) y = bullets(c, state, y, s.bullets);
  }

  y = sectionTitle(c, state, y, "Insights automáticos", "Pontos de atenção e destaques");
  y = insightCards(c, state, y, a);

  if (input.report.recommendations.length) {
    y = sectionTitle(c, state, y, "Plano de ação", "Prioridades recomendadas");
    y = actionPlan(c, state, y, input.report.recommendations);
  }

  y = room(c, state, y, 24);
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, w - M * 2, 20, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text("CONCLUSÃO", M + 5, y + 7, { charSpace: 1.4 });
  doc.setFontSize(8.6);
  doc.setTextColor(255, 255, 255);
  const cl = doc.splitTextToSize(a.closing, w - M * 2 - 10) as string[];
  let cy = y + 12.5;
  for (const l of cl.slice(0, 2)) {
    doc.text(l, M + 5, cy);
    cy += 4.6;
  }

  footer(c, state.page);
  const slug = a.monthLabel.replace(/\s+/g, "-").toLowerCase();
  doc.save(`relatorio-inteligente-${slug}.pdf`);
}
