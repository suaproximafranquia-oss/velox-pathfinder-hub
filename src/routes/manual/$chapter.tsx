import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { ChapterView } from "@/components/journey/chapter-view";
import { ChapterBody, hidesContinueFor } from "@/components/journey/chapter-bodies";
import { ContactForm } from "@/components/journey/contact-form";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { getChapter } from "@/lib/journey-data";
import { getExecutiveBySlug, type ExecutiveUser } from "@/lib/executive-auth";
import { setResponsibleExecutiveSlug } from "@/lib/responsible-executive";
import { getResponsibleExecutive } from "@/lib/responsible-executive";
import { useEffect, useState } from "react";
import { WHATSAPP_NUMBER } from "@/lib/journey-data";

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
    if (!c) {
      // Se o segmento não é um capítulo mas corresponde a um executivo
      // ativo, tratamos como link personalizado (`/manual/{executivo}`):
      // persiste o responsável e redireciona para a recepção do Manual.
      const exec = getExecutiveBySlug(params.chapter);
      if (exec) {
        throw redirect({
          to: "/",
          replace: true,
          search: { e: exec.slug, m: "manual", o: "Link personalizado" },
        });
      }
      throw notFound();
    }
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
  const [responsible, setResponsible] = useState<{
    executive: ExecutiveUser | null;
    personalized: boolean;
  }>({ executive: null, personalized: false });
  useEffect(() => {
    setResponsible(getResponsibleExecutive());
  }, []);
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

      {responsible.personalized && responsible.executive ? (
        <PersonalizedCta executive={responsible.executive} />
      ) : (
        <ContactForm />
      )}
    </div>
  );
}

/**
 * CTA único do fluxo personalizado: abre o WhatsApp cadastrado do
 * executivo responsável, sem repetir o formulário de contato. Usa como
 * fonte única os dados atuais do perfil (whatsapp > phone). Se o
 * executivo alterar seus dados em "Meu Perfil", o link personalizado
 * passa a usar automaticamente os novos números — nenhum valor fica
 * fixo em código.
 */
function PersonalizedCta({ executive }: { executive: ExecutiveUser }) {
  const raw = executive.whatsapp || executive.phone || WHATSAPP_NUMBER;
  const number = raw.replace(/\D/g, "");
  const firstName = executive.name.split(" ")[0];
  const url = `https://wa.me/${number}?text=${encodeURIComponent(
    `Olá ${firstName}! Concluí o Manual do Investidor e gostaria de voltar a falar com você.`,
  )}`;
  return (
    <section className="rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--card)]/50 p-6 sm:p-8">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)] mb-2">
        Seu especialista
      </p>
      <h3 className="font-display text-2xl mb-1">{executive.name}</h3>
      {executive.title && (
        <p className="text-sm text-[color:var(--muted-foreground)] mb-5">
          {executive.title}
        </p>
      )}
      <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed mb-6">
        Você já está acompanhado por {firstName}. Ao clicar abaixo, a conversa
        continua diretamente no WhatsApp dele(a).
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center justify-center gap-3 rounded-full bg-[color:var(--gold)] px-8 py-4 text-sm font-medium text-[color:var(--gold-foreground)] hover:shadow-[0_15px_50px_-15px_var(--gold)] transition-all duration-300"
      >
        Voltar a falar com meu especialista
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </a>
    </section>
  );
}
