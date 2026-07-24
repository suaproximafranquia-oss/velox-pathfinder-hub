import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChapterView } from "@/components/journey/chapter-view";
import { ChapterBody, hidesContinueFor } from "@/components/journey/chapter-bodies";
import { ContactForm } from "@/components/journey/contact-form";
import { CheckCircle2 } from "lucide-react";
import { getChapter } from "@/lib/journey-data";

export const Route = createFileRoute("/manual/$chapter")({
  head: ({ params }) => {
    const c = getChapter(params.chapter);
    if (!c) {
      return {
        meta: [
          { title: "Capítulo não encontrado — Manual do Investidor Velox" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return {
      meta: [
        { title: c.seoTitle },
        { name: "description", content: c.seoDescription },
        { property: "og:title", content: c.seoTitle },
        { property: "og:description", content: c.seoDescription },
      ],
    };
  },
  loader: ({ params }) => {
    const c = getChapter(params.chapter);
    if (!c) throw notFound();
    return { slug: params.chapter };
  },
  component: ChapterRoute,
});

function ChapterRoute() {
  const { chapter: slug } = Route.useParams();
  const chapter = getChapter(slug);
  if (!chapter) return null;

  if (chapter.isFinal) {
    return (
      <ChapterView
        chapter={chapter}
        hideContinue
        completionOverride={<FinalClosing />}
      />
    );
  }

  return (
    <ChapterView chapter={chapter} hideContinue={hidesContinueFor(slug)}>
      <ChapterBody slug={slug} />
    </ChapterView>
  );
}

function FinalClosing() {
  const learned = [
    { t: "O modelo de negócio", d: "Uma franquia de serviço, sem estoque, com portfólio homologado e receita vinculada às operações concretizadas." },
    { t: "Os produtos", d: "Crédito, seguros, consórcios e soluções de investimento e planejamento — sempre por meio de parceiros homologados." },
    { t: "O investimento", d: "Os valores oficiais de franquia, implantação e royalties, apresentados por escrito antes de qualquer conversa." },
    { t: "O treinamento", d: "A sequência entre assinatura, implantação e as duas semanas obrigatórias de formação, antes do início da operação." },
    { t: "O suporte", d: "O acompanhamento contínuo por consultor de negócios, Universidade Corporativa, plataforma tecnológica e estrutura da rede." },
    { t: "O perfil esperado", d: "As características que costumam favorecer a jornada de um franqueado — e os pontos que merecem uma reflexão honesta." },
  ];
  return (
    <div className="mt-10 space-y-10">
      <section className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--card)]/50 p-6 sm:p-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--gold)] mb-4">
          O que você concluiu
        </p>
        <h2 className="font-display text-2xl sm:text-3xl leading-tight mb-3 text-balance">
          Uma leitura completa sobre como funciona uma franquia Velox.
        </h2>
        <p className="text-base leading-relaxed text-[color:var(--muted-foreground)] mb-6">
          Ao longo dos capítulos anteriores, você conheceu com profundidade
          suficiente cada dimensão da operação. Este é um bom momento para
          revisitar mentalmente o que ficou:
        </p>
        <ul className="space-y-3">
          {learned.map((l) => (
            <li key={l.t} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[color:var(--gold)] shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <p className="font-medium">{l.t}</p>
                <p className="text-[color:var(--muted-foreground)]">{l.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
          Se, depois de tudo isso, você sentir que faz sentido dar o
          próximo passo, o convite abaixo é a continuação natural desta
          jornada. Não é um formulário de captação. É uma forma discreta
          de dizer: "quero conversar com alguém que já viveu esse modelo
          de perto, para tirar minhas últimas dúvidas".
        </p>
        <p className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
          O especialista Velox entra em contato no seu tempo. Sem
          insistência. Sem cronogramas forçados. Apenas uma conversa
          honesta para você decidir, com fatos, se este é o seu momento.
        </p>
      </section>

      <ContactForm />
    </div>
  );
}
