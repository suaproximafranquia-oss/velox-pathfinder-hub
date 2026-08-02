/**
 * Gerador de PDF para as respostas da IA Gerencial.
 * Segue o mesmo padrao visual White Label dos demais relatorios da
 * Atlas Platform (jsPDF, capa navy, detalhes em dourado).
 */
import { jsPDF } from "jspdf";
import { WORKSPACE } from "@/config/workspace";
import type { KpiInsightSnapshot } from "./kpi-ai";
import { formatCurrency, formatNumber, formatPercent, type KpiSummary } from "./kpi-manager";

const NAVY: [number, number, number] = [12, 22, 44];
const GOLD: [number, number, number] = [176, 141, 87];
const TEXT: [number, number, number] = [40, 45, 60];
const MUTED: [number, number, number] = [120, 128, 145];
const LINE: [number, number, number] = [220, 222, 230];
const ROW_ALT: [number, number, number] = [246, 244, 238];
const TABLE_HEAD: [number, number, number] = [22, 34, 62];

function footer(doc: jsPDF, w: number, h: number) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(18, h - 18, w - 18, h - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(WORKSPACE.poweredBy, 18, h - 12);
  doc.text(
    "IA Gerencial · Atlas Platform",
    w - 18,
    h - 12,
    { align: "right" },
  );
}

function ensureRoom(
  doc: jsPDF,
  y: number,
  need: number,
  w: number,
  h: number,
): number {
  if (y + need > h - 24) {
    footer(doc, w, h);
    doc.addPage();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("ATLAS PLATFORM · IA GERENCIAL", 22, 18, { charSpace: 1.2 });
    return 34;
  }
  return y;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text(title.toUpperCase(), 22, y, { charSpace: 1.4 });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(22, y + 2.5, 62, y + 2.5);
  doc.setTextColor(...TEXT);
  return y + 10;
}

/* =====================================================================
 * Parser Markdown -> blocos estruturados
 * Converte a resposta bruta da IA em uma AST leve. Nenhum caractere
 * de markdown (#, **, *, |) pode chegar ao PDF final: tudo vira
 * tipografia, listas, tabelas ou paragrafos.
 * ===================================================================*/
type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "hr" };

function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}

function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (!line.trim()) { i++; continue; }

    if (/^---+\s*$/.test(line) || /^===+\s*$/.test(line)) {
      out.push({ kind: "hr" }); i++; continue;
    }

    // Cabecalhos
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const kind = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      out.push({ kind, text: stripInline(h[2]) });
      i++; continue;
    }

    // Tabelas pipe
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = line.split("|").slice(1, -1).map((c) => stripInline(c));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => stripInline(c)));
        i++;
      }
      out.push({ kind: "table", head, rows });
      continue;
    }

    // Listas nao ordenadas
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(stripInline(lines[i].replace(/^\s*[-*•]\s+/, "")));
        i++;
      }
      out.push({ kind: "ul", items });
      continue;
    }

    // Listas ordenadas
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(stripInline(lines[i].replace(/^\s*\d+[.)]\s+/, "")));
        i++;
      }
      out.push({ kind: "ol", items });
      continue;
    }

    // Paragrafo (pode ocupar varias linhas)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*•]\s|\d+[.)]\s|\|)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push({ kind: "p", text: stripInline(buf.join(" ")) });
  }
  return out;
}

/* =====================================================================
 * Renderizadores
 * ===================================================================*/
function renderTable(
  doc: jsPDF,
  head: string[],
  rows: string[][],
  y: number,
  w: number,
  h: number,
): number {
  if (head.length === 0) return y;
  const marginX = 22;
  const tableW = w - marginX * 2;
  const colW = tableW / head.length;
  const cellPad = 2.5;

  const measureRow = (cells: string[]) => {
    let maxLines = 1;
    for (let c = 0; c < head.length; c++) {
      const txt = cells[c] ?? "";
      const lines = doc.splitTextToSize(txt, colW - cellPad * 2) as string[];
      if (lines.length > maxLines) maxLines = lines.length;
    }
    return Math.max(7, maxLines * 4.4 + 3);
  };

  // Cabecalho
  y = ensureRoom(doc, y, 12, w, h);
  doc.setFillColor(...TABLE_HEAD);
  doc.rect(marginX, y, tableW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  for (let c = 0; c < head.length; c++) {
    doc.text(head[c] ?? "", marginX + c * colW + cellPad, y + 5.4);
  }
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r];
    const rowH = measureRow(cells);
    y = ensureRoom(doc, y, rowH + 2, w, h);
    if (r % 2 === 0) {
      doc.setFillColor(...ROW_ALT);
      doc.rect(marginX, y, tableW, rowH, "F");
    }
    for (let c = 0; c < head.length; c++) {
      const txt = cells[c] ?? "";
      const lines = doc.splitTextToSize(txt, colW - cellPad * 2) as string[];
      let ty = y + 4.5;
      for (const l of lines) {
        doc.text(l, marginX + c * colW + cellPad, ty);
        ty += 4.4;
      }
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(marginX, y + rowH, marginX + tableW, y + rowH);
    y += rowH;
  }
  return y + 4;
}

