/**
 * POC GreenSales — acesso SERVER ONLY à API da GDigital.
 *
 * Somente leitura: autenticação (POST /login) e consulta (POST /lead/list).
 * Nenhuma operação de escrita é executada no GreenSales. As credenciais
 * vêm exclusivamente de segredos do servidor e nunca são registradas em
 * log, retornadas à interface ou expostas ao navegador.
 */
const BASE_URL = "https://back.gdigital.com.br/";

const BROWSER_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  // A API rejeita (403) clientes sem identificação de navegador.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Origin: "https://app.gdigital.com.br",
  Referer: "https://app.gdigital.com.br/",
};

export class GreenSalesError extends Error {
  constructor(
    message: string,
    readonly stage: "autenticacao" | "consulta",
    readonly status?: number,
  ) {
    super(message);
  }
}

export type GreenSalesLead = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  origin?: string | null;
  status?: string | null;
  leadscore?: number | null;
  board_id?: number | null;
  pipeline_id?: number | null;
  vendedor_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

/** Autenticação server-side. Devolve apenas o token, jamais logado. */
export async function greenSalesLogin(
  credentials?: { email: string; password: string } | null,
): Promise<string> {
  const email = credentials?.email ?? process.env["GREENSALES_EMAIL"];
  const password = credentials?.password ?? process.env["GREENSALES_PASSWORD"];
  if (!email || !password) {
    throw new GreenSalesError(
      "Nenhuma conta Green Sales conectada para este usuário.",
      "autenticacao",
    );
  }
  const res = await fetch(`${BASE_URL}login`, {
    method: "POST",
    headers: BROWSER_HEADERS,
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new GreenSalesError(
      `Falha na autenticação (HTTP ${res.status}).`,
      "autenticacao",
      res.status,
    );
  }
  const json = (await res.json()) as { token?: string; access_token?: string };
  const token = json.token ?? json.access_token;
  if (!token) throw new GreenSalesError("Resposta de login sem token.", "autenticacao");
  return token;
}

type ListPage = {
  data?: GreenSalesLead[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
};

async function fetchPage(token: string, page: number): Promise<ListPage> {
  const res = await fetch(`${BASE_URL}lead/list`, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ page, pagina: 50, per_page: 50, filters: {} }),
  });
  if (!res.ok) {
    throw new GreenSalesError(
      `POST ${BASE_URL}lead/list respondeu HTTP ${res.status}.`,
      "consulta",
      res.status,
    );
  }
  return (await res.json()) as ListPage;
}

/** Início e fim do dia atual no fuso da operação (America/Sao_Paulo). */
export async function fetchLeadDetail(token: string, id: number | string): Promise<GreenSalesLead | null> {
  // A listagem devolve `metas: []`; os campos adicionais (onde vive o
  // "celular_(whatsapp)") só chegam no detalhe do lead.
  const res = await fetch(`${BASE_URL}lead/${id}`, {
    method: "GET",
    headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as GreenSalesLead;
}

export function operationDayWindow(now = new Date()): { startUtc: Date; endUtc: Date; day: string } {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  // São Paulo é UTC-3 o ano inteiro desde 2019 (sem horário de verão).
  const startUtc = new Date(`${day}T00:00:00.000-03:00`);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc, day };
}

/**
 * Percorre a paginação até cobrir todos os leads criados hoje.
 * A listagem vem ordenada do mais recente para o mais antigo, então a
 * varredura encerra ao alcançar registros anteriores ao início do dia.
 */
export async function fetchTodayLeads(token: string): Promise<{
  leads: GreenSalesLead[];
  pagesScanned: number;
  window: { startUtc: Date; endUtc: Date; day: string };
}> {
  const win = operationDayWindow();
  const leads: GreenSalesLead[] = [];
  let page = 1;
  let lastPage = 1;
  let olderReached = false;
  while (page <= lastPage && page <= 40 && !olderReached) {
    const body = await fetchPage(token, page);
    lastPage = body.last_page ?? 1;
    for (const lead of body.data ?? []) {
      const created = lead.created_at ? new Date(lead.created_at) : null;
      if (!created || Number.isNaN(created.getTime())) continue;
      if (created >= win.endUtc) continue;
      if (created < win.startUtc) {
        olderReached = true;
        continue;
      }
      leads.push(lead);
    }
    page += 1;
  }
  return { leads, pagesScanned: page - 1, window: win };
}

/**
 * Sincronização contínua — leads criados/atualizados a partir de `since`.
 *
 * A listagem vem do mais recente para o mais antigo, então a varredura
 * encerra assim que alcança registros anteriores à janela pedida.
 */
export async function fetchLeadsSince(
  token: string,
  since: Date,
  maxPages = 20,
): Promise<{ leads: GreenSalesLead[]; pagesScanned: number }> {
  const leads: GreenSalesLead[] = [];
  let page = 1;
  let lastPage = 1;
  let olderReached = false;
  while (page <= lastPage && page <= maxPages && !olderReached) {
    const body = await fetchPage(token, page);
    lastPage = body.last_page ?? 1;
    for (const lead of body.data ?? []) {
      const stamp = lead.updated_at ?? lead.created_at;
      const at = stamp ? new Date(stamp) : null;
      if (!at || Number.isNaN(at.getTime())) continue;
      if (at < since) {
        olderReached = true;
        continue;
      }
      leads.push(lead);
    }
    page += 1;
  }
  return { leads, pagesScanned: page - 1 };
}

/**
 * Carga histórica — percorre TODA a paginação disponível na conta.
 *
 * Diferente de `fetchLeadsSince`, não existe janela temporal: a varredura
 * só encerra quando a origem informa que não há mais páginas. O limite
 * `maxPages` é apenas uma trava de segurança contra paginação infinita.
 */
export async function fetchAllLeads(
  token: string,
  maxPages = 500,
): Promise<{ leads: GreenSalesLead[]; pagesScanned: number; totalReported: number | null }> {
  const leads: GreenSalesLead[] = [];
  const seen = new Set<string>();
  let page = 1;
  let lastPage = 1;
  let totalReported: number | null = null;
  while (page <= lastPage && page <= maxPages) {
    const body = await fetchPage(token, page);
    lastPage = body.last_page ?? 1;
    totalReported = body.total ?? totalReported;
    const rows = body.data ?? [];
    if (rows.length === 0) break;
    for (const lead of rows) {
      const key = String(lead.id);
      if (seen.has(key)) continue;
      seen.add(key);
      leads.push(lead);
    }
    page += 1;
  }
  return { leads, pagesScanned: page - 1, totalReported };
}
