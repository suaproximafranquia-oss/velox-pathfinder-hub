ALTER TABLE public.relationship_message_sends
  ADD COLUMN IF NOT EXISTS executive_id text,
  ADD COLUMN IF NOT EXISTS executive_name text,
  ADD COLUMN IF NOT EXISTS portal_destination text,
  ADD COLUMN IF NOT EXISTS contact_destination text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS button_destinations jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS relationship_e20_one_open_per_lead
  ON public.relationship_e20_occurrences (lead_id)
  WHERE closed_at IS NULL;