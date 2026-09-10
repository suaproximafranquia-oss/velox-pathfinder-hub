import { INDICATORS, type KpiDataset } from "./kpi-manager";
import type { KpiMonthDTO } from "./kpi-data.functions";

/** Mesmo contrato de células do KPI Manager, sem cache persistente. */
export function datasetFromCells(userId: string, monthKey: string, payload: KpiMonthDTO): KpiDataset {
  const matrix: KpiDataset["matrix"] = {};
  for (const indicator of INDICATORS) matrix[indicator.id] = {};
  for (const cell of payload.cells) {
    const row = matrix[cell.indicatorId] ?? (matrix[cell.indicatorId] = {});
    row[cell.day] = cell.value;
  }
  return { userId, monthKey, matrix, updatedAt: payload.updatedAt };
}