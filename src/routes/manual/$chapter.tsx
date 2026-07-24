import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChapterView } from "@/components/journey/chapter-view";
import { ChapterBody } from "@/components/journey/chapter-bodies";
import { ContactForm } from "@/components/journey/contact-form";
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
        completionOverride={<ContactFormBlock />}
      />
    );
  }

  return (
    <ChapterView chapter={chapter}>
      <ChapterBody slug={slug} />
    </ChapterView>
  );
}

function ContactFormBlock() {
  return (
    <div className="mt-10">
      <ContactForm />
    </div>
  );
}