function renderBlocks(
  doc: jsPDF,
  blocks: Block[],
  yStart: number,
  w: number,
  h: number,
): number {
  let y = yStart;
  for (const b of blocks) {
    if (b.kind === "h1") {
      y = ensureRoom(doc, y + 2, 14, w, h);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...NAVY);
      const lines = doc.splitTextToSize(b.text, w - 44) as string[];
      for (const l of lines) { doc.text(l, 22, y); y += 7; }
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.4);
      doc.line(22, y - 4, 42, y - 4);
      y += 3;
    } else if (b.kind === "h2") {
      y = ensureRoom(doc, y + 2, 10, w, h);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...NAVY);
      const lines = doc.splitTextToSize(b.text, w - 44) as string[];
      for (const l of lines) { doc.text(l, 22, y); y += 6; }
      y += 2;
    } else if (b.kind === "h3") {
      y = ensureRoom(doc, y + 2, 8, w, h);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...GOLD);
      doc.text(b.text.toUpperCase(), 22, y, { charSpace: 0.8 });
      y += 6;
    } else if (b.kind === "p") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(b.text, w - 44) as string[];
      for (const l of lines) {
        y = ensureRoom(doc, y, 6, w, h);
        doc.text(l, 22, y);
        y += 5.2;
      }
      y += 3;
    } else if (b.kind === "ul" || b.kind === "ol") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...TEXT);
      let n = 1;
      for (const item of b.items) {
        const bullet = b.kind === "ul" ? "•" : `${n++}.`;
        const lines = doc.splitTextToSize(item, w - 50) as string[];
        for (let li = 0; li < lines.length; li++) {
          y = ensureRoom(doc, y, 6, w, h);
          if (li === 0) {
            doc.setTextColor(...GOLD);
            doc.text(bullet, 24, y);
            doc.setTextColor(...TEXT);
          }
          doc.text(lines[li], 30, y);
          y += 5.2;
        }
        y += 1.5;
      }
      y += 2;
    } else if (b.kind === "table") {
      y = renderTable(doc, b.head, b.rows, y + 2, w, h);
    } else if (b.kind === "hr") {
      y = ensureRoom(doc, y + 2, 6, w, h);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
      doc.line(22, y, w - 22, y);
      y += 6;
    }
  }
  return y;
}

