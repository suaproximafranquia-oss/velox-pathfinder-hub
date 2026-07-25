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
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return { text: await file.text(), type: "txt" };
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return { text: value, type: "docx" };
  }
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    // @ts-expect-error worker resolvido pelo Vite
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strs = content.items.map((it: unknown) => (it as { str: string }).str);
      text += strs.join(" ") + "\n\n";
    }
    return { text, type: "pdf" };
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