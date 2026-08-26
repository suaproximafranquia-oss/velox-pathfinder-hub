ALTER TABLE public.relationship_message_library
  ADD COLUMN IF NOT EXISTS step_key text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS supersedes_id text,
  ADD COLUMN IF NOT EXISTS button_kind text;

UPDATE public.relationship_message_library SET step_key = COALESCE(step_key, upper(purpose)) WHERE step_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS relationship_message_library_active_step
  ON public.relationship_message_library (scope, step_key)
  WHERE active;

CREATE INDEX IF NOT EXISTS relationship_message_library_step_version
  ON public.relationship_message_library (scope, step_key, version DESC);

ALTER TABLE public.relationship_message_sends
  ADD COLUMN IF NOT EXISTS template_body text,
  ADD COLUMN IF NOT EXISTS library_code text,
  ADD COLUMN IF NOT EXISTS investor_name_used text,
  ADD COLUMN IF NOT EXISTS actor_id text,
  ADD COLUMN IF NOT EXISTS actor_name text,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'motor',
  ADD COLUMN IF NOT EXISTS occurrence_id text,
  ADD COLUMN IF NOT EXISTS message_id text;

CREATE INDEX IF NOT EXISTS relationship_message_sends_lead_at
  ON public.relationship_message_sends (lead_id, sent_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS relationship_message_sends_message_id
  ON public.relationship_message_sends (message_id)
  WHERE message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.relationship_message_library TO authenticated;
GRANT ALL ON public.relationship_message_library TO service_role;
GRANT SELECT, INSERT ON public.relationship_message_sends TO authenticated;
GRANT ALL ON public.relationship_message_sends TO service_role;