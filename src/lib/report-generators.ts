/**
 * Geradores oficiais de exportação — Relatórios Executivos.
 *
 * Produzem PDF (jsPDF) e Excel (SheetJS) IMEDIATAMENTE, sem intermediários.
 * Consomem apenas `ReportDataset` já produzido por `buildReport`.
 */
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { WORKSPACE } from "@/config/workspace";
import { formatCurrency, formatNumber } from "./kpi-manager";
import type { ReportDataset } from "./reports";
import type { ComparativeReport } from "./report-comparatives";
import type { CampaignRow } from "@/components/executive/kpi/painel-campanhas";
import { CAMPAIGN_LEVELS } from "./kpi-manager";

const NAVY: [number, number, number] = [12, 22, 44];
const GOLD: [number, number, number] = [176, 141, 87];
const TEXT: [number, number, number] = [40, 45, 60];
const MUTED: [number, number, number] = [120, 128, 145];
const LINE: [number, number, number] = [220, 222, 230];

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "");
}

function pageFooter(doc: jsPDF, w: number, h: number) {
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
  doc.line(18, h - 18, w - 18, h - 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(WORKSPACE.poweredBy, 18, h - 12);
  doc.text("Relatório gerado automaticamente pela Atlas Platform.", w - 18, h - 12, { align: "right" });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GOLD);
  doc.text(title.toUpperCase(), 22, y, { charSpace: 1.4 });
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4);
  doc.line(22, y + 2.5, 62, y + 2.5);
  doc.setTextColor(...TEXT);
  return y + 10;
}

function ensureRoom(doc: jsPDF, y: number, need: number, w: number, h: number): number {
  if (y + need > h - 24) {
    pageFooter(doc, w, h);
    doc.addPage();
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text("ATLAS PLATFORM · RELATÓRIO EXECUTIVO", 22, 18, { charSpace: 1.2 });
    return 34;
  }
  return y;
}

