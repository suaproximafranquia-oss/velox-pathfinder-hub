/**
 * Base Oficial de Conhecimento — armazenamento local por workspace.
 *
 * Cada documento contém metadados de gestão (visibilidade, autor, tipo,
 * status, timestamps) e o texto extraído já segmentado em chunks para
 * consulta pela IA Corporativa. O armazenamento é local (localStorage),
 * mantendo o padrão da fundação atual — a estrutura de dados foi
 * desenhada para migração direta para backend (Lovable Cloud) no futuro,
 * sem quebra de contrato.
 */

export type DocumentVisibility = "publico" | "restrito";
export type DocumentType = "pdf" | "docx" | "txt";
export type DocumentStatus = "processando" | "ativo" | "erro";

export type KnowledgeDocument = {
  id: string;
  workspaceId: string;
  name: string;
  type: DocumentType;
  visibility: DocumentVisibility;
  description?: string;
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  updatedAt: string;
  status: DocumentStatus;
  /** Texto extraído já segmentado em chunks curtos para retrieval. */
  chunks: string[];
};

const DOCS_KEY = "atlas:knowledge:v1";

export const VISIBILITY_LABEL: Record<DocumentVisibility, string> = {
  publico: "Público",
  restrito: "Restrito",
};

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  processando: "Processando",
  ativo: "Ativo",
  erro: "Erro",
};

