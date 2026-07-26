import { createFileRoute } from "@tanstack/react-router";
import { ChapterView } from "@/components/journey/chapter-view";
import { getChapter } from "@/lib/journey-data";

const chapter = getChapter("recepcao")!;

/**
 * Manual do Investidor — Recepção (Capítulo 1).
 * Antes servido em `/`, agora vive em `/manual` para dar espaço ao
 * Portal Velox como nova porta de entrada. Toda a jornada de capítulos
 * subsequentes permanece em `/manual/$chapter`.
 */
export const Route = createFileRoute("/manual/")({
  head: () => ({
    meta: [
      { title: chapter.seoTitle },
      { name: "description", content: chapter.seoDescription },
      { property: "og:title", content: chapter.seoTitle },
      { property: "og:description", content: chapter.seoDescription },
    ],
  }),
  component: Recepcao,
});

function Recepcao() {
  return (
    <ChapterView chapter={chapter}>
      <div className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--gold)]/5 px-6 py-5">
        <p className="text-sm leading-relaxed">
          Você vai conhecer a Velox, entender o modelo, ver os valores
          oficiais e refletir sobre o seu momento.{" "}
          <span className="text-[color:var(--gold)]">Nada aqui pressiona uma decisão.</span>
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3 text-sm">
        <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
          <span className="text-[color:var(--gold)] font-display text-lg">13</span>
          <span className="block text-[color:var(--muted-foreground)] mt-1">capítulos curtos</span>
        </li>
        <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
          <span className="text-[color:var(--gold)] font-display text-lg">~10</span>
          <span className="block text-[color:var(--muted-foreground)] mt-1">minutos de leitura</span>
        </li>
        <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
          <span className="text-[color:var(--gold)] font-display text-lg">0</span>
          <span className="block text-[color:var(--muted-foreground)] mt-1">pressão comercial</span>
        </li>
      </ul>
    </ChapterView>
  );
}