ALTER TABLE public.relationship_message_library
  ADD COLUMN IF NOT EXISTS content_url text,
  ADD COLUMN IF NOT EXISTS content_label text;

DROP FUNCTION IF EXISTS public.increment_content_usage(uuid, timestamptz);

DROP TABLE IF EXISTS public.relationship_content_groups CASCADE;
DROP TABLE IF EXISTS public.relationship_step_content_bindings CASCADE;
DROP TABLE IF EXISTS public.relationship_contents CASCADE;