export function generateKpiInsightPdf(input: {
  question: string;
  answer: string;
  monthLabel: string;
  scopeLabel: string;
  actorName: string;
  snapshot?: KpiInsightSnapshot;
}): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Capa
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, h, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(22, 32, 60, 32);
  doc.setTextColor(...GOLD);
  doc.setFontSize(9);
  doc.text("ATLAS PLATFORM · RELATORIO EXECUTIVO", 22, 28, { charSpace: 2 });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Analise Gerencial de KPIs", 22, 96);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text("IA Gerencial · Atlas Platform", 22, 108);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Competencia ${input.monthLabel}`, 22, 120);
  doc.setDrawColor(...GOLD);
  doc.line(22, 128, 80, 128);

  const meta: [string, string][] = [
    ["Executivos analisados", input.scopeLabel],
    ["Solicitante", input.actorName],
    ["Data de emissao", new Date().toLocaleDateString("pt-BR")],
    ["Workspace", WORKSPACE.workspaceName],
  ];
  let cy = 146;
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(k.toUpperCase(), 22, cy, { charSpace: 1.2 });
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    const vLines = doc.splitTextToSize(v, w - 44) as string[];
    let vy = cy + 6;
    for (const vl of vLines) { doc.text(vl, 22, vy); vy += 5.5; }
    cy += 16;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);
  doc.text(WORKSPACE.poweredBy, 22, h - 22, { charSpace: 1.2 });

  // ============================================================
  // Paginas de dados quantitativos (quando o snapshot esta disponivel)
  // ============================================================
  if (input.snapshot) {
    renderExecutiveSummary(doc, w, h, input.snapshot);
    renderComparativesAndTables(doc, w, h, input.snapshot);
    renderExecutivesChart(doc, w, h, input.snapshot);
  }

  // Pagina — Pergunta + Insights da IA
  doc.addPage();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("ATLAS PLATFORM · IA GERENCIAL", 22, 18, { charSpace: 1.2 });

  let y = 40;
  y = sectionTitle(doc, "Pergunta", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  const qLines = doc.splitTextToSize(input.question, w - 44) as string[];
  for (const line of qLines) {
    y = ensureRoom(doc, y, 6, w, h);
    doc.text(line, 22, y);
    y += 5.5;
  }
  y += 6;

  y = sectionTitle(doc, "Insights da IA Gerencial", y);
  // Remove o disclaimer padrao (renderizado ao final) e converte a
  // resposta bruta em blocos estruturados (H1/H2/H3, listas, tabelas).
  const disclaimerIdx = input.answer.indexOf("---\nResposta gerada por Inteligência Artificial");
  const bodyMd = disclaimerIdx > 0 ? input.answer.slice(0, disclaimerIdx).trim() : input.answer;
  const blocks = parseMarkdown(bodyMd);
  y = renderBlocks(doc, blocks, y, w, h);

  y = ensureRoom(doc, y + 6, 24, w, h);
  y = sectionTitle(doc, "Conclusao", y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const disc =
    "Relatorio gerado pela IA Gerencial da Atlas Platform com base exclusivamente no snapshot oficial de KPIs da competencia selecionada. Os numeros refletem o dataset carregado no KPI Manager no momento da consulta e nao substituem a analise do gestor responsavel.";
  const dl = doc.splitTextToSize(disc, w - 44) as string[];
  for (const l of dl) { y = ensureRoom(doc, y, 5, w, h); doc.text(l, 22, y); y += 4.6; }

  footer(doc, w, h);

  doc.save(`relatorio-ia-gerencial-${Date.now()}.pdf`);
}

/* =====================================================================
 * Secoes quantitativas: Resumo Executivo, Comparativos, Tabelas, Grafico
 * ===================================================================*/
function newContentPage(doc: jsPDF): number {
  doc.addPage();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("ATLAS PLATFORM · IA GERENCIAL", 22, 18, { charSpace: 1.2 });
  return 40;
}

function pct(curr: number, prev: number): string {
  if (prev === 0) return curr === 0 ? "0,0%" : "—";
  const d = ((curr - prev) / prev) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1).replace(".", ",")}%`;
}

function renderExecutiveSummary(
  doc: jsPDF,
  w: number,
  h: number,
  snap: KpiInsightSnapshot,
): void {
  let y = newContentPage(doc);
  y = sectionTitle(doc, "Resumo Executivo", y);

  const s = snap.team.current;
  const p = snap.team.previous;
  const totalExec = snap.executives.length;
  const highlights: string[] = [
    `Competencia analisada: ${snap.month.label}${snap.previousMonth ? ` · Comparativo com ${snap.previousMonth.label}` : ""}.`,
    `Escopo consolidado: ${totalExec} ${totalExec === 1 ? "executivo" : "executivos"} sob a permissao do solicitante.`,
    `Leads captados: ${formatNumber(s.leads)} · Apresentacoes: ${formatNumber(s.presentations)} · Contratos enviados: ${formatNumber(s.contractsSent)}.`,
    `Vendas concluidas: ${formatNumber(s.sales)} · Faturamento total: ${formatCurrency(s.salesValue)}.`,
    `Conversao Lead → Venda: ${formatPercent(s.conversion)}${p ? ` (mes anterior: ${formatPercent(p.conversion)})` : ""}.`,
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT);
  for (const item of highlights) {
    const lines = doc.splitTextToSize(item, w - 50) as string[];
    for (let li = 0; li < lines.length; li++) {
      y = ensureRoom(doc, y, 6, w, h);
      if (li === 0) {
        doc.setTextColor(...GOLD);
        doc.text("•", 24, y);
        doc.setTextColor(...TEXT);
      }
      doc.text(lines[li], 30, y);
      y += 5.2;
    }
    y += 1.5;
  }

  footer(doc, w, h);
}

function renderComparativesAndTables(
  doc: jsPDF,
  w: number,
  h: number,
  snap: KpiInsightSnapshot,
): void {
  let y = newContentPage(doc);
  y = sectionTitle(doc, "Comparativos de Periodo", y);

  const c = snap.team.current;
  const p = snap.team.previous;
  const j: KpiSummary = snap.team.last90Days;

  const cmpHead = ["Indicador", "Mes atual", snap.previousMonth ? "Mes anterior" : "Ultimos 90 dias", "Variacao %"];
  const baseline = p ?? j;
  const cmpRows: string[][] = [
    ["Leads", formatNumber(c.leads), formatNumber(baseline.leads), pct(c.leads, baseline.leads)],
    ["Apresentacoes", formatNumber(c.presentations), formatNumber(baseline.presentations), pct(c.presentations, baseline.presentations)],
    ["Contratos enviados", formatNumber(c.contractsSent), formatNumber(baseline.contractsSent), pct(c.contractsSent, baseline.contractsSent)],
    ["Vendas", formatNumber(c.sales), formatNumber(baseline.sales), pct(c.sales, baseline.sales)],
    ["Faturamento", formatCurrency(c.salesValue), formatCurrency(baseline.salesValue), pct(c.salesValue, baseline.salesValue)],
    ["Conversao L→V", formatPercent(c.conversion), formatPercent(baseline.conversion), pct(c.conversion * 100, baseline.conversion * 100)],
  ];
  y = renderTable(doc, cmpHead, cmpRows, y, w, h);

  y = ensureRoom(doc, y + 6, 20, w, h);
  y = sectionTitle(doc, "Detalhamento por Executivo", y);

  const execHead = ["Executivo", "Leads", "Apres.", "COFs", "Vendas", "Faturamento"];
  const execRows: string[][] = snap.executives.map((e) => [
    e.name,
    formatNumber(e.current.leads),
    formatNumber(e.current.presentations),
    formatNumber(e.current.contractsSent),
    formatNumber(e.current.sales),
    formatCurrency(e.current.salesValue),
  ]);
  if (execRows.length > 0) {
    y = renderTable(doc, execHead, execRows, y, w, h);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Nenhum executivo dentro do escopo selecionado.", 22, y);
  }

  footer(doc, w, h);
}

function renderExecutivesChart(
  doc: jsPDF,
  w: number,
  h: number,
  snap: KpiInsightSnapshot,
): void {
  const active = snap.executives.filter((e) => e.current.salesValue > 0 || e.current.sales > 0);
  if (active.length === 0) return;

  let y = newContentPage(doc);
  y = sectionTitle(doc, "Grafico · Faturamento por Executivo", y);

  const marginX = 22;
  const chartW = w - marginX * 2;
  const rowH = 9;
  const gap = 4;
  const nameW = 52;
  const valueW = 40;
  const barMax = chartW - nameW - valueW - 6;
  const max = Math.max(...active.map((e) => e.current.salesValue), 1);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const e of active) {
    y = ensureRoom(doc, y, rowH + gap, w, h);
    // Nome
    doc.setTextColor(...TEXT);
    doc.text(doc.splitTextToSize(e.name, nameW - 2)[0] as string, marginX, y + 5);
    // Trilha
    doc.setFillColor(...ROW_ALT);
    doc.rect(marginX + nameW, y, barMax, rowH, "F");
    // Barra
    const barW = Math.max(1, (e.current.salesValue / max) * barMax);
    doc.setFillColor(...GOLD);
    doc.rect(marginX + nameW, y, barW, rowH, "F");
    // Valor
    doc.setTextColor(...NAVY);
    doc.text(
      formatCurrency(e.current.salesValue),
      marginX + nameW + barMax + 4,
      y + 5,
    );
    y += rowH + gap;
  }

  y = ensureRoom(doc, y + 4, 14, w, h);
  y = sectionTitle(doc, "Grafico · Vendas Realizadas", y);
  const maxSales = Math.max(...active.map((e) => e.current.sales), 1);
  for (const e of active) {
    y = ensureRoom(doc, y, rowH + gap, w, h);
    doc.setTextColor(...TEXT);
    doc.text(doc.splitTextToSize(e.name, nameW - 2)[0] as string, marginX, y + 5);
    doc.setFillColor(...ROW_ALT);
    doc.rect(marginX + nameW, y, barMax, rowH, "F");
    const barW = Math.max(1, (e.current.sales / maxSales) * barMax);
    doc.setFillColor(...TABLE_HEAD);
    doc.rect(marginX + nameW, y, barW, rowH, "F");
    doc.setTextColor(...NAVY);
    doc.text(formatNumber(e.current.sales), marginX + nameW + barMax + 4, y + 5);
    y += rowH + gap;
  }

  footer(doc, w, h);
}