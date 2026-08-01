/**
 * Cópia para a área de transferência com alternativa para contextos
 * onde a Clipboard API não está disponível (iframe, http, permissão negada).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const value = (text ?? "").trim();
  if (!value || typeof window === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* segue para a alternativa */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
