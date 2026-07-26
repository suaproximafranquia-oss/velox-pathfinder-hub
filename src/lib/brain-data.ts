/**
 * Brain Analytics — dados simulados.
 * Toda a estrutura desta camada existe apenas para viabilizar a
 * experiência de navegação. Nenhum número aqui é real. Futuramente
 * será substituída por conectores externos (CRM, GreenSales etc.).
 * Nenhuma regra desta camada pode depender de um workspace específico.
 */

export type BrainPeriod = 7 | 14 | 30 | 90;

export const PERIOD_OPTIONS: { value: BrainPeriod; label: string }[] = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 14, label: "Últimos 14 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 90, label: "Últimos 90 dias" },
];

export type BrainKpi = {
  id: string;
  label: string;
  value: string;
  delta: number; // variação percentual simulada
  hint?: string;
};

export type FunnelStage = {
  id: string;
  label: string;
  value: number;
};

export type SeriesPoint = { x: string; y: number };

export type BrainSnapshot = {
  period: BrainPeriod;
  kpis: BrainKpi[];
  funnel: FunnelStage[];
  conversion: SeriesPoint[]; // taxas por etapa
  evolution: SeriesPoint[]; // evolução acumulada
  temporal: SeriesPoint[]; // volumes por dia
  trend: SeriesPoint[]; // tendência projetada
};

// Gerador determinístico simples para que o mesmo período retorne
// sempre os mesmos valores durante a sessão.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function buildSnapshot(period: BrainPeriod): BrainSnapshot {
  const rnd = seeded(period * 137);
  const scale = period / 30;

  const novos = Math.round(140 * scale + rnd() * 40);
  const oportunidades = Math.round(novos * 0.62);
  const videos = Math.round(oportunidades * 0.55);
  const cofs = Math.round(videos * 0.48);
  const contratos = Math.round(cofs * 0.7);
  const vendas = Math.round(contratos * 0.82);
  const conv = (vendas / Math.max(novos, 1)) * 100;
  const tempoDias = 12 + rnd() * 8;

  const kpis: BrainKpi[] = [
    { id: "novos", label: "Novos Investidores", value: fmtInt(novos), delta: +6.4 },
    { id: "oport", label: "Oportunidades", value: fmtInt(oportunidades), delta: +4.1 },
    { id: "video", label: "Vídeo Chamadas", value: fmtInt(videos), delta: +2.8 },
    { id: "cof", label: "COFs Enviadas", value: fmtInt(cofs), delta: -1.2 },
    { id: "contratos", label: "Contratos", value: fmtInt(contratos), delta: +3.6 },
    { id: "vendas", label: "Vendas", value: fmtInt(vendas), delta: +5.9 },
    { id: "conv", label: "Conversão Geral", value: fmtPct(conv), delta: +0.8 },
    {
      id: "tempo",
      label: "Tempo Médio de Evolução",
      value: `${tempoDias.toFixed(1)} d`,
      delta: -1.4,
      hint: "Do primeiro contato à venda",
    },
  ];

  const funnel: FunnelStage[] = [
    { id: "novo", label: "Novo", value: novos },
    { id: "contato", label: "Primeiro Contato", value: Math.round(novos * 0.78) },
    { id: "oport", label: "Oportunidade", value: oportunidades },
    { id: "video", label: "Vídeo", value: videos },
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

  return { period, kpis, funnel, conversion, evolution, temporal, trend };
}

// ---------- Alertas persistentes ----------

export type AlertPriority = "alta" | "media" | "baixa";

export type BrainAlert = {
  id: string;
  title: string;
  description: string;
  priority: AlertPriority;
  date: string; // ISO
  dismissed?: boolean;
};

const ALERTS_KEY = "atlas:brain:alerts:v1";

const SEED_ALERTS: BrainAlert[] = [
  {
    id: "alert_novos",
    title: "8 novos investidores aguardando contato",
    description:
      "Registros recebidos nas últimas horas ainda não tiveram primeiro contato.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: "alert_followup",
    title: "3 follow-ups programados para hoje",
    description: "Interações agendadas com investidores em avaliação.",
    priority: "media",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "alert_cof",
    title: "2 COFs aguardando retorno",
    description: "Propostas enviadas há mais de 48h sem resposta.",
    priority: "alta",
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "alert_retorno",
    title: "Um investidor retornou ao Portal recentemente",
    description:
      "Retomada de leitura detectada — momento oportuno para reengajamento.",
    priority: "baixa",
    date: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
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
  media: "Média",
  baixa: "Baixa",
};