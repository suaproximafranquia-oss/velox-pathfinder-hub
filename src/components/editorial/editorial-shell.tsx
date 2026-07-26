import { useEffect, type ReactNode } from "react";

/**
 * Editorial Design System — Shell reutilizável.
 *
 * Componente único que ativa o tema editorial oficial do ecossistema
 * Velox (fundo institucional, degradês, padrão pontilhado, tipografia
 * serif, tokens de paleta). O tema é definido uma única vez em
 * `src/styles.css` sob o seletor `body[data-shell="…"]` e aplicado
 * automaticamente a qualquer módulo que renderize este componente.
 *
 * Uso em novos módulos editoriais (Sede, Revista, Experiências,
 * Biblioteca, FAQ, etc.):
 *
 *   <EditorialShell variant="portal">…</EditorialShell>
 *
 * Qualquer refinamento futuro no tema deve ser feito apenas em
 * `src/styles.css` — todos os módulos herdam automaticamente.
 */
export type EditorialVariant = "portal" | "manual" | "universo";

export function EditorialShell({
  variant,
  children,
}: {
  variant: EditorialVariant;
  children: ReactNode;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.setAttribute("data-shell", variant);
  }, [variant]);

  return <>{children}</>;
}

/**
 * Marcador para a Área Executiva (fora do sistema editorial).
 * Mantido isolado — não herda o tema editorial.
 */
export function ExecutiveShellMarker({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.setAttribute("data-shell", "executive");
  }, []);
  return <>{children}</>;
}