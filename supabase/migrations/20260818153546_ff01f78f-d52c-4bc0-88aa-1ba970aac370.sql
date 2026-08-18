ALTER TABLE public.portal_leads
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS journey_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS relationship_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS relationship_started_by text,
  ADD COLUMN IF NOT EXISTS relationship_started_by_name text,
  ADD COLUMN IF NOT EXISTS relationship_source text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by text,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by text,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ownership_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ownership_origin text,
  ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversation_window_opened_at timestamptz;

ALTER TABLE public.portal_leads
  ADD CONSTRAINT portal_leads_commercial_state_valid
  CHECK (commercial_state IN ('journey', 'active', 'archived'));

ALTER TABLE public.portal_leads
  ADD CONSTRAINT portal_leads_relationship_source_valid
  CHECK (relationship_source IS NULL OR relationship_source IN ('executive', 'investor_request'));

CREATE INDEX IF NOT EXISTS portal_leads_responsible_state_idx
  ON public.portal_leads (responsible_executive_id, commercial_state, last_activity_at DESC);

CREATE TABLE public.portal_meetings (
  id text PRIMARY KEY,
  investor_id text NOT NULL,
  investor_name text NOT NULL,
  investor_email text,
  executive_id text NOT NULL,
  executive_name text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60,
  status text NOT NULL,
  meet_url text,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  cancel_reason text,
  requested_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  topic text,
  origin text NOT NULL DEFAULT 'executive',
  google_event_id text,
  google_sync text NOT NULL DEFAULT 'none',
  google_sync_error text,
  google_synced_at timestamptz,
  meeting_provider text,
  meeting_provider_status text,
  meeting_provider_meeting_id text,
  meeting_provider_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_meetings_status_valid CHECK (status IN ('Solicitada','Agendada','Confirmada','Reagendada','Em andamento','Concluída','Cancelada')),
  CONSTRAINT portal_meetings_origin_valid CHECK (origin IN ('portal','executivo')),
  CONSTRAINT portal_meetings_google_sync_valid CHECK (google_sync IN ('none','synced','pending','failed')),
  CONSTRAINT portal_meetings_duration_valid CHECK (duration_min > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_meetings TO authenticated;
GRANT ALL ON public.portal_meetings TO service_role;

ALTER TABLE public.portal_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autorizada le reunioes"
ON public.portal_meetings FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR executive_id = public.current_executive_id()
  OR public.can_access_investor(investor_id)
);

CREATE POLICY "Equipe autorizada cria reunioes"
ON public.portal_meetings FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR executive_id = public.current_executive_id()
  OR public.can_access_investor(investor_id)
);

CREATE POLICY "Equipe autorizada atualiza reunioes"
ON public.portal_meetings FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR executive_id = public.current_executive_id()
  OR public.can_access_investor(investor_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR executive_id = public.current_executive_id()
  OR public.can_access_investor(investor_id)
);

CREATE POLICY "Equipe autorizada remove reunioes"
ON public.portal_meetings FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
  OR executive_id = public.current_executive_id()
  OR public.can_access_investor(investor_id)
);

CREATE INDEX portal_meetings_executive_schedule_idx
  ON public.portal_meetings (executive_id, scheduled_at DESC);
CREATE INDEX portal_meetings_investor_idx
  ON public.portal_meetings (investor_id, scheduled_at DESC);

CREATE TRIGGER update_portal_meetings_updated_at
BEFORE UPDATE ON public.portal_meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_meetings;