/**
 * AUTORIZAÇÃO DAS ROTINAS AUTOMÁTICAS (COMANDO FINAL 1 §9).
 *
 * As rotas `/api/public/*` de sincronização, backup e remarketing são
 * públicas por necessidade do agendador do banco. Até aqui elas eram
 * autorizadas pela chave publicável do projeto — a mesma que existe no
 * pacote do navegador, ou seja, qualquer visitante poderia dispará-las.
 *
 * Agora a autoridade é um SEGREDO DEDICADO, exclusivo do servidor:
 *
 *   cabeçalho `x-portal-automation: <PORTAL_AUTOMATION_SECRET>`
 *
 * Compatibilidade controlada: enquanto o segredo dedicado não estiver
 * configurado no ambiente, a chave antiga continua sendo aceita para não
 * derrubar as rotinas já agendadas — e cada aceite legado é registrado no
 * log para que a virada seja verificável. Assim que o segredo existir, a
 * chave publicável deixa de valer imediatamente.
 */

/** Comparação de tempo constante — evita descoberta por medição. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAutomationRequestAuthorized(request: Request, routeName: string): boolean {
  const secret = (process.env["PORTAL_AUTOMATION_SECRET"] ?? "").trim();
  const presented = (
    request.headers.get("x-portal-automation") ??
    request.headers.get("x-automation-secret") ??
    ""
  ).trim();

  if (secret.length > 0) {
    return presented.length > 0 && safeEqual(presented, secret);
  }

  // Modo de compatibilidade: segredo ainda não provisionado.
  const legacy = [process.env["SUPABASE_ANON_KEY"], process.env["SUPABASE_PUBLISHABLE_KEY"]]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length > 0);
  const key = (request.headers.get("apikey") ?? "").trim();
  const accepted = legacy.some((value) => safeEqual(key, value));
  if (accepted) {
    console.warn(
      `[automacao] ${routeName} autorizada pela chave legada: configure PORTAL_AUTOMATION_SECRET e atualize o agendador.`,
    );
  }
  return accepted;
}

export function automationUnauthorizedResponse(): Response {
  return new Response("Não autorizado", { status: 401 });
}
