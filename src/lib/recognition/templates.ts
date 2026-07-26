/**
 * Templates de reconhecimento — camada White Label.
 *
 * Cada empresa poderá futuramente personalizar título, mensagem, ícone,
 * cores e call-to-action sem alteração de código, sobrepondo o template
 * padrão via configuração do workspace. Nesta sprint apenas o template
 * "birthday" está implementado.
 */
import type { RecognitionEvent, RecognitionType } from "./engine";

export type RecognitionTemplate = {
  emoji: string;
  title: string;
  message: string;
  ctaLabel: string;
  /** Cor de destaque do modal (fallback: dourado do workspace ativo). */
  accent?: string;
};

const DEFAULTS: Record<RecognitionType, RecognitionTemplate> = {
  birthday: {
    emoji: "🎉",
    title: "Feliz Aniversário!",
    message:
      "Toda a equipe deseja um ciclo novo com saúde, tranquilidade e boas realizações.\n\nObrigado por caminhar com a gente.",
    ctaLabel: "Continuar",
  },
  tenure: {
    emoji: "🏅",
    title: "Uma nova marca de tempo com a gente",
    message: "Obrigado pelo tempo dedicado e pelo cuidado no dia a dia. Que este próximo ciclo seja leve.",
    ctaLabel: "Continuar",
  },
  first_sale: {
    emoji: "🚀",
    title: "Primeira venda registrada",
    message: "Um passo importante da sua jornada. Seguimos com você nos próximos.",
    ctaLabel: "Continuar",
  },
  best_month: {
    emoji: "🌟",
    title: "Um mês que merece reconhecimento",
    message: "Sua consistência ajudou a equipe neste ciclo. Obrigado pelo cuidado.",
    ctaLabel: "Continuar",
  },
  promotion: {
    emoji: "🎓",
    title: "Um novo momento da sua trajetória",
    message: "Uma etapa nova se abre. Estamos com você nesse próximo passo.",
    ctaLabel: "Continuar",
  },
  campaign_level: {
    emoji: "🏆",
    title: "Um novo nível na campanha",
    message: "Um marco reconhecido pela equipe. Que o próximo ciclo venha com o mesmo cuidado.",
    ctaLabel: "Continuar",
  },
  kpi_pending: {
    emoji: "📋",
    title: "Um lembrete tranquilo do KPI",
    message:
      "Alguns indicadores do dia anterior ainda não foram lançados. Sempre que puder, atualize — ajuda o time a enxergar o cenário com clareza.",
    ctaLabel: "Abrir KPI Manager",
  },
  custom: {
    emoji: "✨",
    title: "Reconhecimento",
    message: "Um reconhecimento da equipe para você.",
    ctaLabel: "Continuar",
  },
};

export function templateFor(event: RecognitionEvent): RecognitionTemplate {
  return DEFAULTS[event.type] ?? DEFAULTS.custom;
}