function readAll(): KnowledgeDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as KnowledgeDocument[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(docs: KnowledgeDocument[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

export function listDocuments(workspaceId: string): KnowledgeDocument[] {
  return readAll()
    .filter((d) => d.workspaceId === workspaceId)
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
}

export function addDocument(doc: KnowledgeDocument) {
  const all = readAll();
  all.push(doc);
  writeAll(all);
}

export function updateDocument(id: string, patch: Partial<KnowledgeDocument>) {
  const all = readAll();
  const i = all.findIndex((d) => d.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
}

export function removeDocument(id: string) {
  writeAll(readAll().filter((d) => d.id !== id));
}

export function resetWorkspace(workspaceId: string) {
  writeAll(readAll().filter((d) => d.workspaceId !== workspaceId));
}

export function newDocumentId(): string {
  return `doc_${Math.random().toString(36).slice(2, 10)}`;
}

/** Divide o texto extraído em chunks de ~800 caracteres respeitando parágrafos. */
export function chunkText(text: string, size = 800): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paragraphs) {
    if ((cur + "\n\n" + p).length > size && cur) {
      chunks.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

/** Extrai texto de PDF, DOCX ou TXT no navegador. */
export async function extractTextFromFile(file: File): Promise<{ text: string; type: DocumentType }> {
  const res = await ingestFile(file);
  return { text: res.text, type: res.type };
}

/**
 * Pipeline robusto de ingestão de documentos.
 *
 * Fluxo obrigatório:
 * 1) Identifica tipo → 2) Tenta texto nativo → 3) Se ausente/insuficiente,
 * NÃO retorna erro; converte páginas em imagens de alta resolução e executa
 * OCR página por página → 4) Falhas de página não interrompem o restante →
 * 5) Devolve o máximo de conteúdo possível + log detalhado + flag `partial`.
 *
 * Preserva a assinatura de `extractTextFromFile` (compat) e adiciona canal
 * de progresso para a Central de Conhecimento renderizar os logs em tempo real.
 */
export type IngestLog = { ok: boolean; msg: string };
export type IngestProgress = (log: IngestLog) => void;
export type IngestResult = {
  text: string;
  type: DocumentType;
  logs: IngestLog[];
  pagesTotal: number;
  pagesProcessed: number;
  usedOcr: boolean;
  partial: boolean;
};

/** Heurística: considera "insuficiente" menos de ~40 chars por página. */
function isTextInsufficient(text: string, pages: number): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return true;
  const perPage = clean.length / Math.max(1, pages);
  return perPage < 40;
}

export async function ingestFile(
  file: File,
  onLog?: IngestProgress,
): Promise<IngestResult> {
  const logs: IngestLog[] = [];
  const push = (ok: boolean, msg: string) => {
    const entry = { ok, msg };
    logs.push(entry);
    onLog?.(entry);
  };

  push(true, "Upload recebido");
  const name = file.name.toLowerCase();

  // TXT
  if (name.endsWith(".txt") || file.type === "text/plain") {
    push(true, "Documento identificado: TXT");
    const text = await file.text();
    push(true, `Texto nativo extraído (${text.length} caracteres)`);
    return {
      text,
      type: "txt",
      logs,
      pagesTotal: 1,
      pagesProcessed: 1,
      usedOcr: false,
      partial: false,
    };
  }

  // DOCX
  if (name.endsWith(".docx")) {
    push(true, "Documento identificado: DOCX");
    // @ts-expect-error subpath sem tipos declarados
    const mammoth = await import("mammoth/mammoth.browser.js");
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    push(true, `Texto nativo extraído (${(value as string).length} caracteres)`);
    return {
      text: value,
      type: "docx",
      logs,
      pagesTotal: 1,
      pagesProcessed: 1,
      usedOcr: false,
      partial: false,
    };
  }

  // PDF — tentativa nativa + fallback OCR
  if (name.endsWith(".pdf")) {
    push(true, "Documento identificado: PDF");
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pagesTotal = doc.numPages;
    push(true, `PDF com ${pagesTotal} página(s)`);

    // 1) Texto nativo
    let nativeText = "";
    let nativeFailures = 0;
    for (let i = 1; i <= pagesTotal; i++) {
      try {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strs = content.items.map((it: unknown) => (it as { str: string }).str);
        nativeText += strs.join(" ") + "\n\n";
      } catch {
        nativeFailures++;
      }
    }
    const nativeInsufficient = isTextInsufficient(nativeText, pagesTotal);
    if (nativeInsufficient) {
      push(false, "Texto nativo inexistente ou insuficiente");
    } else {
      push(true, `Texto nativo extraído (${nativeText.replace(/\s+/g, " ").trim().length} caracteres)`);
    }

    // Se o texto nativo já é suficiente, retorna direto.
    if (!nativeInsufficient) {
      return {
        text: nativeText,
        type: "pdf",
        logs,
        pagesTotal,
        pagesProcessed: pagesTotal - nativeFailures,
        usedOcr: false,
        partial: nativeFailures > 0,
      };
    }

    // 2) Fallback OCR — renderiza cada página em canvas de alta resolução
    push(true, "OCR iniciado (Português + Inglês)");
    const tesseract = await import("tesseract.js");
    // Idiomas combinados para maximizar reconhecimento de material comercial.
    const worker = await tesseract.createWorker(["por", "eng"]);

    const pageTexts: string[] = [];
    let ocrProcessed = 0;

    async function renderPage(pageNum: number, scale: number): Promise<string> {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D indisponível");
      // Fundo branco melhora OCR em slides com fundo claro/colorido.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvasContext: ctx,
        viewport,
        // Novas versões do pdfjs exigem `canvas` no argumento.
        canvas,
      } as unknown as Parameters<typeof page.render>[0]).promise;
      return canvas.toDataURL("image/png");
    }

    for (let i = 1; i <= pagesTotal; i++) {
      try {
        // Estratégia 1 — escala padrão
        const img = await renderPage(i, 2);
        const { data } = await worker.recognize(img);
        let pageText = (data.text || "").trim();

        // Validação: se muito pouco reconhecido, tenta escala maior.
        if (pageText.replace(/\s+/g, " ").length < 30) {
          try {
            const imgHi = await renderPage(i, 3);
            const retry = await worker.recognize(imgHi);
            const retryText = (retry.data.text || "").trim();
            if (retryText.length > pageText.length) pageText = retryText;
          } catch {
            /* mantém a primeira tentativa */
          }
        }

        pageTexts.push(pageText);
        ocrProcessed++;
      } catch (e) {
        // Falha de página não interrompe o processamento das demais.
        push(false, `Falha na página ${i}: ${(e as Error).message}`);
        pageTexts.push("");
      }
    }

    try {
      await worker.terminate();
    } catch {
      /* noop */
    }

    // 3) Reconstrução preservando ordem das páginas.
    const ocrText = pageTexts
      .map((t, i) => (t ? `--- Página ${i + 1} ---\n${t}` : ""))
      .filter(Boolean)
      .join("\n\n");

    const blocks = ocrText.split(/\n{2,}/).filter((b) => b.trim().length > 0).length;
    push(true, `OCR concluído · ${ocrProcessed}/${pagesTotal} página(s) processada(s)`);
    push(true, `${blocks} bloco(s) de texto identificado(s)`);

    const merged = [nativeText, ocrText].filter((t) => t && t.trim()).join("\n\n");
    const finalText = merged.trim() || ocrText;

    // Nunca descartar automaticamente conteúdo parcial: preserva o que houver.
    const partial = ocrProcessed < pagesTotal || !finalText;
    if (partial && finalText) {
      push(false, "Documento parcialmente indexado");
    } else if (!finalText) {
      push(false, "Nenhum conteúdo pôde ser reconhecido");
    } else {
      push(true, "Documento indexado");
    }

    return {
      text: finalText,
      type: "pdf",
      logs,
      pagesTotal,
      pagesProcessed: ocrProcessed,
      usedOcr: true,
      partial,
    };
  }

  throw new Error("Formato não suportado. Envie PDF, Word (.docx) ou TXT.");
}

/** Retrieval simples por sobreposição de tokens (sem embeddings). */
export type RetrievedPassage = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  score: number;
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

export function retrievePassages(
  question: string,
  docs: KnowledgeDocument[],
  topK = 4,
): RetrievedPassage[] {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return [];
  const passages: RetrievedPassage[] = [];
  for (const doc of docs) {
    if (doc.status !== "ativo") continue;
    doc.chunks.forEach((chunk, idx) => {
      const cTokens = tokenize(chunk);
      let overlap = 0;
      for (const t of cTokens) if (qTokens.has(t)) overlap++;
      if (overlap > 0) {
        passages.push({
          documentId: doc.id,
          documentName: doc.name,
          chunkIndex: idx,
          text: chunk,
          score: overlap,
        });
      }
    });
  }
  passages.sort((a, b) => b.score - a.score);
  return passages.slice(0, topK);
}

/** Filtra documentos visíveis para um dado perfil ativo. */
export function visibleDocuments(
  docs: KnowledgeDocument[],
  audience: "publico" | "interno",
): KnowledgeDocument[] {
  if (audience === "publico") return docs.filter((d) => d.visibility === "publico");
  return docs;
}
/* ================================================================== */
/* BASE OFICIAL ÚNICA — sincronização com o backend (Bloco 3)          */
/* ------------------------------------------------------------------ */
/* O armazenamento local passa a ser apenas um cache de leitura rápida. */
/* A fonte de verdade é o backend: o que o Administrador publica fica   */
/* imediatamente disponível para toda a equipe e para a IA Corporativa. */
/* ================================================================== */

import {
  deleteOfficialDocument,
  listOfficialDocuments,
  resetOfficialBase,
  saveOfficialDocument,
} from "@/lib/knowledge.functions";

function replaceWorkspaceCache(workspaceId: string, docs: KnowledgeDocument[]) {
  const others = readAll().filter((d) => d.workspaceId !== workspaceId);
  writeAll([...others, ...docs]);
}

/** Baixa a Base Oficial do backend e atualiza o cache local. */
export async function pullOfficialBase(
  workspaceId: string,
): Promise<KnowledgeDocument[]> {
  try {
    const res = await listOfficialDocuments({ data: { workspaceId } });
    const docs = (res.documents ?? []) as KnowledgeDocument[];
    replaceWorkspaceCache(workspaceId, docs);
    return listDocuments(workspaceId);
  } catch {
    // Offline ou sessão expirada: mantém o cache local já disponível.
    return listDocuments(workspaceId);
  }
}

/** Publica (ou atualiza) um documento na Base Oficial compartilhada. */
export async function publishDocument(
  actorId: string,
  doc: KnowledgeDocument,
): Promise<void> {
  const all = readAll();
  const i = all.findIndex((d) => d.id === doc.id);
  if (i < 0) all.push(doc);
  else all[i] = doc;
  writeAll(all);
  await saveOfficialDocument({ data: { actorId, document: doc } });
}

/** Remove o documento da Base Oficial (backend + cache). */
export async function removeOfficialDocument(actorId: string, id: string) {
  removeDocument(id);
  await deleteOfficialDocument({ data: { actorId, id } });
}

/** Reseta a Base Oficial do workspace (backend + cache). */
export async function resetOfficialWorkspace(actorId: string, workspaceId: string) {
  resetWorkspace(workspaceId);
  await resetOfficialBase({ data: { actorId, workspaceId } });
}

/** Documento local pelo id (utilitário para republicar após indexação). */
export function getDocument(id: string): KnowledgeDocument | null {
  return readAll().find((d) => d.id === id) ?? null;
}
