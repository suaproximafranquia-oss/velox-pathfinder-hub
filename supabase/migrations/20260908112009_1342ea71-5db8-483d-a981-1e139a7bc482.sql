ALTER TABLE public.portal_meetings
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS external_follow_up text,
  ADD COLUMN IF NOT EXISTS follow_up_state text,
  ADD COLUMN IF NOT EXISTS follow_up_state_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_review_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_review_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS portal_meetings_external_ref_uidx
  ON public.portal_meetings (external_source, external_ref)
  WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS portal_meetings_follow_up_review_idx
  ON public.portal_meetings (follow_up_state, follow_up_review_due_at)
  WHERE external_ref IS NOT NULL;