export function exportReportPdf(
  report: ReportDataset,
  extras: {
    brainSummary: string;
    comparatives: ComparativeReport[];
    campaignRows?: CampaignRow[];
  },
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Capa
  doc.setFillColor(...NAVY); doc.rect(0, 0, w, h, "F");
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(22, 32, 60, 32);
  doc.setTextColor(...GOLD); doc.setFontSize(9);
  doc.text("ATLAS PLATFORM · RELATÓRIO EXECUTIVO", 22, 28, { charSpace: 2 });
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
  doc.text(report.title, 22, 102);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12);
  doc.text(report.subtitle, 22, 114);
  doc.setDrawColor(...GOLD); doc.line(22, 122, 80, 122);
  const meta: [string, string][] = [
    ["Competência", report.month.label],
    ["Emissão", new Date().toLocaleDateString("pt-BR")],
    ["Escopo", report.selection.scope === "team" ? "Equipe" : "Individual"],
    ["Workspace", WORKSPACE.workspaceName],
  ];
  let cy = 142;
  for (const [k, v] of meta) {
    doc.setFontSize(8); doc.setTextColor(...GOLD);
    doc.text(k.toUpperCase(), 22, cy, { charSpace: 1.2 });
    doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    doc.text(v, 22, cy + 7);
    cy += 18;
  }
  doc.setFontSize(8); doc.setTextColor(200, 200, 210);
  doc.text(WORKSPACE.poweredBy, 22, h - 22, { charSpace: 1.2 });

  // Página 2 — Resumo
  doc.addPage();
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  doc.text("ATLAS PLATFORM · RELATÓRIO EXECUTIVO", 22, 18, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...NAVY);
  doc.text(`Resumo — ${report.month.label}`, 22, 40);

  let y = sectionTitle(doc, "Análise Brain (automática)", 58);
  doc.setFontSize(10); doc.setTextColor(...TEXT);
  const lines = doc.splitTextToSize(extras.brainSummary, w - 44);
  doc.text(lines, 22, y);
  y += lines.length * 5 + 6;

  y = sectionTitle(doc, "Análise Textual", y);
  doc.setFontSize(10); doc.setTextColor(...TEXT);
  const narrLines = doc.splitTextToSize(report.narrative, w - 44);
  doc.text(narrLines, 22, y);
  y += narrLines.length * 5 + 8;

  // Cards resumo
  y = sectionTitle(doc, "Indicadores Principais", y);
  const cards: [string, string][] = [
    ["Leads", formatNumber(report.summary.leads)],
    ["Apresentações", formatNumber(report.summary.presentations)],
    ["Contratos Enviados", formatNumber(report.summary.contractsSent)],
    ["Vendas", formatNumber(report.summary.sales)],
    ["Faturamento", formatCurrency(report.summary.salesValue)],
  ];
  const colW = (w - 44) / 2;
  for (let i = 0; i < cards.length; i++) {
    const [k, v] = cards[i];
    const cx = 22 + (i % 2) * colW;
    const yy = y + Math.floor(i / 2) * 18;
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), cx, yy, { charSpace: 1.1 });
    doc.setFontSize(13); doc.setTextColor(...TEXT);
    doc.text(v, cx, yy + 6);
  }
  y += Math.ceil(cards.length / 2) * 18 + 6;

  // Funil
  y = ensureRoom(doc, y, 60, w, h);
  y = sectionTitle(doc, "Funil Executivo", y);
  const maxV = Math.max(1, ...report.funnel.map((f) => f.value));
  for (const st of report.funnel) {
    y = ensureRoom(doc, y, 10, w, h);
    const bw = ((w - 90) * st.value) / maxV;
    doc.setFontSize(9); doc.setTextColor(...TEXT);
    doc.text(st.label, 22, y + 4);
    doc.setDrawColor(...LINE); doc.setFillColor(...LINE);
    doc.roundedRect(64, y, w - 92, 5, 2, 2, "F");
    doc.setFillColor(...GOLD);
    doc.roundedRect(64, y, Math.max(2, bw), 5, 2, 2, "F");
    doc.setFontSize(9); doc.setTextColor(...MUTED);
    const label = st.id === "revenue" ? formatCurrency(st.value) : formatNumber(st.value);
    doc.text(label, w - 22, y + 4, { align: "right" });
    y += 10;
  }

  // Comparativos
  y += 4;
  y = ensureRoom(doc, y, 20, w, h);
  y = sectionTitle(doc, "Comparativos", y);
  for (const cmp of extras.comparatives) {
    y = ensureRoom(doc, y, 8 + cmp.cells.length * 6, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
    doc.text(cmp.axisLabel, 22, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(cmp.hint, 22, y + 4);
    y += 8;
    doc.setFontSize(9); doc.setTextColor(...TEXT);
    for (const c of cmp.cells) {
      const cur = c.unit === "currency" ? formatCurrency(c.value) : formatNumber(c.value);
      const ref = c.unit === "currency" ? formatCurrency(c.reference) : formatNumber(c.reference);
      const pct = c.deltaPercent === null ? "—" : `${c.delta >= 0 ? "+" : ""}${(c.deltaPercent * 100).toFixed(1).replace(".", ",")}%`;
      doc.text(c.label, 22, y);
      doc.text(cur, w - 90, y, { align: "right" });
      doc.text(ref, w - 55, y, { align: "right" });
      doc.text(pct, w - 22, y, { align: "right" });
      y += 6;
    }
    y += 4;
  }

  // Painel de Campanhas
  if (extras.campaignRows && extras.campaignRows.length > 0) {
    y = ensureRoom(doc, y, 20, w, h);
    y = sectionTitle(doc, "Painel de Campanhas", y);
    doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text("Executivo", 22, y);
    doc.text("Unidades", w - 100, y, { align: "right" });
    doc.text("Valor entregue", w - 55, y, { align: "right" });
    doc.text("Nível", w - 22, y, { align: "right" });
    y += 4; doc.setDrawColor(...LINE); doc.line(22, y, w - 22, y); y += 5;
    for (let i = 0; i < extras.campaignRows.length; i++) {
      const row = extras.campaignRows[i];
      y = ensureRoom(doc, y, 8, w, h);
      const level = CAMPAIGN_LEVELS
        .slice()
        .reverse()
        .find((lv) => row.value >= lv.min);
      doc.setFontSize(10); doc.setTextColor(...TEXT);
      doc.text(`${i + 1}. ${row.user.name}`, 22, y);
      doc.text(formatNumber(row.units), w - 100, y, { align: "right" });
      doc.text(formatCurrency(row.value), w - 55, y, { align: "right" });
      doc.setTextColor(...GOLD);
      doc.text(level ? level.label : "Em progressão", w - 22, y, { align: "right" });
      y += 6.5;
    }
  }

  // Tabela detalhada
  y = ensureRoom(doc, y, 20, w, h);
  y = sectionTitle(doc, "Indicadores do Mês (KPI Manager)", y);
  doc.setFontSize(9); doc.setTextColor(...MUTED);
  doc.text("Indicador", 22, y); doc.text("Total", w - 70, y, { align: "right" });
  doc.text("Média diária", w - 22, y, { align: "right" });
  y += 4; doc.setDrawColor(...LINE); doc.line(22, y, w - 22, y); y += 5;
  for (const ind of report.indicators) {
    y = ensureRoom(doc, y, 8, w, h);
    doc.setFontSize(10); doc.setTextColor(...TEXT);
    doc.text(ind.label, 22, y);
    doc.text(ind.formatted, w - 70, y, { align: "right" });
    doc.text(
      ind.unit === "currency" ? formatCurrency(ind.average) : ind.average.toFixed(1).replace(".", ","),
      w - 22, y, { align: "right" },
    );
    y += 6.5;
  }

  pageFooter(doc, w, h);

  const scope = report.selection.scope === "team" ? "equipe" : "individual";
  const subj = report.selection.scope === "individual" ? slugify(report.title.replace(/^.*—\s*/, "")) : "equipe";
  doc.save(`relatorio-${scope}-${subj}-${report.month.key}.pdf`);
}

export function exportReportExcel(
  report: ReportDataset,
  extras: { comparatives: ComparativeReport[]; brainSummary: string; campaignRows?: CampaignRow[] },
): void {
  const wb = XLSX.utils.book_new();

  // Aba 1 — Resumo
  const resumo: (string | number)[][] = [
    [WORKSPACE.workspaceName, WORKSPACE.workspaceTagline],
    [report.title],
    [report.subtitle],
    [`Emissão: ${new Date().toLocaleDateString("pt-BR")}`],
    [],
    ["Análise Brain (automática)"],
    [extras.brainSummary],
    [],
    ["Análise Textual"],
    [report.narrative],
    [],
    ["Indicador", "Valor"],
    ["Leads", report.summary.leads],
    ["Apresentações", report.summary.presentations],
    ["Contratos Enviados", report.summary.contractsSent],
    ["Vendas", report.summary.sales],
    ["Faturamento (R$)", report.summary.salesValue],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumo);
  ws1["!cols"] = [{ wch: 34 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

  // Aba 2 — Indicadores
  const linha: (string | number)[][] = [["Indicador", "Total", "Média diária", "Unidade"]];
  for (const ind of report.indicators) linha.push([ind.label, ind.total, ind.average, ind.unit]);
  const ws2 = XLSX.utils.aoa_to_sheet(linha);
  ws2["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Indicadores");

  // Aba 3 — Funil
  const funil: (string | number)[][] = [["Etapa", "Valor"]];
  for (const st of report.funnel) funil.push([st.label, st.value]);
  const ws3 = XLSX.utils.aoa_to_sheet(funil);
  ws3["!cols"] = [{ wch: 24 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Funil");

  // Aba 4 — Comparativos
  const comp: (string | number)[][] = [["Eixo", "Indicador", "Atual", "Referência", "Δ", "Δ %"]];
  for (const cmp of extras.comparatives) {
    for (const c of cmp.cells) {
      comp.push([
        cmp.axisLabel,
        c.label,
        c.value,
        c.reference,
        c.delta,
        c.deltaPercent === null ? "" : Number((c.deltaPercent * 100).toFixed(2)),
      ]);
    }
  }
  const ws4 = XLSX.utils.aoa_to_sheet(comp);
  ws4["!cols"] = [{ wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Comparativos");

  // Aba 5 — Painel de Campanhas
  if (extras.campaignRows && extras.campaignRows.length > 0) {
    const camp: (string | number)[][] = [["Posição", "Executivo", "Unidades", "Valor entregue (R$)", "Nível"]];
    extras.campaignRows.forEach((row, i) => {
      const level = CAMPAIGN_LEVELS.slice().reverse().find((lv) => row.value >= lv.min);
      camp.push([i + 1, row.user.name, row.units, row.value, level ? level.label : "Em progressão"]);
    });
    const ws5 = XLSX.utils.aoa_to_sheet(camp);
    ws5["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws5, "Campanhas");
  }

  const scope = report.selection.scope === "team" ? "equipe" : "individual";
  const subj = report.selection.scope === "individual" ? slugify(report.title.replace(/^.*—\s*/, "")) : "equipe";
  XLSX.writeFile(wb, `relatorio-${scope}-${subj}-${report.month.key}.xlsx`);
}