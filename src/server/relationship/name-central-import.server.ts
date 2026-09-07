/**
 * CENTRAL DOS NOMES — FILA DE IMPORTAÇÃO (SERVER ONLY).
 *
 * O navegador nunca processa o lote. Ele apenas ENTREGA o conteúdo: o
 * servidor registra um trabalho, quebra o texto em blocos pequenos e
 * responde imediatamente. A digestão acontece depois, bloco a bloco,
 * acionada por um processador em segundo plano — de modo que fechar a
 * aba, dar F5 ou voltar amanhã não interrompe nem exige recolar nada.
 *
 * Retomada: cada bloco carrega a própria marca de conclusão. Uma
 * tentativa interrompida no meio deixa os blocos já concluídos como
 * estão e o trabalho recomeça do primeiro bloco pendente. A unicidade
 * de `normalized_key` no banco garante que repetir um bloco nunca
 * duplica nome.
 */
import { parsePastedNames } from "@/lib/relationship/name-central";

/** Nomes por bloco — pequeno o bastante para caber com folga em uma execução. */
export const CHUNK_SIZE = 1000;
/** Orçamento de tempo por execução do processador. */
const TIME_BUDGET_MS = 20_000;
/** Tempo máximo de uma tentativa antes de o trabalho voltar à fila. */
const LEASE_MINUTES = 5;
const MAX_ATTEMPTS = 20;

export type ImportStatus = "pendente" | "processando" | "concluido" | "erro";

export type ImportJob = {
  id: string;
  source: string;
  filename: string | null;
  status: ImportStatus;
  total: number;
  processed: number;
  added: number;
  existing: number;
  invalid: number;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
};

type Row = Record<string, unknown>;

const SELECT_COLS =
  "id,source,filename,status,total_names,processed_names,added_names,existing_names,invalid_names,attempts,lease_expires_at,last_error,created_at,finished_at";

function toJob(row: Row): ImportJob {
  return {
    id: String(row["id"]),
    source: String(row["source"] ?? "colagem"),
    filename: (row["filename"] as string) ?? null,
    status: String(row["status"] ?? "pendente") as ImportStatus,
    total: Number(row["total_names"] ?? 0),
    processed: Number(row["processed_names"] ?? 0),
    added: Number(row["added_names"] ?? 0),
    existing: Number(row["existing_names"] ?? 0),
    invalid: Number(row["invalid_names"] ?? 0),
    lastError: (row["last_error"] as string) ?? null,
    createdAt: String(row["created_at"] ?? ""),
    finishedAt: (row["finished_at"] as string) ?? null,
  };
}

/** Liga o processamento automático — só enquanto existe trabalho. */
async function wakeProcessor(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("name_central_import_wake" as never);
  if (error) console.error("[central-nomes] não foi possível ligar o processador:", error.message);
}

/** Desliga o processamento automático quando não há mais trabalho. */
async function sleepProcessor(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("name_central_import_sleep" as never);
  if (error) console.error("[central-nomes] não foi possível desligar o processador:", error.message);
}

/**
 * Registra um trabalho a partir do texto entregue. Operação rápida:
 * apenas separa o texto em blocos e grava. Nenhum nome é gravado aqui.
 */
export async function enqueueNameImport(input: {
  text: string;
  source: "colagem" | "word";
  filename?: string | null;
  actor: string;
}): Promise<{ jobId: string; total: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Quebra bruta: cada candidato vira uma linha do bloco. A validação
  // fina (primeiro nome, acento, ruído) acontece na digestão.
  const candidates = String(input.text ?? "")
    .split(/[\r\n;,\t]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (candidates.length === 0) throw new Error("Nenhum nome foi encontrado no conteúdo enviado.");

  const { data: created, error } = await supabaseAdmin
    .from("name_central_imports")
    .insert({
      source: input.source,
      filename: input.filename ?? null,
      status: "pendente",
      total_names: candidates.length,
      chunk_size: CHUNK_SIZE,
      created_by: input.actor,
    } as never)
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Falha ao registrar a importação.");

  const jobId = String((created as Row)["id"]);

  const chunks: Array<{ import_id: string; seq: number; payload: string; item_count: number }> = [];
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const slice = candidates.slice(i, i + CHUNK_SIZE);
    chunks.push({
      import_id: jobId,
      seq: chunks.length,
      payload: slice.join("\n"),
      item_count: slice.length,
    });
  }

  for (let i = 0; i < chunks.length; i += 50) {
    const { error: chunkError } = await supabaseAdmin
      .from("name_central_import_chunks")
      .insert(chunks.slice(i, i + 50) as never);
    if (chunkError) throw new Error(chunkError.message);
  }

  await wakeProcessor();
  return { jobId, total: candidates.length };
}

/** Trabalho mais recente ainda em andamento, se houver. */
export async function getActiveImport(): Promise<ImportJob | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("name_central_imports")
    .select(SELECT_COLS)
    .in("status", ["pendente", "processando"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? toJob(data as Row) : null;
}

/** Último trabalho registrado — em andamento, concluído ou com erro. */
export async function getLatestImport(): Promise<ImportJob | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("name_central_imports")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toJob(data as Row) : null;
}

