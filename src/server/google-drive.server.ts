/** Organização de documentos no Google Drive — SERVER ONLY. */
import { googleFetch } from "@/server/google.server";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Pasta corporativa oficial do Portal Velox no Drive. Todo material da
 * IA Criativa é arquivado aqui — nunca se pergunta o destino ao usuário.
 */
export { CORPORATE_DRIVE_FOLDER_ID as CORPORATE_FOLDER_ID } from "@/lib/corporate-drive";
import { CORPORATE_DRIVE_FOLDER_ID as CORPORATE_FOLDER_ID } from "@/lib/corporate-drive";

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
 * Arquiva uma peça diretamente na pasta corporativa oficial.
 * Nunca cria pastas novas e nunca pergunta o destino.
 */
export async function saveToCorporateFolder(
  userId: string,
  params: { name: string; mimeType: string; contentBase64: string },
): Promise<{ id: string; webViewLink: string | null }> {
  return uploadDocumentInternal(userId, { ...params, folderId: CORPORATE_FOLDER_ID });
}

/**
 * Modelo Oficial — arquivo único. Ao enviar um novo, o anterior é
 * removido: nunca existe histórico nem versões paralelas.
 */
export async function replaceOfficialModel(
  userId: string,
  params: { name: string; mimeType: string; contentBase64: string },
): Promise<{ id: string; webViewLink: string | null }> {
  const ext = params.name.split(".").pop()?.toLowerCase() || "png";
  const finalName = `modelo-oficial.${ext}`;
  for (const candidate of ["png", "jpg", "jpeg", "pdf", "svg"]) {
    const existing = await findFileInFolder(
      userId,
      CORPORATE_FOLDER_ID,
      `modelo-oficial.${candidate}`,
    );
    if (existing?.id) {
      try {
        await googleFetch(userId, "google_drive", `/drive/v3/files/${existing.id}`, {
          method: "DELETE",
        });
      } catch {
        /* remoção é complementar — o novo modelo continua sendo enviado */
      }
    }
  }
  return uploadDocumentInternal(userId, {
    folderId: CORPORATE_FOLDER_ID,
    name: finalName,
    mimeType: params.mimeType,
    contentBase64: params.contentBase64,
  });
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

/**
 * Valida a integração com a pasta corporativa oficial: acesso (leitura de
 * metadados), gravação (upload de um arquivo de teste) e leitura (listagem),
 * removendo o arquivo de teste ao final.
 */
export async function verifyCorporateFolder(
  userId: string,
): Promise<{ ok: boolean; message: string; folderName?: string }> {
  const folder = (await googleFetch(
    userId,
    "google_drive",
    `/drive/v3/files/${CORPORATE_FOLDER_ID}?fields=id,name,mimeType`,
  )) as DriveFile | null;
  if (!folder?.id) {
    return { ok: false, message: "Pasta corporativa não encontrada no Drive." };
  }

  const probeName = `velox-diagnostico-${Date.now()}.txt`;
  const created = await uploadDocumentInternal(userId, {
    folderId: CORPORATE_FOLDER_ID,
    name: probeName,
    mimeType: "text/plain",
    contentBase64: btoa("Portal Velox — teste de integração da IA Criativa."),
  });

  const found = await findFileInFolder(userId, CORPORATE_FOLDER_ID, probeName);

  try {
    await googleFetch(userId, "google_drive", `/drive/v3/files/${created.id}`, {
      method: "DELETE",
    });
  } catch {
    /* limpeza é complementar */
  }

  return {
    ok: Boolean(found?.id),
    folderName: folder.name ?? undefined,
    message: found?.id
      ? `Integração validada: acesso, gravação e leitura confirmados na pasta "${folder.name ?? "corporativa"}".`
      : "A gravação ocorreu, mas a leitura da pasta não confirmou o arquivo.",
  };
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