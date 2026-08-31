/**
 * CACHE DE EXIBIÇÃO DO DIRETÓRIO OFICIAL (COMANDO FINAL 1).
 *
 * O servidor é a verdade. Este módulo mantém no navegador apenas uma
 * cópia para o primeiro render e para telas síncronas já existentes —
 * ela nunca decide nada:
 *
 *   • carga inicial e verificação periódica;
 *   • gravação feita pelo Administrador;
 *   • conflito → SERVIDOR VENCE, sempre.
 *
 * Quando o servidor ainda não respondeu, o valor exibido é o último
 * conhecido; nenhuma decisão de acesso é tomada com base nele (isso é
 * responsabilidade do guard operacional, que consulta o servidor).
 */
import type { ExecutiveDirectoryEntry } from "@/lib/executive-directory.functions";

const MIRROR_KEY = "atlas:executive-directory:v1";
const POLL_MS = 30_000;

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: ExecutiveDirectoryEntry[] = readMirror();
let authoritative = false;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

function readMirror(): ExecutiveDirectoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ExecutiveDirectoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeMirror(entries: ExecutiveDirectoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(entries));
  } catch {
    /* armazenamento indisponível — o servidor continua sendo a verdade */
  }
}

function commit(next: ExecutiveDirectoryEntry[]): void {
  if (JSON.stringify(cache) === JSON.stringify(next)) return;
  cache = next;
  writeMirror(next);
  for (const listener of listeners) listener();
}

export function getExecutiveDirectoryCache(): ExecutiveDirectoryEntry[] {
  return cache;
}

export function isExecutiveDirectoryAuthoritative(): boolean {
  return authoritative;
}

export function subscribeExecutiveDirectory(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Busca o diretório oficial. Falha mantém o último estado conhecido. */
export function refreshExecutiveDirectory(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { listarDiretorioExecutivos } = await import("@/lib/executive-directory.functions");
      const entries = await listarDiretorioExecutivos();
      authoritative = true;
      commit(entries);
    } catch {
      /* sem sessão ou rede indisponível — nada é liberado por falha */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Sincronização contínua. Idempotente. */
export function startExecutiveDirectorySync(): void {
  if (typeof window === "undefined" || timer) return;
  void refreshExecutiveDirectory();
  timer = setInterval(() => void refreshExecutiveDirectory(), POLL_MS);
  window.addEventListener("focus", () => void refreshExecutiveDirectory());
}

/**
 * Grava a ficha no servidor e reflete o retorno no cache. Nenhuma tela
 * deve escrever direto no navegador: a ordem é sempre servidor primeiro.
 */
export async function persistExecutiveProfile(patch: {
  executiveId: string;
  name?: string;
  email?: string;
  slug?: string;
  whatsapp?: string;
  title?: string;
  phone?: string;
  admissionDate?: string;
  birthDate?: string;
  photoUrl?: string;
  postPresentationVideoUrl?: string;
  gestorId?: string;
}): Promise<void> {
  const { salvarPerfilExecutivo } = await import("@/lib/executive-directory.functions");
  await salvarPerfilExecutivo({ data: patch });
  await refreshExecutiveDirectory();
}
