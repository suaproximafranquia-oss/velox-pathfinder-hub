/**
 * Histórico de Simulações do Investidor.
 *
 * Armazena localmente todas as simulações realizadas pelo Portal Velox,
 * mantendo o PDF institucional (data URI) vinculado ao Lead. Os
 * relatórios são acessíveis apenas pelo Executivo através do Perfil
 * Inteligente — o investidor nunca recebe download automático.
 */

const STORAGE_KEY = "velox:simulations:v1";

export type SimulationProductRow = {
  id: string;
  name: string;
  category: string;
  volume: number;
  revenue: number;
};

export type SimulationRecord = {
  id: string;
  investorId: string;
  createdAt: string;
  filename: string;
  pdfDataUri: string;
  total: number;
  annual: number;
  products: SimulationProductRow[];
  executiveName: string | null;
  audienceLabel: string | null;
  interests: string[];
};

function safeRead(): SimulationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SimulationRecord[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: SimulationRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function addSimulation(record: Omit<SimulationRecord, "id" | "createdAt"> & { createdAt?: string }): SimulationRecord {
  const full: SimulationRecord = {
    id: `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: record.createdAt ?? new Date().toISOString(),
    ...record,
  };
  const all = safeRead();
  all.push(full);
  safeWrite(all);
  return full;
}

export function listSimulations(investorId: string | null | undefined): SimulationRecord[] {
  if (!investorId) return [];
  return safeRead()
    .filter((s) => s.investorId === investorId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getLastSimulation(investorId: string | null | undefined): SimulationRecord | null {
  return listSimulations(investorId)[0] ?? null;
}

export function openSimulationPdf(record: SimulationRecord): void {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<html><head><title>${record.filename}</title></head><body style="margin:0"><iframe src="${record.pdfDataUri}" style="border:0;width:100vw;height:100vh"></iframe></body></html>`,
  );
  win.document.close();
}

export function formatSimulationDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}