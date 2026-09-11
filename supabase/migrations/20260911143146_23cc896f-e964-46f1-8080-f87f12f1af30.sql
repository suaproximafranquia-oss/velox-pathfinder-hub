ALTER TABLE public.relationship_queue
  DROP CONSTRAINT IF EXISTS relationship_queue_action_kind_check;

ALTER TABLE public.relationship_queue
  ADD CONSTRAINT relationship_queue_action_kind_check
  CHECK (
    action_kind IS NULL
    OR action_kind = ANY (ARRAY['call'::text, 'message'::text, 'manual'::text])
  );