/**
 * DEF 3.0.1 §2 — Meu Perfil › Personalização do CRM.
 *
 * Miniaturas reais dos cinco temas oficiais. Um clique troca o tema
 * imediatamente e salva automaticamente no perfil — sem modal, sem tela
 * nova, sem assistente e sem recarregar a página.
 */
import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import {
  CRM_THEMES,
  getUserCrmTheme,
  setUserCrmTheme,
  type CrmThemeId,
} from "@/lib/crm/themes";

export function CrmThemePicker({ userId }: { userId: string }) {
  const [active, setActive] = useState<CrmThemeId>("atlas_classico");

  useEffect(() => {
    setActive(getUserCrmTheme(userId));
  }, [userId]);

  function choose(id: CrmThemeId) {
    setActive(id);
    setUserCrmTheme(userId, id);
  }

  return (
    <section className="mt-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/30 p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
          <Palette className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg">Personalização do CRM</h2>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
            Escolha o tema do seu CRM. A alteração é aplicada
            instantaneamente e salva automaticamente no seu perfil.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CRM_THEMES.map((theme) => {
          const selected = theme.id === active;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => choose(theme.id)}
              aria-pressed={selected}
              className={[
                "group cursor-pointer overflow-hidden rounded-xl border text-left transition",
                selected
                  ? "border-[color:var(--gold)] shadow-[0_0_0_1px_var(--gold)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--gold)]/50",
              ].join(" ")}
            >
              <span className="relative block">
                <img
                  src={theme.thumbnail}
                  alt={`Miniatura do tema ${theme.label}`}
                  loading="lazy"
                  className="block aspect-[16/10] w-full object-cover"
                />
                {selected ? (
                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--gold)] text-[color:var(--navy)]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </span>
              <span className="block px-3 py-2.5">
                <span className="block text-sm">{theme.label}</span>
                <span className="mt-0.5 block text-[11px] text-[color:var(--muted-foreground)]">
                  {theme.id === "atlas_classico"
                    ? `${theme.description} Tema padrão.`
                    : theme.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}