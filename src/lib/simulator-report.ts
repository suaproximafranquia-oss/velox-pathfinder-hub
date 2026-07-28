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
  executiveName?: string | null;
  executiveTitle?: string | null;
  audienceLabel?: string | null;
  interests?: string[];
}): { filename: string } {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Faixa institucional Velox (azul profundo + acento dourado)
  doc.setFillColor(15, 31, 58); // navy deep
  doc.rect(0, 0, pageWidth, 96, "F");
  doc.setFillColor(198, 156, 84); // gold
  doc.rect(0, 96, pageWidth, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VELOX · SIMULADOR INSTITUCIONAL", margin, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Relatório de Potencial de Receita", margin, 72);

  let y = 128;
  doc.setTextColor(60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const now = new Date();
  doc.text(
    `${WORKSPACE.workspaceName} · Emitido em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    margin,
    y,
  );
  y += 26;

  // Bloco de identificação
  doc.setDrawColor(220);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 96, 6, 6, "S");
  const colW = (pageWidth - margin * 2) / 2;
  const putField = (label: string, value: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(value || "—", x, yy + 14);
  };
  putField("Investidor", input.investorName || "—", margin + 14, y + 20);
  putField(
    "Executivo responsável",
    input.executiveName
      ? `${input.executiveName}${input.executiveTitle ? ` — ${input.executiveTitle}` : ""}`
      : "A definir",
    margin + 14 + colW,
    y + 20,
  );
  putField(
    "Perfil identificado",
    input.audienceLabel || "Perfil geral — a ser detalhado com o especialista",
    margin + 14,
    y + 60,
  );
  putField("Data · Horário", now.toLocaleString("pt-BR"), margin + 14 + colW, y + 60);
  y += 118;

  // Cabeçalho de resultado
  doc.setFillColor(240, 244, 250);
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 68, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text("Receita potencial mensal", margin + 14, y + 14);
  doc.text("Receita potencial anual", margin + colW + 14, y + 14);
  doc.setFontSize(18);
  doc.setTextColor(15, 31, 58);
  doc.text(formatBRL(input.total), margin + 14, y + 40);
  doc.text(formatBRL(input.total * 12), margin + colW + 14, y + 40);
  y += 92;

  // Tabela por produto
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Produtos simulados", margin, y);
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
  y += 28;

  // Interesses declarados no Manual (quando existirem)
  if (input.interests && input.interests.length) {
    if (y > 700) {
      doc.addPage();
      y = 60;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text("Interesses declarados", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    const wrapped = doc.splitTextToSize(
      input.interests.map((i) => `• ${i}`).join("   "),
      pageWidth - margin * 2,
    );
    doc.text(wrapped, margin, y);
    y += wrapped.length * 14 + 8;
  }

  // Próximos passos
  if (y > 680) {
    doc.addPage();
    y = 60;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text("Próximos passos", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  const steps = [
    "1. Conversar com seu Executivo de Expansão para revisar o cenário e alinhar expectativas.",
    "2. Aprofundar produtos e frentes priorizadas de acordo com o seu perfil e mercado.",
    "3. Avaliar o modelo de operação (Home Office ou Loja) e o plano de implantação.",
  ];
  for (const s of steps) {
    const w = doc.splitTextToSize(s, pageWidth - margin * 2);
    doc.text(w, margin, y);
    y += w.length * 13 + 4;
  }
  y += 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120);
  const disclaimer =
    "Aviso: esta simulação possui caráter exclusivamente ilustrativo e educacional. Os percentuais utilizados representam parâmetros médios definidos apenas para fins de simulação e não constituem promessa ou garantia de faturamento.";
  const wrapped = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(wrapped, margin, y);

  // Rodapé institucional em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(220);
    doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text("Velox Soluções Financeiras · Portal Velox", margin, pageHeight - 24);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  const filename = `simulador-velox-${Date.now()}.pdf`;
  doc.save(filename);
  return { filename };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}