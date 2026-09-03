/**
 * AÇÃO DO DIA — DEMONSTRAÇÃO (área da Central de Homologação).
 *
 * Mesma interface do modo real, com dados fictícios em memória. Este
 * componente NÃO alcança servidor, banco, E0, cadência, timeline nem
 * WhatsApp: o adaptador de demonstração não importa nenhuma função de
 * servidor. Nada aqui cria ou altera qualquer registro.
 *
 * O adaptador é SEMPRE o de demonstração — o adaptador real nunca pode
 * ser injetado nesta área.
 */
import { useMemo, useState } from "react";
import { DailyActionsOverlay } from "@/components/crm/daily-actions-overlay";
import { createDemoDailyActionsAdapter } from "@/lib/crm/daily-actions.demo";

export function HomologationDailyActionsDemo() {
  const [open, setOpen] = useState(false);
  const adapter = useMemo(() => createDemoDailyActionsAdapter(), []);

  return (
    <div className="space-y-4">
      <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">
        Demonstração
      </span>
      <p className="max-w-2xl text-sm text-[color:var(--muted-foreground)]">
        Fila fictícia com execução simulada. Executar uma ação apenas a envia para o final da
        fila: nenhum lead, card, primeiro contato, mensagem ou histórico é criado ou alterado.
        Recarregar a página reinicia a demonstração.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-4 py-2 text-sm text-[color:var(--gold)] transition hover:bg-[color:var(--gold)]/20"
      >
        Abrir a Ação do Dia
      </button>

      <DailyActionsOverlay
        adapter={adapter}
        open={open}
        onClose={() => setOpen(false)}
        /* Demonstração nunca abre a ficha real de um investidor. */
        onOpenLead={() => {}}
      />
    </div>
  );
}
