import { useRef, useState } from "react";
import { X, Minus, ExternalLink } from "lucide-react";

/**
 * Janela flutuante do ChatGPT dentro do CRM.
 *
 * É apenas uma aba do navegador incorporada: nenhuma integração por API,
 * nenhum prompt automático e nenhuma cópia automática de respostas. O
 * Executivo utiliza o ChatGPT normalmente e cola o texto na conversa.
 * A barra de endereço, as abas e os favoritos do navegador não existem
 * aqui — apenas o conteúdo.
 */
const CHATGPT_URL = "https://chatgpt.com/";

export function CrmChatGptWindow({ onClose }: { onClose: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);
  const drag = useRef<{ x: number; y: number; base: { x: number; y: number } } | null>(null);

  return (
    <div
      className="fixed bottom-6 right-6 z-[95] flex w-[min(460px,92vw)] flex-col overflow-hidden rounded-2xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] shadow-2xl"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, height: minimized ? "auto" : "min(640px, 78vh)" }}
      role="dialog"
      aria-label="ChatGPT"
    >
      <header
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, base: pos };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setPos({ x: d.base.x + (e.clientX - d.x), y: d.base.y + (e.clientY - d.y) });
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        className="flex shrink-0 cursor-grab items-center justify-between gap-3 border-b border-[color:var(--crm-border)] px-4 py-2.5 active:cursor-grabbing"
      >
        <span className="text-[12px] font-semibold tracking-[-0.01em]">ChatGPT</span>
        <span className="flex items-center gap-1">
          <a
            href={CHATGPT_URL}
            target="_blank"
            rel="noreferrer"
            title="Abrir em nova janela"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            title={minimized ? "Restaurar" : "Minimizar"}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)]"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[color:var(--crm-muted)] transition-colors hover:bg-[color:var(--crm-hover)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </header>
      {minimized ? null : (
        <div className="relative min-h-0 flex-1">
          <iframe
            src={CHATGPT_URL}
            title="ChatGPT"
            className="h-full w-full border-0 bg-white"
          />
          {/* Alternativa silenciosa: alguns navegadores impedem a exibição
              incorporada. O atalho abaixo mantém o fluxo do Executivo. */}
          <a
            href={CHATGPT_URL}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-medium text-white opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
          >
            Não carregou? Abrir em nova janela
          </a>
        </div>
      )}
    </div>
  );
}
