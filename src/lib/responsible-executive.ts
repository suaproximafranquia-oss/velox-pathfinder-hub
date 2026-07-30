/**
 * Executivo Responsável pelo visitante do Manual.
 *
 * Regras:
 * - Se o visitante entrou por um link personalizado (`/e/$slug`), o slug
 *   fica persistido em localStorage e é imutável pelo restante da jornada.
 * - Caso contrário, usamos o Executivo Padrão do workspace ativo
 *   (parâmetro configurável — ver `getDefaultExecutive`).
 *
 * Nenhum número/nome é fixado em código: tudo vem do cadastro do usuário.
 */
import {
  getDefaultExecutive,
  getExecutiveBySlug,
  type ExecutiveUser,
} from "@/lib/executive-auth";

const KEY = "atlas:manual:responsibleExecutiveSlug";

export function setResponsibleExecutiveSlug(slug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, slug);
}

export function clearResponsibleExecutive() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * Título comercial exibido ao investidor — nunca o cargo interno.
 * Mapeia por papel (role) para uma denominação voltada à expansão
 * comercial, independentemente do título administrativo cadastrado.
 */
export function getCommercialTitle(executive: ExecutiveUser): string {
  switch (executive.role) {
    case "super_admin":
      return "Gerente de Expansão";
    case "diretora":
      return "Diretora de Expansão";
    case "executivo":
    default:
      return "Consultor de Expansão";
  }
}

export function getResponsibleExecutive(): {
  executive: ExecutiveUser | null;
  personalized: boolean;
} {
  if (typeof window === "undefined") {
    return { executive: getDefaultExecutive(), personalized: false };
  }
  const slug = window.localStorage.getItem(KEY);
  if (slug) {
    const exec = getExecutiveBySlug(slug);
    if (exec) return { executive: exec, personalized: true };
  }
  return { executive: getDefaultExecutive(), personalized: false };
}