/** Envio de e-mails pela conta Google do executivo — SERVER ONLY. */
import { googleFetch } from "@/server/google.server";

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendMail(
  userId: string,
  params: { to: string[]; subject: string; html: string },
): Promise<{ id: string }> {
  const raw = [
    `To: ${params.to.join(", ")}`,
    `Subject: ${encodeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    params.html,
  ].join("\r\n");
  const res = (await googleFetch(userId, "google_mail", "/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: toBase64Url(raw) }),
  })) as { id?: string } | null;
  return { id: res?.id ?? "" };
}