/** Toma o trabalho executável mais antigo com um lease exclusivo. */
async function claimNextJob(owner: string): Promise<ImportJob | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();

  const { data: candidates } = await supabaseAdmin
    .from("name_central_imports")
    .select(SELECT_COLS)
    .in("status", ["pendente", "processando"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(5);

  for (const row of (candidates ?? []) as Row[]) {
    const attempts = Number(row["attempts"] ?? 0);
    const lease = row["lease_expires_at"] as string | null;
    if (lease && Date.parse(lease) > now) continue; // outra execução cuida

    const { data: claimed } = await supabaseAdmin
      .from("name_central_imports")
      .update({
        status: "processando",
        attempts: attempts + 1,
        lease_owner: owner,
        lease_expires_at: new Date(now + LEASE_MINUTES * 60_000).toISOString(),
        started_at: (row["started_at"] as string) ?? new Date().toISOString(),
      } as never)
      .eq("id", String(row["id"]))
      .eq("attempts", attempts)
      .select(SELECT_COLS)
      .maybeSingle();
    if (claimed) return toJob(claimed as Row);
  }
  return null;
}

/** Grava um bloco. Repetir o mesmo bloco nunca duplica: o índice único decide. */
async function digestChunk(payload: string): Promise<{
  
  invalid: number;
  added: number;
  existing: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const lines = payload.split("\n");
  const parsed = parsePastedNames(payload);

  const byKey = new Map<string, string>();
  for (const item of parsed) if (!byKey.has(item.key)) byKey.set(item.key, item.display);

  const rows = [...byKey.entries()].map(([key, name]) => ({
    name,
    normalized_key: key,
    created_by: "importacao",
  }));

  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await supabaseAdmin
      .from("name_central")
      .upsert(rows.slice(i, i + 500) as never, {
        onConflict: "normalized_key",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(error.message);
    added += (data ?? []).length;
  }

  return {
    // Linhas que não sobreviveram à normalização (ruído, números, vazio).
    invalid: Math.max(0, lines.length - parsed.length),
    added,
    // Já existia na Central, ou repetiu dentro do próprio bloco.
    existing: Math.max(0, parsed.length - added),
  };
}


export type ProcessResult =
  | { processed: false; reason: "vazio" }
  | { processed: true; jobId: string; chunks: number; done: boolean };

/**
 * Executa parte de UM trabalho por chamada, dentro de um orçamento de
 * tempo. O que não couber fica para o ciclo seguinte.
 */
export async function processNextNameImport(): Promise<ProcessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const owner = `worker-${Math.random().toString(36).slice(2, 10)}`;
  const job = await claimNextJob(owner);
  if (!job) {
    await sleepProcessor();
    return { processed: false, reason: "vazio" };
  }

  const started = Date.now();
  let processed = job.processed;
  let added = job.added;
  let existing = job.existing;
  let invalid = job.invalid;
  let chunksDone = 0;
  let pendingLeft = true;

  try {
    while (Date.now() - started < TIME_BUDGET_MS) {
      const { data: chunks } = await supabaseAdmin
        .from("name_central_import_chunks")
        .select("id,payload,item_count")
        .eq("import_id", job.id)
        .is("processed_at", null)
        .order("seq", { ascending: true })
        .limit(3);

      const list = (chunks ?? []) as Row[];
      if (list.length === 0) {
        pendingLeft = false;
        break;
      }

      for (const chunk of list) {
        const result = await digestChunk(String(chunk["payload"] ?? ""));
        const items = Number(chunk["item_count"] ?? 0);
        processed += items;
        added += result.added;
        existing += result.existing;
        invalid += result.invalid;
        chunksDone += 1;

        await supabaseAdmin
          .from("name_central_import_chunks")
          .update({ processed_at: new Date().toISOString() } as never)
          .eq("id", String(chunk["id"]));

        await supabaseAdmin
          .from("name_central_imports")
          .update({
            processed_names: processed,
            added_names: added,
            existing_names: existing,
            invalid_names: invalid,
          } as never)
          .eq("id", job.id);
      }
    }

    await supabaseAdmin
      .from("name_central_imports")
      .update({
        status: pendingLeft ? "pendente" : "concluido",
        processed_names: processed,
        added_names: added,
        existing_names: existing,
        invalid_names: invalid,
        attempts: 0,
        lease_owner: null,
        lease_expires_at: null,
        last_error: null,
        finished_at: pendingLeft ? null : new Date().toISOString(),
      } as never)
      .eq("id", job.id);

    if (!pendingLeft && !(await getActiveImport())) await sleepProcessor();
    return { processed: true, jobId: job.id, chunks: chunksDone, done: !pendingLeft };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    // Nada do que já foi gravado é desfeito: o trabalho volta à fila.
    await supabaseAdmin
      .from("name_central_imports")
      .update({
        status: "pendente",
        processed_names: processed,
        added_names: added,
        existing_names: existing,
        invalid_names: invalid,
        lease_owner: null,
        lease_expires_at: null,
        last_error: message,
      } as never)
      .eq("id", job.id);
    console.error("[central-nomes] falha ao digerir bloco:", message);
    return { processed: true, jobId: job.id, chunks: chunksDone, done: false };
  }
}

/**
 * Extrai o texto de um `.docx`. O arquivo é lido em memória, o texto é
 * aproveitado e o conteúdo binário é descartado em seguida.
 */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("O arquivo enviado não parece ser um documento Word válido.");
  const xml = strFromU8(doc);
  return xml
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\b[^>]*\/>/g, "\n")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
