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
      "Toda a equipe deseja um novo ciclo repleto de saúde, prosperidade, conquistas e muito sucesso.\n\nObrigado por fazer parte desta jornada.",
    ctaLabel: "Continuar",
  },
  tenure: {
    emoji: "🏅",
    title: "Nova conquista de tempo de casa",
    message: "Sua trajetória inspira toda a equipe. Obrigado por caminhar junto.",
    ctaLabel: "Continuar",
  },
  first_sale: {
    emoji: "🚀",
    title: "Primeira venda registrada",
    message: "Um marco importante — que este seja apenas o começo.",
    ctaLabel: "Continuar",
  },
  best_month: {
    emoji: "🌟",
    title: "Melhor mês da equipe",
    message: "Seu desempenho fez a diferença neste ciclo. Parabéns!",
    ctaLabel: "Continuar",
  },
  promotion: {
    emoji: "🎓",
    title: "Nova promoção",
    message: "Uma nova etapa começa. Que venham novas conquistas.",
    ctaLabel: "Continuar",
  },
  campaign_level: {
    emoji: "🏆",
    title: "Novo nível alcançado",
    message: "Você atingiu um novo nível da campanha. Excelente trabalho.",
    ctaLabel: "Continuar",
  },
  kpi_pending: {
    emoji: "📋",
    title: "Você tem indicadores pendentes",
    message:
      "Identificamos que alguns indicadores do dia anterior ainda não foram registrados no KPI Manager.\n\nMantê-los atualizados fortalece a análise da equipe e a precisão do Brain.",
    ctaLabel: "Abrir KPI Manager",
  },
  custom: {
    emoji: "✨",
    title: "Reconhecimento",
    message: "Um reconhecimento especial da equipe para você.",
    ctaLabel: "Continuar",
  },
};

export function templateFor(event: RecognitionEvent): RecognitionTemplate {
  return DEFAULTS[event.type] ?? DEFAULTS.custom;
}