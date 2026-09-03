/**
 * FOTOGRAFIA ATUAL DAS ETAPAS — exibição somente leitura.
 *
 * Mostra, dentro da Central de Homologação, exatamente os códigos
 * registrados em `current-steps.ts`. Nenhuma etapa é criada, editada
 * ou inferida aqui: é uma foto, não um editor.
 */
import {
  CURRENT_STEP_FLOWS,
  CURRENT_STEP_FLOW_LABELS,
  type CurrentStepFlow,
} from "@/lib/relationship/current-steps";

const FLOWS: CurrentStepFlow[] = ["E", "R", "RE", "RF"];

export function CurrentStepSnapshotCard() {
  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-5">
      <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
        Fotografia atual das etapas
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-[color:var(--muted-foreground)]">
        Registro temporário e explícito dos códigos de etapa que existem hoje na Biblioteca de
        Conteúdos. Somente leitura: não altera o motor, não cria etapas e não depende de nova
        importação do documento histórico.
      </p>
      <div className="mt-4 space-y-3">
        {FLOWS.map((flow) => (
          <div key={flow} className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
              {CURRENT_STEP_FLOW_LABELS[flow]}
            </span>
            {CURRENT_STEP_FLOWS[flow].map((step) => (
              <span
                key={step}
                className="rounded-lg border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--foreground)]"
              >
                {step}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
