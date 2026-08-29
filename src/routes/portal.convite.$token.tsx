/**
 * Página da APRESENTAÇÃO DIGITAL (convite E6/E20).
 *
 * O que o investidor vê é o roteiro CONGELADO na emissão do seu convite
 * — nunca o roteiro administrativo atual. Se o link venceu ou foi
 * encerrado, a pessoa recebe uma explicação clara, nunca um erro
 * técnico.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resgatarConviteE20 } from "@/lib/relationship/e20.functions";

export const Route = createFileRoute("/portal/convite/$token")({
  ssr: false,
  component: ConvitePage,
  head: () => ({
    meta: [
      { title: "Apresentação Digital | Velox" },
      {
        name: "description",
        content:
          "Acesse a Apresentação Digital preparada pelo seu executivo responsável no Portal do Investidor Velox.",
      },
      { property: "og:title", content: "Apresentação Digital | Velox" },
      {
        property: "og:description",
        content: "Seu acesso pessoal ao conteúdo preparado pelo executivo Velox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type ScriptItem = {
  chapterKey: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

function ConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const redeem = useServerFn(resgatarConviteE20);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ScriptItem[] | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // O dispositivo do acesso é registrado como fato da auditoria
        // da apresentação — nunca inferido depois.
        const result = await redeem({
          data: { token, userAgent: navigator.userAgent ?? null },
        });
        if (cancelled) return;
        if (!result.valid) {
          setMessage(result.reason);
          return;
        }
        setLeadId(result.leadId);
        const script = (result.script?.items ?? []) as ScriptItem[];
        if (script.length === 0) {
          // Sem roteiro cadastrado não há conteúdo a inventar: o
          // investidor segue para a Home com o contexto do convite.
          void navigate({
            to: "/f",
            replace: true,
            search: { lead: result.leadId, m: "manual", o: "Convite do executivo" } as never,
          });
          return;
        }
        setItems(script);
      } catch {
        if (!cancelled) setMessage("Não foi possível validar este convite agora.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, redeem, navigate]);

  if (items) {
    return (
      <main className="min-h-screen bg-[#050b1a] px-6 py-14 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c9a961]">Velox</p>
          <h1 className="mt-3 text-3xl font-semibold">Sua Apresentação Digital</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
            Conteúdo preparado pelo seu executivo responsável. Assista no seu ritmo — o material
            fica disponível durante a validade deste convite.
          </p>

          <ol className="mt-10 space-y-8">
            {items.map((item, index) => (
              <li key={item.chapterKey} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-[#c9a961]">
                  Capítulo {index + 1}
                </p>
                <h2 className="mt-2 text-lg font-semibold">{item.title}</h2>
                {item.description ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{item.description}</p>
                ) : null}
                {item.videoUrl ? (
                  <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-black/40">
                    <iframe
                      src={item.videoUrl}
                      title={item.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-white/40">Vídeo ainda não disponível.</p>
                )}
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/f",
                search: { lead: leadId, m: "manual", o: "Convite do executivo" } as never,
              })
            }
            className="mt-10 inline-flex rounded-full bg-[#c9a961] px-6 py-3 text-sm font-medium text-[#0b1b33] transition hover:opacity-90"
          >
            Continuar no Portal do Investidor
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050b1a] px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold text-white">Apresentação Digital</h1>
        <p className="text-sm text-white/70">{message ?? "Validando seu convite…"}</p>
      </div>
    </main>
  );
}
