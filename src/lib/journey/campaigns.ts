/**
 * Journey Engine — atribuição comercial (origem, campanha, link).
 *
 * Alimenta o Painel de Campanhas e o Brain Analytics exclusivamente com
 * dados reais produzidos pelo Journey Engine. Nada é simulado.
 */
import { investorPortalPath } from "@/lib/portal-brands";
import { listJourneys } from "./engine";
import { summarizeJourney } from "./insights";

export type CampaignSource = {
  key: string;
  origin: string;
  campaign: string | null;
  link: string | null;
  leads: number;
  manualStarted: number;
  manualCompleted: number;
  simulations: number;
  contacts: number;
  meetings: number;
  conversion: number;
  averageScore: number;
};

export type JourneyFunnel = {
  leads: number;
  manualStarted: number;
  manualCompleted: number;
  simulations: number;
  contacts: number;
  meetings: number;
};

export function buildJourneyFunnel(executiveId?: string | null): JourneyFunnel {
  const journeys = listJourneys().filter(
    (j) => !executiveId || j.executiveId === executiveId,
  );
  return {
    leads: journeys.length,
    manualStarted: journeys.filter((j) => j.progress.percent > 0).length,
    manualCompleted: journeys.filter((j) => j.progress.percent >= 100).length,
    simulations: journeys.filter((j) => j.counters.simulations > 0).length,
    contacts: journeys.filter((j) => j.counters.whatsapp > 0).length,
    meetings: journeys.filter((j) => j.counters.meetings > 0).length,
  };
}

export function buildCampaignSources(executiveId?: string | null): CampaignSource[] {
  const journeys = listJourneys().filter(
    (j) => !executiveId || j.executiveId === executiveId,
  );
  const map = new Map<string, CampaignSource & { scoreSum: number }>();

  for (const j of journeys) {
    const key = `${j.origin}|${j.campaign ?? "-"}|${j.link ?? j.executiveSlug ?? "-"}`;
    const entry =
      map.get(key) ??
      ({
        key,
        origin: j.origin,
        campaign: j.campaign,
        link: j.link ?? (j.executiveSlug ? investorPortalPath(j.executiveSlug) : null),
        leads: 0,
        manualStarted: 0,
        manualCompleted: 0,
        simulations: 0,
        contacts: 0,
        meetings: 0,
        conversion: 0,
        averageScore: 0,
        scoreSum: 0,
      } as CampaignSource & { scoreSum: number });

    entry.leads += 1;
    if (j.progress.percent > 0) entry.manualStarted += 1;
    if (j.progress.percent >= 100) entry.manualCompleted += 1;
    if (j.counters.simulations > 0) entry.simulations += 1;
    if (j.counters.whatsapp > 0) entry.contacts += 1;
    if (j.counters.meetings > 0) entry.meetings += 1;
    entry.scoreSum += summarizeJourney(j).engagementScore;
    map.set(key, entry);
  }

  return [...map.values()]
    .map((e) => ({
      ...e,
      conversion: e.leads ? Math.round(((e.contacts + e.meetings) / e.leads) * 100) : 0,
      averageScore: e.leads ? Math.round(e.scoreSum / e.leads) : 0,
    }))
    .sort((a, b) => b.leads - a.leads);
}