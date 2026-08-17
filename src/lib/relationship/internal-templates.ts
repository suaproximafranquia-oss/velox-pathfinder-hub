/**
 * TEMPLATES INTERNOS DA CADÊNCIA (COMANDO 3E).
 *
 * Registro oficial das mensagens do projeto para uso do motor em
 * HOMOLOGAÇÃO. Estes registros:
 *   • NÃO são templates da Meta;
 *   • NÃO possuem ID da Meta (nunca inventar);
 *   • NÃO são submetidos, aprovados ou consultados na API real;
 *   • ficam prontos para vinculação futura a um template oficial.
 */
import { HOMOLOGATION_MESSAGES } from "./messages";
import type { CadenceStep } from "./types";

export type InternalTemplateStatus = "NAO_SUBMETIDO_META";

export type InternalTemplate = {
  /** Código interno estável (nunca um ID da Meta). */
  code: string;
  step: CadenceStep;
  /** Rótulo de gestão. */
  label: string;
  purpose: string;
  status: InternalTemplateStatus;
  /** Vinculação futura ao template oficial da Meta (§ vinculação). */
  metaTemplateId: null;
  metaTemplateName: null;
  /** Grupo da Biblioteca de Conteúdos exigido pela etapa. */
  contentGroup: string | null;
  variables: string[];
  usesInvestorName: boolean;
  body: string;
};

const LABELS: Record<CadenceStep, { label: string; }> = {
  E0: { label: "E0 — Primeiro contato" },
  E1: { label: "E1 — Segundo contato" },
  E3: { label: "E3 — Terceiro contato" },
  E4: { label: "E4 — Quarto contato" },
  E12: { label: "E12 — Encerramento educado" },
  V3: { label: "V3 — Visualizou e não respondeu" },
  V4: { label: "V4 — Visualizou (encerramento)" },
  R1: { label: "R1 — Reengajamento 1" },
  R2: { label: "R2 — Reengajamento 2" },
  R3: { label: "R3 — Reengajamento (encerramento)" },
};

function extractVariables(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]!))];
}

export const INTERNAL_CADENCE_TEMPLATES: InternalTemplate[] = (
  Object.keys(HOMOLOGATION_MESSAGES) as CadenceStep[]
).map((step) => {
  const message = HOMOLOGATION_MESSAGES[step];
  return {
    code: `INT-${step}`,
    step,
    label: LABELS[step].label,
    purpose: message.purpose,
    status: "NAO_SUBMETIDO_META" as const,
    metaTemplateId: null,
    metaTemplateName: null,
    contentGroup: message.contentGroup,
    // A URL do botão não aparece no texto, mas continua sendo variável
    // declarada do template (E0 = {{link_portal}}).
    variables: [
      ...extractVariables(message.text),
      ...(message.button === "portal" ? ["link_portal"] : []),
    ],
    usesInvestorName: message.usesInvestorName,
    body: message.text,
  };
});

export function getInternalTemplate(step: CadenceStep): InternalTemplate | null {
  return INTERNAL_CADENCE_TEMPLATES.find((t) => t.step === step) ?? null;
}

/** Rótulo humano exibido na homologação/auditoria. */
export const INTERNAL_TEMPLATE_STATUS_LABEL = "Não submetido à Meta";