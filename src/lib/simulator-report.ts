/**
 * Gerador do PDF do Simulador de Potencial de Receita.
 *
 * Produz um relatório enxuto (uma página, quando possível) com o
 * resumo dos produtos escolhidos, o cenário mensal/anual estimado e o
 * aviso institucional obrigatório. Executa no navegador via jsPDF.
 */
import { jsPDF } from "jspdf";
import { formatBRL, type ProductCategory, type SimulatorProduct } from "@/lib/simulator-products";
import { WORKSPACE } from "@/config/workspace";

export type SimulatorReportRow = {
  product: SimulatorProduct;
  input: number;
  volume: number;
  revenue: number;
};

export function generateSimulatorPdf(input: {
  investorName: string;
  rows: SimulatorReportRow[];
  total: number;
  byCategory: Map<ProductCategory, number>;
}): { filename: string } {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 60;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Simulador de Potencial de Receita", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `${WORKSPACE.workspaceName} · Documento gerado em ${new Date().toLocaleString("pt-BR")}`,
    margin,
    y,
  );
  y += 30;

  doc.setTextColor(30);
  doc.setFontSize(12);
  doc.text(`Investidor: ${input.investorName || "—"}`, margin, y);
  y += 24;

  // Cabeçalho de resultado
  doc.setFillColor(240, 244, 250);
  doc.rect(margin, y - 4, pageWidth - margin * 2, 60, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Receita potencial mensal", margin + 14, y + 14);
  doc.text("Receita potencial anual", margin + (pageWidth - margin * 2) / 2 + 14, y + 14);
  doc.setFontSize(18);
  doc.text(formatBRL(input.total), margin + 14, y + 40);
  doc.text(formatBRL(input.total * 12), margin + (pageWidth - margin * 2) / 2 + 14, y + 40);
  y += 84;

  // Tabela por produto
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalhamento por produto", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const colX = { name: margin, cat: margin + 200, vol: margin + 330, rev: pageWidth - margin };
  doc.text("Produto", colX.name, y);
  doc.text("Categoria", colX.cat, y);
  doc.text("Volume", colX.vol, y);
  doc.text("Receita", colX.rev, y, { align: "right" });
  y += 4;
  doc.setDrawColor(210);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;
  doc.setTextColor(30);
  const rows = input.rows.filter((r) => r.input > 0);
  for (const r of rows) {
    if (y > 760) {
      doc.addPage();
      y = 60;
    }
    doc.text(truncate(r.product.name, 40), colX.name, y);
    doc.text(r.product.category, colX.cat, y);
    doc.text(formatBRL(r.volume), colX.vol, y);
    doc.text(formatBRL(r.revenue), colX.rev, y, { align: "right" });
    y += 14;
  }

  y += 12;
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text("Receita total estimada", margin, y);
  doc.text(formatBRL(input.total), pageWidth - margin, y, { align: "right" });
  y += 30;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120);
  const disclaimer =
    "Aviso: esta simulação possui caráter exclusivamente ilustrativo e educacional. Os percentuais utilizados representam parâmetros médios definidos apenas para fins de simulação e não constituem promessa ou garantia de faturamento.";
  const wrapped = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(wrapped, margin, y);

  const filename = `simulador-velox-${Date.now()}.pdf`;
  doc.save(filename);
  return { filename };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}