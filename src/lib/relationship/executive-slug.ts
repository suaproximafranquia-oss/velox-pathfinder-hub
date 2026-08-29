/**
 * SLUG DO EXECUTIVO — FONTE DE VERDADE ÚNICA.
 *
 * O link personalizado do Portal pertence ao EXECUTIVO, não ao lead. O
 * cadastro oficial (Gestão de Usuários) é quem responde qual é o slug;
 * `portal_leads.responsible_executive_slug` é apenas um registro de
 * conveniência, frequentemente ausente nos leads vindos do GreenSales.
 *
 * Nada é inventado: executivo desconhecido devolve `null` e o chamador
 * decide o que fazer.
 */
import { loadUsers } from "@/lib/executive-auth";

export function executiveSlugById(executiveId: string | null | undefined): string | null {
  const id = (executiveId ?? "").trim();
  if (!id) return null;
  const user = loadUsers().find((u) => u.id === id);
  const slug = (user?.slug ?? "").trim();
  return slug.length > 0 ? slug : null;
}
