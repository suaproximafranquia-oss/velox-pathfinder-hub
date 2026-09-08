ALTER TABLE public.relationship_queue
  ADD COLUMN IF NOT EXISTS action_order integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS action_kind text,
  ADD COLUMN IF NOT EXISTS theoretical_date date,
  ADD COLUMN IF NOT EXISTS origin_date date,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.relationship_queue'::regclass
      AND conname = 'relationship_queue_action_kind_check'
  ) THEN
    ALTER TABLE public.relationship_queue
      ADD CONSTRAINT relationship_queue_action_kind_check
      CHECK (action_kind IS NULL OR action_kind IN ('call','message'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS relationship_queue_lead_step_action_idx
  ON public.relationship_queue (scope, lead_id, step, action_order);

ALTER TABLE public.relationship_cadences
  ADD COLUMN IF NOT EXISTS awaiting_handoff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS awaiting_handoff_since timestamptz,
  ADD COLUMN IF NOT EXISTS awaiting_handoff_reason text;

ALTER TABLE public.relationship_message_library
  ADD COLUMN IF NOT EXISTS step_context text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.relationship_message_library'::regclass
      AND conname = 'relationship_message_library_step_context_check'
  ) THEN
    ALTER TABLE public.relationship_message_library
      ADD CONSTRAINT relationship_message_library_step_context_check
      CHECK (step_context IS NULL OR step_context IN ('SEM_CONTATO','MATERIAL_ENVIADO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS relationship_message_library_step_context_idx
  ON public.relationship_message_library (step_key, step_context, active);