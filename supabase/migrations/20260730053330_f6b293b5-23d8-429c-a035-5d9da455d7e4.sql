CREATE INDEX IF NOT EXISTS portal_leads_executive_idx
  ON public.portal_leads (responsible_executive_id, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS portal_leads_created_at_idx
  ON public.portal_leads (created_at DESC);