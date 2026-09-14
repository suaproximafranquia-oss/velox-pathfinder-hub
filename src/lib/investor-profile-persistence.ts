import { saveInvestorProfile } from "@/lib/portal-access.functions";
import { getCurrentInvestorId } from "@/lib/portal-session";
import { ensurePortalToken } from "@/lib/portal-token";
import type { PersistedInvestorProfile } from "@/lib/investor-profile-deterministic";

export async function persistInvestorProfile(patch: Pick<PersistedInvestorProfile, "commercial" | "selfAssessment">): Promise<boolean> {
  const investorId = getCurrentInvestorId();
  if (!investorId) return false;
  const token = await ensurePortalToken(investorId);
  if (!token) return false;
  return (await saveInvestorProfile({ data: { investorId, token, patch } })).ok;
}