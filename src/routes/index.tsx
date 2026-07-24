import { createFileRoute } from "@tanstack/react-router";
import { ChapterView } from "@/components/journey/chapter-view";
import { getChapter } from "@/lib/journey-data";

const chapter = getChapter("recepcao")!;

export const Route = createFileRoute("/")({
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
          Você vai conhecer a Velox, entender como o modelo funciona, ver o
          investimento envolvido e refletir se este é o seu momento.{" "}
          <span className="text-[color:var(--gold)]">Nenhuma etapa pressiona você para uma decisão.</span>
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3 text-sm">
        <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
          <span className="text-[color:var(--gold)] font-display text-lg">11</span>
          <span className="block text-[color:var(--muted-foreground)] mt-1">capítulos curtos</span>
        </li>
        <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
          <span className="text-[color:var(--gold)] font-display text-lg">~8</span>
          <span className="block text-[color:var(--muted-foreground)] mt-1">minutos no total</span>
        </li>
        <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3">
          <span className="text-[color:var(--gold)] font-display text-lg">0</span>
          <span className="block text-[color:var(--muted-foreground)] mt-1">pressão comercial</span>
        </li>
      </ul>
    </ChapterView>
  );
}
