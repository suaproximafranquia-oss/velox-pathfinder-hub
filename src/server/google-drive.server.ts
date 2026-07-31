/** Organização de documentos no Google Drive — SERVER ONLY. */
import { googleFetch } from "@/server/google.server";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFile = { id?: string; name?: string; webViewLink?: string; mimeType?: string };

async function findFolder(
  userId: string,
  name: string,
  parentId?: string,
): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const clauses = [
    `name = '${escaped}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ];
  const query = new URLSearchParams({
    q: clauses.join(" and "),
    fields: "files(id,name)",
    pageSize: "1",
  });
  const data = (await googleFetch(
    userId,
    "google_drive",
    `/drive/v3/files?${query.toString()}`,
  )) as { files?: DriveFile[] } | null;
  return data?.files?.[0]?.id ?? null;
}

export async function ensureFolder(
  userId: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const existing = await findFolder(userId, name, parentId);
  if (existing) return existing;
  const created = (await googleFetch(userId, "google_drive", "/drive/v3/files?fields=id", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    }),
  })) as DriveFile | null;
  if (!created?.id) throw new Error("Não foi possível criar a pasta no Drive.");
  return created.id;
}

/** Estrutura oficial: Portal Velox / <Investidor> */
export async function ensureInvestorFolder(
  userId: string,
  investorName: string,
): Promise<{ rootId: string; folderId: string }> {
  const rootId = await ensureFolder(userId, "Portal Velox");
  const folderId = await ensureFolder(userId, investorName || "Investidores", rootId);
  return { rootId, folderId };
}

export async function uploadDocument(
  userId: string,
  params: {
    folderId: string;
    name: string;
    mimeType: string;
    /** Conteúdo em base64 (sem prefixo data:). */
    contentBase64: string;
  },
): Promise<{ id: string; webViewLink: string | null }> {
  return uploadDocumentInternal(userId, params);
}

/**
 * Biblioteca oficial da IA Criativa.
 * Estrutura: Portal Velox / IA Criativa / {Templates, Logos, Referências,
 * Artes aprovadas, Artes geradas, Histórico}. Idempotente — nunca duplica.
 */
export async function ensureCreativeFolders(userId: string): Promise<{
  rootId: string;
  libraryId: string;
  templatesId: string;
  logosId: string;
  referencesId: string;
  approvedId: string;
  generatedId: string;
  historyId: string;
}> {
  const rootId = await ensureFolder(userId, "Portal Velox");
  const libraryId = await ensureFolder(userId, "IA Criativa", rootId);
  const [templatesId, logosId, referencesId, approvedId, generatedId, historyId] =
    await Promise.all([
      ensureFolder(userId, "Templates", libraryId),
      ensureFolder(userId, "Logos", libraryId),
      ensureFolder(userId, "Referências", libraryId),
      ensureFolder(userId, "Artes aprovadas", libraryId),
      ensureFolder(userId, "Artes geradas", libraryId),
      ensureFolder(userId, "Histórico", libraryId),
    ]);
  return {
    rootId,
    libraryId,
    templatesId,
    logosId,
    referencesId,
    approvedId,
    generatedId,
    historyId,
  };
}

async function findFileInFolder(
  userId: string,
  folderId: string,
  name: string,
): Promise<DriveFile | null> {
  const escaped = name.replace(/'/g, "\\'");
  const query = new URLSearchParams({
    q: `name = '${escaped}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id,name,webViewLink)",
    pageSize: "1",
  });
  const data = (await googleFetch(
    userId,
    "google_drive",
    `/drive/v3/files?${query.toString()}`,
  )) as { files?: DriveFile[] } | null;
  return data?.files?.[0] ?? null;
}

/** Envio idempotente: se já existir arquivo com o mesmo nome, reaproveita. */
export async function uploadUniqueDocument(
  userId: string,
  params: {
    folderId: string;
    name: string;
    mimeType: string;
    contentBase64: string;
  },
): Promise<{ id: string; webViewLink: string | null; reused: boolean }> {
  const existing = await findFileInFolder(userId, params.folderId, params.name);
  if (existing?.id) {
    return { id: existing.id, webViewLink: existing.webViewLink ?? null, reused: true };
  }
  const created = await uploadDocumentInternal(userId, params);
  return { ...created, reused: false };
}

async function uploadDocumentInternal(
  userId: string,
  params: {
    folderId: string;
    name: string;
    mimeType: string;
    contentBase64: string;
  },
): Promise<{ id: string; webViewLink: string | null }> {
  const boundary = `velox${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: params.name, parents: [params.folderId] });
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${params.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${params.contentBase64}\r\n` +
    `--${boundary}--`;
  const file = (await googleFetch(
    userId,
    "google_drive",
    "/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipart,
    },
  )) as DriveFile | null;
  if (!file?.id) throw new Error("Falha ao enviar o documento para o Drive.");
  return { id: file.id, webViewLink: file.webViewLink ?? null };
}