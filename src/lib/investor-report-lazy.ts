/**
 * Carregamento sob demanda do motor de relatórios em PDF.
 *
 * O gerador depende de bibliotecas pesadas de renderização. Mantê-lo fora
 * do pacote inicial deixa o Workspace abrir muito mais rápido; o download
 * acontece somente quando o executivo pede o relatório.
 */
import type { Investor } from "@/lib/executive-data";

export async function openInvestorReport(investor: Investor): Promise<void> {
  const { generateInvestorReport } = await import("@/lib/investor-report");
  generateInvestorReport(investor);
}