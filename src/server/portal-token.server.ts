/**
 * Autorização do visitante do Portal.
 *
 * Os endpoints do Portal (progresso da jornada e confirmação de
 * WhatsApp) são chamados por um visitante sem sessão autenticada. Antes
 * bastava conhecer um `investorId` para gravar dados de terceiros. Agora
 * o servidor emite um token assinado (HMAC) vinculado ao investidor,
 * entregue apenas a quem comprova conhecer e-mail e telefone do próprio
 * cadastro. O token nunca contém dados pessoais e não substitui a
 * autenticação do Workspace.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const value =
    process.env["PORTAL_TOKEN_SECRET"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_URL"];
  if (!value) throw new Error("Segredo de assinatura indisponível no servidor.");
  return value;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(mac));
}

export async function issueToken(investorId: string): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const payload = `${investorId}.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

/** Verificação em tempo constante do vínculo token ↔ investidor. */
export async function verifyToken(
  token: string | undefined | null,
  investorId: string,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, exp, mac] = parts as [string, string, string];
  if (id !== investorId) return false;
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = await sign(`${id}.${exp}`);
  if (expected.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0;
}

/** Compara telefones ignorando máscara, DDI e zeros à esquerda. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => (v ?? "").replace(/\D+/g, "").slice(-8);
  const left = norm(a);
  return left.length >= 8 && left === norm(b);
}
