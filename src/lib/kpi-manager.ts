/**
 * KPI Manager — arquitetura preparatoria.
 * Nao implementa o modulo. Fornece tipos, contexto persistido
 * (mes selecionado e colaborador ativo) e interfaces estaveis para
 * a futura camada de dados + eventos + relatorios.
 *
 * Fluxo alvo:
 *   KPI Manager -> Banco -> Brain -> Dashboards / Relatorios / IA
 */
import { useCallback, useEffect, useState } from "react";
import type { ExecutiveSession } from "./executive-auth";

export type KpiMonth = { year: number; month: number; label: string };

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function buildMonthHistory(count = 6, ref = new Date()): KpiMonth[] {
  const out: KpiMonth[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return out;
}

export function monthKey(m: KpiMonth): string {
  return `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
}

/** Indicadores diarios — modelo base extensivel por Workspace. */
export type KpiEntry = {
  day: number;
  calls?: number;
  meetings?: number;
  proposals?: number;
  contracts?: number;
  sales?: number;
};

export type KpiDataset = {
  userId: string;
  month: KpiMonth;
  entries: KpiEntry[];
};

/**
 * Fonte de dados do KPI. A implementacao inicial e simulada; a
 * substituicao futura por backend real nao deve exigir alteracao
 * dos componentes.
 */
export interface KpiDataSource {
  load(userId: string, month: KpiMonth): Promise<KpiDataset>;
  save(dataset: KpiDataset): Promise<void>;
}

/** Contexto persistido da navegacao — mes e colaborador ativos. */
const CTX_KEY = "atlas:kpi:context:v1";

export type KpiContext = { monthKey: string; collaboratorId: string };

export function useKpiContext(session: ExecutiveSession, defaults: KpiContext) {
  const [ctx, setCtx] = useState<KpiContext>(defaults);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CTX_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<KpiContext>;
      setCtx((c) => ({
        monthKey: parsed.monthKey ?? c.monthKey,
        collaboratorId: parsed.collaboratorId ?? c.collaboratorId,
      }));
    } catch {
      /* silencioso */
    }
  }, [session.userId]);

  const update = useCallback((patch: Partial<KpiContext>) => {
    setCtx((c) => {
      const next = { ...c, ...patch };
      if (typeof window !== "undefined")
        window.localStorage.setItem(CTX_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { ctx, update };
}

/**
 * Comparacao futura KPI x CRM — arquitetura preparada. Nenhum
 * componente consome hoje; expoe o formato estavel do resultado.
 */
export type ConsistencyCheck = {
  metric: string;
  kpiValue: number;
  crmValue: number;
  status: "consistente" | "divergente";
};
