/**
 * Brain Analytics — camada de dados simulados.
 * Os componentes consomem apenas os tipos e funcoes deste arquivo.
 * A substituicao futura por dados reais nao exige alteracao visual.
 * Nenhuma regra pode depender de um workspace especifico.
 */
import type { ScopeSelection } from "./brain/scopes";

export type BrainPeriod = 7 | 14 | 30 | 90;

export const PERIOD_OPTIONS: { value: BrainPeriod; label: string }[] = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

export type BrainKpi = {
  id: string;
  label: string;
  value: string;
  delta: number;
  description: string;
  tooltip: string;
  /** Chave semantica do icone; o componente mapeia para Lucide. */
  icon:
    | "users"
    | "sparkles"
    | "video"
    | "fileCheck"
    | "handshake"
    | "trophy"
    | "activity"
    | "clock";
};

export type FunnelStage = { id: string; label: string; value: number };
export type SeriesPoint = { x: string; y: number };

export type BrainSnapshot = {
  period: BrainPeriod;
  scope: ScopeSelection;
  kpis: BrainKpi[];
  funnel: FunnelStage[];
  conversion: SeriesPoint[];
  evolution: SeriesPoint[];
  temporal: SeriesPoint[];
  trend: SeriesPoint[];
};

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function scopeMultiplier(scope: ScopeSelection): number {
  switch (scope.mode) {
    case "company":
      return 1;
    case "team":
      return 0.55;
    case "executive":
      return 0.18;
    case "personal":
      return 0.15;
    case "comparison":
      return 0.6;
  }
}

/**
 * Snapshot simulado. A assinatura (period, scope) e a superficie
 * estavel para a futura fonte real de dados.
 */
export function buildSnapshot(
  period: BrainPeriod,
  scope: ScopeSelection,
): BrainSnapshot {
  const rnd = seeded(period * 137 + scope.mode.length * 31);
  const scale = (period / 30) * scopeMultiplier(scope);

  const novos = Math.round(140 * scale + rnd() * 40);
  const oportunidades = Math.round(novos * 0.62);
  const videos = Math.round(oportunidades * 0.55);
  const cofs = Math.round(videos * 0.48);
  const contratos = Math.round(cofs * 0.7);
  const vendas = Math.round(contratos * 0.82);
  const conv = (vendas / Math.max(novos, 1)) * 100;
  const tempoDias = 12 + rnd() * 8;

  const kpis: BrainKpi[] = [
    {
      id: "novos",
      label: "Novos Investidores",
      value: fmtInt(novos),
      delta: 6.4,
      description: "Entradas no periodo",
      tooltip: "Registros novos recebidos no periodo selecionado.",
      icon: "users",
    },
    {
      id: "oport",
      label: "Oportunidades",
      value: fmtInt(oportunidades),
      delta: 4.1,
      description: "Qualificacao positiva",
      tooltip: "Registros qualificados como oportunidades ativas.",
      icon: "sparkles",
    },
    {
      id: "video",
      label: "Video Chamadas",
      value: fmtInt(videos),
      delta: 2.8,
      description: "Reunioes realizadas",
      tooltip: "Encontros consultivos concluidos.",
      icon: "video",
    },
    {
      id: "cof",
      label: "COFs Enviadas",
      value: fmtInt(cofs),
      delta: -1.2,
      description: "Propostas ativas",
      tooltip: "Confirmacoes formais de oferta enviadas.",
      icon: "fileCheck",
    },
    {
      id: "contratos",
      label: "Contratos",
      value: fmtInt(contratos),
      delta: 3.6,
      description: "Assinaturas em curso",
      tooltip: "Contratos gerados a partir das COFs enviadas.",
      icon: "handshake",
    },
    {
      id: "vendas",
      label: "Vendas",
      value: fmtInt(vendas),
      delta: 5.9,
      description: "Fechamentos concluidos",
      tooltip: "Contratos convertidos em venda efetiva.",
      icon: "trophy",
    },
    {
      id: "conv",
      label: "Conversao Geral",
      value: fmtPct(conv),
      delta: 0.8,
      description: "Do primeiro contato a venda",
      tooltip: "Percentual de conversao ao longo do funil completo.",
      icon: "activity",
    },
    {
      id: "tempo",
      label: "Tempo Medio de Evolucao",
      value: `${tempoDias.toFixed(1)} d`,
      delta: -1.4,
      description: "Ciclo medio da jornada",
      tooltip: "Tempo medio entre primeiro contato e fechamento.",
      icon: "clock",
    },
  ];

  const funnel: FunnelStage[] = [
    { id: "novo", label: "Novo", value: novos },
    { id: "contato", label: "Primeiro Contato", value: Math.round(novos * 0.78) },
    { id: "oport", label: "Oportunidade", value: oportunidades },
    { id: "video", label: "Video", value: videos },
    { id: "cof", label: "COF", value: cofs },
    { id: "venda", label: "Venda", value: vendas },
  ];

  const conversion: SeriesPoint[] = funnel.slice(1).map((s, i) => ({
    x: s.label,
    y: Math.round((s.value / Math.max(funnel[i].value, 1)) * 100),
  }));

  const days = period;
  const temporal: SeriesPoint[] = Array.from({ length: days }).map((_, i) => {
    const base = 6 + rnd() * 8;
    const wave = Math.sin(i / 3) * 3;
    return { x: `D-${days - i}`, y: Math.max(1, Math.round(base + wave)) };
  });

  let acc = 0;
  const evolution: SeriesPoint[] = temporal.map((p) => {
    acc += p.y;
    return { x: p.x, y: acc };
  });

  const trend: SeriesPoint[] = temporal.map((p, i) => ({
    x: p.x,
    y: Math.round(p.y * (1 + i / (days * 2))),
  }));

  return { period, scope, kpis, funnel, conversion, evolution, temporal, trend };
}

