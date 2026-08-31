/**
 * AUTORIZAÇÃO DAS ROTINAS AUTOMÁTICAS (CAMINHO A).
 *
 * As rotas `/api/public/*` de sincronização, backup e remarketing são
 * públicas por necessidade do agendador do banco. A autoridade delas é um
 * SEGREDO CUSTODIADO NO BANCO (`public.automation_credentials`), acessível
 * apenas ao service_role do servidor e ao próprio agendador. O valor nunca
 * existe no código, no cliente, no chat nem no texto do agendador.
 *
 *   cabeçalho `x-portal-automation: <segredo custodiado>`
 *
 * `LEGACY_KEY_ACCEPTED` controla a transição: enquanto verdadeiro, a chave
 * publicável antiga continua valendo para que nenhuma rotina caia durante a
 * publicação. Assim que os agendadores estiverem validados com o novo
 * mecanismo, ela passa a falso e a chave antiga deixa de ser aceita.
 */

/** Aceite temporário da chave antiga durante a virada (ETAPA 1 → ETAPA 4). */
const LEGACY_KEY_ACCEPTED = false;

/** Comparação de tempo constante — evita descoberta por medição. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

let cached: { value: string; at: number } | null = null;
const CACHE_MS = 60_000;

async function loadCustodiedSecret(): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("automation_credentials")
    .select("secret")
    .eq("name", "PORTAL_AUTOMATION_SECRET")
    .maybeSingle();

  if (error) {
    console.error("[automacao] falha ao ler a credencial custodiada:", error.message);
    return cached?.value ?? "";
  }

  const value = ((data as { secret?: string } | null)?.secret ?? "").trim();
  if (value.length > 0) cached = { value, at: now };
  return value;
}

export async function isAutomationRequestAuthorized(
  request: Request,
  routeName: string,
): Promise<boolean> {
  const presented = (
    request.headers.get("x-portal-automation") ??
    request.headers.get("x-automation-secret") ??
    ""
  ).trim();

  const secret = await loadCustodiedSecret();
  if (secret.length > 0 && presented.length > 0 && safeEqual(presented, secret)) {
    return true;
  }

  if (!LEGACY_KEY_ACCEPTED) return false;

  // Transição: chave publicável antiga ainda aceita até a virada dos jobs.
  const legacy = [process.env["SUPABASE_ANON_KEY"], process.env["SUPABASE_PUBLISHABLE_KEY"]]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length > 0);
  const key = (request.headers.get("apikey") ?? "").trim();
  const accepted = legacy.some((value) => safeEqual(key, value));
  if (accepted) {
    console.warn(
      `[automacao] ${routeName} autorizada pela chave legada durante a transição.`,
    );
  }
  return accepted;
}

export function automationUnauthorizedResponse(): Response {
  return new Response("Não autorizado", { status: 401 });
}
