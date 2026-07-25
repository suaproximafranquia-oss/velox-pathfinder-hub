/**
 * Gerador do Relatório Executivo — Atlas Platform.
 *
 * Documento White Label: nenhum elemento visual pertence a um workspace
 * específico. Marca d'água institucional abstrata da Atlas Platform.
 * Linguagem consultiva; nunca comercial.
 */

import { jsPDF } from "jspdf";
import type { Investor } from "./executive-data";
import { STATUS_LABEL, formatRelative } from "./executive-data";
import { WORKSPACE } from "@/config/workspace";

type ProfileReading = {
  headline: string;
  summary: string;
  strengths: string[];
  attention: string[];
  nextSteps: string[];
  traits: string[];
};

function readProfile(inv: Investor): ProfileReading {
  const engaged = inv.aiInteractions >= 5 || inv.readingPct >= 60;
  const advanced = inv.readingPct >= 80 || inv.diagnostic === "concluído";
  if (advanced) {
    return {
      headline: "Investidor em estágio avançado de preparação",
      summary:
        "Concluiu a maior parte da jornada educativa e demonstra clareza sobre o modelo apresentado. Está pronto para uma conversa consultiva de aprofundamento.",
      traits: [
        "Alto nível de conclusão da jornada",
        "Consistência de leitura ao longo dos capítulos",
        "Diagnóstico consultivo concluído",
      ],
      strengths: [
        "Comprometimento com o próprio processo de decisão",
        "Disposição para compreender o modelo em profundidade",
        "Clareza sobre expectativas e responsabilidades",
      ],
      attention: [
        "Alinhar expectativas de retorno com o horizonte real do negócio",
        "Confirmar disponibilidade para a etapa de treinamento",
      ],
      nextSteps: [
        "Agendar conversa consultiva para revisão dos pontos-chave",
        "Aprofundar questões operacionais e de suporte",
        "Formalizar próximos passos apenas quando houver segurança plena",
      ],
    };
  }
  if (engaged) {
    return {
      headline: "Investidor engajado em processo de amadurecimento",
      summary:
        "Avança de forma consistente pela jornada e interage com o conteúdo. Demonstra interesse legítimo em compreender o modelo antes de qualquer decisão.",
      traits: [
        "Participação ativa nos capítulos",
        "Interações consultivas com o assistente",
        "Ritmo de leitura equilibrado",
      ],
      strengths: [
        "Curiosidade estruturada e postura investigativa",
        "Abertura ao aprendizado antes de decidir",
      ],
      attention: [
        "Concluir os capítulos remanescentes para uma visão completa",
        "Aprofundar temas de investimento, operação e suporte",
      ],
      nextSteps: [
        "Estimular a conclusão da jornada",
        "Oferecer materiais complementares quando pertinente",
        "Reservar a conversa consultiva para o momento adequado",
      ],
    };
  }
  return {
    headline: "Investidor em fase inicial de exploração",
    summary:
      "Iniciou o contato com a jornada e está formando as primeiras percepções sobre o modelo. Recomenda-se acompanhamento discreto, sem pressão comercial.",
    traits: [
      "Primeiros contatos com a jornada educativa",
      "Percepção do modelo ainda em construção",
    ],
    strengths: [
      "Disposição inicial para conhecer a proposta",
      "Abertura para receber informação de forma organizada",
    ],
    attention: [
      "Baixa quantidade de capítulos concluídos até o momento",
      "Diagnóstico consultivo ainda não finalizado",
    ],
    nextSteps: [
      "Convidar naturalmente à retomada da leitura",
      "Sugerir os capítulos iniciais para consolidar a compreensão",
      "Preservar o ritmo do investidor, sem forçar decisões",
    ],
  };
}

// Paleta institucional Atlas — coerente com o app, mas neutra.
const COLOR_NAVY: [number, number, number] = [12, 22, 44];
const COLOR_NAVY_SOFT: [number, number, number] = [30, 42, 68];
const COLOR_GOLD: [number, number, number] = [176, 141, 87];
const COLOR_TEXT: [number, number, number] = [40, 45, 60];
const COLOR_MUTED: [number, number, number] = [120, 128, 145];
const COLOR_LINE: [number, number, number] = [220, 222, 230];