// ---------- Alertas persistentes ----------

export type AlertPriority = "alta" | "media" | "baixa";

export type AlertCategory =
  | "contato"
  | "followup"
  | "portal"
  | "contrato"
  | "reuniao"
  | "oportunidade";

export const CATEGORY_LABEL: Record<AlertCategory, string> = {
  contato: "Contato",
  followup: "Follow-up",
  portal: "Portal",
  contrato: "Contrato",
  reuniao: "Reuniao",
  oportunidade: "Oportunidade",
};

export type BrainAlert = {
  id: string;
  category: AlertCategory;
  title: string;
  description: string;
  priority: AlertPriority;
  /** ISO datetime — data + hora ficam na mesma origem. */
  date: string;
  /** Mensagem sugerida para o botao Copiar. */
  copyTemplate: string;
  dismissed?: boolean;
};

const ALERTS_KEY = "atlas:brain:alerts:v2";

const SEED_ALERTS: BrainAlert[] = [
  {
    id: "alert_novos",
    category: "contato",
    title: "Voce possui 12 novos investidores aguardando contato",
    description:
      "Registros recebidos recentemente ainda nao tiveram primeiro contato.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    copyTemplate:
      "Ola. Vi que voce chegou recentemente ao nosso Portal e quero me apresentar como seu consultor. Fico a disposicao para conversar quando fizer sentido para voce.",
  },
  {
    id: "alert_followup",
    category: "followup",
    title: "Existem 5 follow-ups programados para hoje",
    description: "Interacoes agendadas com investidores em avaliacao.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    copyTemplate:
      "Ola. Retomando nossa conversa: separei alguns pontos que podem ajudar na sua decisao. Posso te ligar hoje?",
  },
  {
    id: "alert_portal",
    category: "portal",
    title: "Um investidor retornou recentemente ao Portal",
    description:
      "Retomada de leitura detectada — momento oportuno para reengajamento.",
    priority: "baixa",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    copyTemplate:
      "Ola. Percebi que voce voltou recentemente ao nosso Portal. Caso ainda tenha interesse em continuar sua jornada, fico a disposicao.",
  },
  {
    id: "alert_contratos",
    category: "contrato",
    title: "Existem contratos aguardando retorno",
    description: "Propostas enviadas ha mais de 48h sem resposta.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    copyTemplate:
      "Ola. Passando aqui para confirmar se voce recebeu o contrato e se posso esclarecer alguma duvida.",
  },
  {
    id: "alert_reuniao",
    category: "reuniao",
    title: "Existe uma videoconferencia agendada",
    description: "Reuniao consultiva marcada para as proximas horas.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    copyTemplate:
      "Ola. Confirmando nossa videoconferencia. Assim que estiver pronto, envio o link de acesso.",
  },
  {
    id: "alert_oportunidade",
    category: "oportunidade",
    title: "Oportunidades sem atualizacao ha mais de sete dias",
    description:
      "Registros parados na esteira consultiva sem novas interacoes.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    copyTemplate:
      "Ola. Notei que faz alguns dias desde nossa ultima conversa. Posso te ajudar com alguma pendencia?",
  },
];

export function loadAlerts(): BrainAlert[] {
  if (typeof window === "undefined") return SEED_ALERTS;
  try {
    const raw = window.localStorage.getItem(ALERTS_KEY);
    if (!raw) {
      window.localStorage.setItem(ALERTS_KEY, JSON.stringify(SEED_ALERTS));
      return SEED_ALERTS;
    }
    const arr = JSON.parse(raw) as BrainAlert[];
    if (!Array.isArray(arr)) return SEED_ALERTS;
    return arr;
  } catch {
    return SEED_ALERTS;
  }
}

export function saveAlerts(alerts: BrainAlert[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function dismissAlert(id: string): BrainAlert[] {
  const next = loadAlerts().map((a) =>
    a.id === id ? { ...a, dismissed: true } : a,
  );
  saveAlerts(next);
  return next;
}

export const PRIORITY_LABEL: Record<AlertPriority, string> = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};
