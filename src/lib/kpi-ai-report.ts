/**
 * Gerador de PDF para as respostas da IA Gerencial.
 * Segue o mesmo padrao visual White Label dos demais relatorios da
 * Atlas Platform (jsPDF, capa navy, detalhes em dourado).
 */
import { jsPDF } from "jspdf";
import { WORKSPACE } from "@/config/workspace";

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

export function generateKpiInsightPdf(input: {
  question: string;
  answer: string;
  monthLabel: string;
  scopeLabel: string;
  actorName: string;
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
  doc.text("ATLAS PLATFORM · IA GERENCIAL", 22, 28, { charSpace: 2 });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("Analise Gerencial de KPIs", 22, 102);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Competencia ${input.monthLabel}`, 22, 114);
  doc.setDrawColor(...GOLD);
  doc.line(22, 122, 80, 122);

  const meta: [string, string][] = [
    ["Escopo", input.scopeLabel],
    ["Solicitante", input.actorName],
    ["Data de emissao", new Date().toLocaleDateString("pt-BR")],
    ["Workspace", WORKSPACE.workspaceName],
  ];
  let cy = 142;
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(k.toUpperCase(), 22, cy, { charSpace: 1.2 });
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(v, 22, cy + 6);
    cy += 16;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);
  doc.text(WORKSPACE.poweredBy, 22, h - 22, { charSpace: 1.2 });

  // Pagina 2
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

  y = sectionTitle(doc, "Resposta da IA Gerencial", y);
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT);
  const paragraphs = input.answer.split(/\n{2,}/);
  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p.trim(), w - 44) as string[];
    for (const line of lines) {
      y = ensureRoom(doc, y, 6, w, h);
      doc.text(line, 22, y);
      y += 5.2;
    }
    y += 3;
  }

  footer(doc, w, h);

  doc.save(`ia-gerencial-${Date.now()}.pdf`);
}