function drawWatermark(doc: jsPDF, pageW: number, pageH: number) {
  // Marca d'água institucional discreta — texto vertical na lateral,
  // muito baixa opacidade, sem sobrepor o conteúdo central da página.
  doc.saveGraphicsState();
  // @ts-expect-error - GState exists at runtime
  doc.setGState(new doc.GState({ opacity: 0.04 }));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(42);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("ATLAS PLATFORM", pageW - 10, pageH / 2 + 40, {
    align: "left",
    angle: 90,
    charSpace: 4,
  });
  doc.restoreGraphicsState();
  doc.setTextColor(...COLOR_TEXT);
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number) {
  const y = pageH - 14;
  doc.setDrawColor(...COLOR_LINE);
  doc.setLineWidth(0.3);
  doc.line(18, y - 5, pageW - 18, y - 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(WORKSPACE.poweredBy, 18, y);
  doc.text(
    "Relatório gerado automaticamente pela Atlas Platform.",
    pageW - 18,
    y,
    { align: "right" },
  );
  doc.setTextColor(...COLOR_TEXT);
}

function sectionTitle(
  doc: jsPDF,
  text: string,
  y: number,
  pageW: number,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_GOLD);
  doc.text(text.toUpperCase(), 22, y, { charSpace: 1.4 });
  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.4);
  doc.line(22, y + 2.5, 60, y + 2.5);
  doc.setTextColor(...COLOR_TEXT);
  return y + 10;
}

function keyValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(label.toUpperCase(), x, y, { charSpace: 1.1 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(value, x, y + 6);
}

function bulletList(
  doc: jsPDF,
  items: string[],
  x: number,
  y: number,
  maxWidth: number,
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TEXT);
  let cy = y;
  for (const item of items) {
    doc.setTextColor(...COLOR_GOLD);
    doc.text("—", x, cy);
    doc.setTextColor(...COLOR_TEXT);
    const lines = doc.splitTextToSize(item, maxWidth - 8) as string[];
    doc.text(lines, x + 6, cy);
    cy += lines.length * 5 + 2;
  }
  return cy;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statusLabel(inv: Investor): string {
  return STATUS_LABEL[inv.status];
}

export function generateInvestorReport(inv: Investor): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date();
  const profile = readProfile(inv);

  // ============ CAPA ============
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(0, 0, pageW, pageH, "F");

  // Detalhes abstratos: linhas douradas
  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.4);
  doc.line(22, 32, 60, 32);
  doc.line(pageW - 60, pageH - 32, pageW - 22, pageH - 32);

  doc.setTextColor(...COLOR_GOLD);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("ATLAS PLATFORM", 22, 28, { charSpace: 2 });

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Relatório Executivo", 22, 90, { charSpace: 1 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text("Diagnóstico do Investidor", 22, 108);

  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.6);
  doc.line(22, 118, 80, 118);

  const coverInfo: [string, string][] = [
    ["Nome", inv.name],
    ["Cidade", inv.city],
    ["Data", formatDate(now.toISOString())],
    ["Workspace", WORKSPACE.workspaceName],
  ];
  let cy = 138;
  for (const [k, v] of coverInfo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GOLD);
    doc.text(k.toUpperCase(), 22, cy, { charSpace: 1.2 });
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(v, 22, cy + 7);
    cy += 18;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);
  doc.text(WORKSPACE.poweredBy, 22, pageH - 22, { charSpace: 1.2 });
  doc.text("Documento consultivo — uso institucional.", pageW - 22, pageH - 22, {
    align: "right",
  });

  // ============ PÁGINA 2 — RESUMO EXECUTIVO ============
  doc.addPage();
  drawWatermark(doc, pageW, pageH);
  doc.setTextColor(...COLOR_TEXT);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("ATLAS PLATFORM · RELATÓRIO EXECUTIVO", 22, 18, { charSpace: 1.2 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("Resumo Executivo", 22, 40);

  let y = sectionTitle(doc, "Indicadores da Jornada", 58, pageW);
  const readingMinutes = Math.max(1, Math.round((inv.readingPct / 100) * 10));
  const kvItems: [string, string][] = [
    ["Tempo de leitura", `${readingMinutes} min estimados`],
    ["Percentual concluído", `${inv.readingPct}%`],
    ["Capítulo atual", inv.currentChapter],
    ["Status", statusLabel(inv)],
    ["Última atividade", formatRelative(inv.lastActivity)],
    ["Diagnóstico", inv.diagnostic],
  ];
  const colW = (pageW - 44) / 2;
  for (let i = 0; i < kvItems.length; i++) {
    const [k, v] = kvItems[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    keyValue(doc, k, v, 22 + col * colW, y + row * 20);
  }
  y += Math.ceil(kvItems.length / 2) * 20 + 8;

  // Barra de progresso institucional
  doc.setDrawColor(...COLOR_LINE);
  doc.setFillColor(...COLOR_LINE);
  doc.roundedRect(22, y, pageW - 44, 3, 1.5, 1.5, "F");
  doc.setFillColor(...COLOR_GOLD);
  doc.roundedRect(22, y, ((pageW - 44) * inv.readingPct) / 100, 3, 1.5, 1.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Progresso na jornada educativa · ${inv.readingPct}%`, 22, y + 10);
  y += 20;

  // Perfil identificado
  y = sectionTitle(doc, "Perfil Identificado", y + 4, pageW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_NAVY);
  const headlineLines = doc.splitTextToSize(profile.headline, pageW - 44) as string[];
  doc.text(headlineLines, 22, y);
  y += headlineLines.length * 6 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_TEXT);
  const summaryLines = doc.splitTextToSize(profile.summary, pageW - 44) as string[];
  doc.text(summaryLines, 22, y);
  y += summaryLines.length * 5.5 + 6;

  // Características
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("CARACTERÍSTICAS PREDOMINANTES", 22, y, { charSpace: 1.1 });
  y += 6;
  y = bulletList(doc, profile.traits, 22, y, pageW - 44) + 4;

  // Pontos fortes / atenção lado a lado
  const colHalf = (pageW - 50) / 2;
  const startY = y;
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("PONTOS FORTES", 22, startY, { charSpace: 1.1 });
  const endStrengths = bulletList(doc, profile.strengths, 22, startY + 6, colHalf);

  doc.setTextColor(...COLOR_MUTED);
  doc.text("PONTOS DE ATENÇÃO", 22 + colHalf + 6, startY, { charSpace: 1.1 });
  const endAttention = bulletList(
    doc,
    profile.attention,
    22 + colHalf + 6,
    startY + 6,
    colHalf,
  );
  y = Math.max(endStrengths, endAttention) + 4;

  drawFooter(doc, pageW, pageH);

  // ============ PÁGINA 3 — PRÓXIMOS PASSOS + HISTÓRICO ============
  doc.addPage();
  drawWatermark(doc, pageW, pageH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("ATLAS PLATFORM · RELATÓRIO EXECUTIVO", 22, 18, { charSpace: 1.2 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("Próximos Passos & Histórico", 22, 40);

  let y3 = sectionTitle(doc, "Próximos Passos Recomendados", 58, pageW);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_TEXT);
  const nextIntro = doc.splitTextToSize(
    "Sugestões consultivas para preservar o ritmo do investidor e apoiar sua tomada de decisão de forma natural.",
    pageW - 44,
  ) as string[];
  doc.text(nextIntro, 22, y3);
  y3 += nextIntro.length * 5.5 + 4;
  y3 = bulletList(doc, profile.nextSteps, 22, y3, pageW - 44) + 6;

  y3 = sectionTitle(doc, "Histórico", y3 + 4, pageW);
  // Timeline institucional
  const timeline: [string, string][] = [
    ["Início da jornada", formatDate(now.toISOString())],
    ["Última atividade", `${formatRelative(inv.lastActivity)} · ${formatDate(inv.lastActivity)}`],
    [
      "Capítulos concluídos",
      `${Math.round((inv.readingPct / 100) * 13)} de 13 capítulos`,
    ],
    ["Interações consultivas", `${inv.aiInteractions} registradas`],
  ];
  const tX = 26;
  let tY = y3 + 2;
  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.3);
  doc.line(tX, tY, tX, tY + timeline.length * 16);
  for (const [k, v] of timeline) {
    doc.setFillColor(...COLOR_GOLD);
    doc.circle(tX, tY + 3, 1.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(k.toUpperCase(), tX + 8, tY + 2, { charSpace: 1.1 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(v, tX + 8, tY + 8);
    tY += 16;
  }

  // Nota consultiva final
  const noteY = pageH - 45;
  doc.setDrawColor(...COLOR_LINE);
  doc.setFillColor(248, 249, 251);
  doc.roundedRect(22, noteY, pageW - 44, 20, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_NAVY_SOFT);
  const noteLines = doc.splitTextToSize(
    "Este documento tem caráter consultivo. Sua finalidade é apoiar o acompanhamento do investidor ao longo da jornada educativa, respeitando seu ritmo e sua autonomia na tomada de decisão.",
    pageW - 52,
  ) as string[];
  doc.text(noteLines, 26, noteY + 6);

  drawFooter(doc, pageW, pageH);

  const safeName = inv.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  doc.save(`relatorio-executivo-${safeName}.pdf`);
}