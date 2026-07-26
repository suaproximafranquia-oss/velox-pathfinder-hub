/**
 * Relatório KPI Individual — PDF executivo.
 *
 * Reutiliza o padrão visual White Label da Atlas Platform (jsPDF).
 * Consome exclusivamente o KPI Manager: nada é digitado ou estimado.
 */
import { jsPDF } from "jspdf";
import { WORKSPACE } from "@/config/workspace";
import {
  INDICATORS,
  averageRow,
  campaignStatus,
  findMonth,
  formatCurrency,
  formatNumber,
  loadDataset,
  summarize,
  sumRow,
} from "./kpi-manager";
import type { ExecutiveUser } from "./executive-auth";

const NAVY: [number, number, number] = [12, 22, 44];
const GOLD: [number, number, number] = [176, 141, 87];
const TEXT: [number, number, number] = [40, 45, 60];
const MUTED: [number, number, number] = [120, 128, 145];
const LINE: [number, number, number] = [220, 222, 230];

function footer(doc: jsPDF, w: number, h: number) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(18, h - 18, w - 18, h - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(WORKSPACE.poweredBy, 18, h - 12);
  doc.text("Relatório gerado automaticamente pela Atlas Platform.", w - 18, h - 12, { align: "right" });
}

function section(doc: jsPDF, title: string, y: number): number {
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

export function generateKpiIndividualReport(user: ExecutiveUser, monthKey: string): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const month = findMonth(monthKey);
  const ds = loadDataset(user.id, monthKey);
  const summary = summarize(ds);
  const status = campaignStatus(summary.salesValue);

  // ============ CAPA ============
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, h, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(22, 32, 60, 32);
  doc.setTextColor(...GOLD);
  doc.setFontSize(9);
  doc.text("ATLAS PLATFORM", 22, 28, { charSpace: 2 });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text("Relatório KPI Individual", 22, 90, { charSpace: 1 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(user.name, 22, 108);
  doc.setDrawColor(...GOLD);
  doc.line(22, 118, 80, 118);
  const info: [string, string][] = [
    ["Competência", month.label],
    ["Data de emissão", new Date().toLocaleDateString("pt-BR")],
    ["Nível na campanha", status.level?.label ?? "Em progressão"],
    ["Workspace", WORKSPACE.workspaceName],
  ];
  let cy = 138;
  for (const [k, v] of info) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(k.toUpperCase(), 22, cy, { charSpace: 1.2 });
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(v, 22, cy + 7);
    cy += 18;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);
  doc.text(WORKSPACE.poweredBy, 22, h - 22, { charSpace: 1.2 });

  // ============ PÁGINA 2 — INDICADORES ============
  doc.addPage();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("ATLAS PLATFORM · KPI INDIVIDUAL", 22, 18, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text(`Resumo — ${month.label}`, 22, 40);

  let y = section(doc, "Resumo Executivo", 58);
  const kv: [string, string][] = [
    ["Leads", formatNumber(summary.leads)],
    ["Apresentações", formatNumber(summary.presentations)],
    ["Videoconferências feitas", formatNumber(sumRow(ds.matrix, "videosDone"))],
    ["COFs enviadas", formatNumber(summary.contractsSent)],
    ["Vendas", formatNumber(summary.sales)],
    ["Faturamento", formatCurrency(summary.salesValue)],
  ];
  const colW = (w - 44) / 2;
  for (let i = 0; i < kv.length; i++) {
    const [k, v] = kv[i];
    const cx = 22 + (i % 2) * colW;
    const yy = y + Math.floor(i / 2) * 18;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), cx, yy, { charSpace: 1.1 });
    doc.setFontSize(12);
    doc.setTextColor(...TEXT);
    doc.text(v, cx, yy + 6);
  }
  y += Math.ceil(kv.length / 2) * 18 + 6;

  // Barra da campanha
  y = section(doc, "Campanha Velox", y + 4);
  doc.setDrawColor(...LINE);
  doc.setFillColor(...LINE);
  doc.roundedRect(22, y, w - 44, 4, 2, 2, "F");
  doc.setFillColor(...GOLD);
  doc.roundedRect(22, y, ((w - 44) * Math.min(100, status.percent)) / 100, 4, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    `${status.level?.label ?? "Em progressão"} · ${status.percent.toFixed(1).replace(".", ",")}% de 100.000,00`,
    22,
    y + 11,
  );
  y += 20;

  // Tabela detalhada
  y = section(doc, "Indicadores do Mês", y + 4);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Indicador", 22, y);
  doc.text("Total", w - 70, y, { align: "right" });
  doc.text("Média diária", w - 22, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...LINE);
  doc.line(22, y, w - 22, y);
  y += 5;
  for (const ind of INDICATORS) {
    if (y > h - 30) {
      footer(doc, w, h);
      doc.addPage();
      y = 30;
    }
    const total = sumRow(ds.matrix, ind.id);
    const avg = averageRow(ds.matrix, ind.id, month);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(ind.label, 22, y);
    doc.text(
      ind.unit === "currency" ? formatCurrency(total) : formatNumber(total),
      w - 70,
      y,
      { align: "right" },
    );
    doc.text(
      ind.unit === "currency" ? formatCurrency(avg) : avg.toFixed(1).replace(".", ","),
      w - 22,
      y,
      { align: "right" },
    );
    y += 6.5;
  }

  footer(doc, w, h);

  const slug = user.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  doc.save(`kpi-${slug}-${monthKey}.pdf`);
}