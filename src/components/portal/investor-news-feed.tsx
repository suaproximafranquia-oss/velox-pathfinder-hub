/**
 * Feed público de notícias do Portal do Investidor.
 *
 * Mostra apenas o que a diretoria publicou para o público investidor.
 * Se não houver nada publicado, a seção simplesmente não aparece —
 * evitando espaços vazios na home.
 */
import { useEffect, useState } from "react";
import { listInvestorNews, type NewsPost } from "@/lib/comms.functions";

export function InvestorNewsFeed() {
  const [posts, setPosts] = useState<NewsPost[]>([]);

  useEffect(() => {
    let alive = true;
    void listInvestorNews()
      .then((res) => {
        if (alive) setPosts(res.posts);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (posts.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--border)]">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
          Atualizações
        </p>
        <h2 className="mt-3 font-display text-2xl md:text-3xl">
          O que está acontecendo na Velox
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <article
              key={p.id}
              className="flex flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6"
            >
              <h3 className="font-display text-base">{p.title}</h3>
              {p.summary && (
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {p.summary}
                </p>
              )}
              {p.body && (
                <p className="mt-4 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed">
                  {p.body}
                </p>
              )}
              {p.publishedAt && (
                <time
                  dateTime={p.publishedAt}
                  className="mt-auto pt-4 text-[11px] text-[color:var(--muted-foreground)]"
                >
                  {new Date(p.publishedAt).toLocaleDateString("pt-BR")}
                </time>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}